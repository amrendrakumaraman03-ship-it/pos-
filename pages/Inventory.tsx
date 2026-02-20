import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Upload, 
  Edit, 
  Trash2, 
  AlertCircle,
  FileText,
  Save,
  X,
  CheckCircle,
  Loader2
} from 'lucide-react';
// Dynamic import used instead of top-level import to prevent crash
import { Product } from '../types';
import { getProducts, saveProduct, deleteProduct } from '../services/storage';

interface ImportItem {
  id: string; // Temporary ID for list
  name: string;
  batch: string;
  expiry: string;
  qty: number | '';
  mrp: number | '';
  rate: number | ''; // Buy Price
  unit: string;
}

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportMode, setIsImportMode] = useState(false);
  
  // -- Import State --
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewData, setPreviewData] = useState<ImportItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importStats, setImportStats] = useState<{added: number, totalStock: number} | null>(null);

  // Form State
  const initialForm: Product = {
    id: '', 
    name: '', 
    code: '', 
    category: 'General', 
    purchasePrice: 0, 
    sellingPrice: 0, 
    stock: 0, 
    stockUnit: 'Tablet', 
    gstPercent: 0,
    gstIncluded: false
  };
  const [formData, setFormData] = useState<Product>(initialForm);

  // Stock Units
  const STOCK_UNITS = ['Tablet', 'Strip', 'Bottle', 'Tube', 'Vial', 'Kg', 'g', 'L', 'ml', 'Pack', 'Piece'];
  // GST Slabs
  const GST_SLABS = [0, 5, 12, 18, 28];

  useEffect(() => {
    setProducts(getProducts());
  }, []);

  const handleSave = () => {
    if (!formData.name || !formData.code) return alert("Name and Code are required");
    const productToSave = { 
      ...formData, 
      id: formData.id || crypto.randomUUID() 
    };
    saveProduct(productToSave);
    setProducts(getProducts());
    setIsModalOpen(false);
    setFormData(initialForm);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure?")) {
      deleteProduct(id);
      setProducts(getProducts());
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      ...initialForm, 
      ...product
    });
    setIsModalOpen(true);
    setIsImportMode(false);
  };

  // --- PDF IMPORT LOGIC ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert("Please select a valid PDF file.");
        return;
      }
      setImportFile(file);
      setImportStats(null);
    }
  };

  const processPdf = async () => {
    if (!importFile) return;

    setIsParsing(true);
    try {
      // Dynamic Import for PDF.js to avoid initial load crashes
      // We import from 'pdfjs-dist' mapped in importmap
      const pdfjsLib = await import('pdfjs-dist');
      
      // Fix for esm.sh structure: check if default export exists
      const pdfjs = (pdfjsLib as any).default || pdfjsLib;
      
      // Set worker source to cdnjs which is more reliable for importScripts than esm.sh in restricted environments
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      }

      const arrayBuffer = await importFile.arrayBuffer();
      
      // Load document
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      const extractedItems: ImportItem[] = [];

      // Heuristic parsing: Loop through pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Group text items by Y coordinate (Row detection)
        const rows: { [key: number]: string[] } = {};
        textContent.items.forEach((item: any) => {
          // Round Y to nearest 10px to group items on same line
          const y = Math.round(item.transform[5] / 10) * 10;
          if (!rows[y]) rows[y] = [];
          rows[y].push(item.str);
        });

        // Analyze rows
        // We look for rows that contain:
        // 1. A number (Qty)
        // 2. A date pattern (Expiry) or Batch code
        // 3. A price pattern
        
        Object.values(rows).forEach((rowItems) => {
          const fullLine = rowItems.join(' ');
          
          // Regex Patterns
          const expiryMatch = fullLine.match(/(\d{2}\/\d{2,4})|(\d{2}-\d{2,4})/); // MM/YY or MM-YYYY
          const priceMatches = fullLine.match(/(\d+\.\d{2})/g); // Numbers with decimals
          const qtyMatch = fullLine.match(/\b(\d{1,4})\b/); // Integers 1-9999
          
          // Filter out header/footer noise
          if (fullLine.includes('Total') || fullLine.includes('Page') || fullLine.includes('GST')) return;

          // If we have at least a potential price or quantity, try to construct an item
          if (qtyMatch || priceMatches) {
             const mfgDate = expiryMatch ? expiryMatch[0] : '';
             
             // Simple Heuristic: 
             // Longest text segment is likely Name.
             // Segment with alphanumeric is likely Batch.
             
             // Remove numbers/dates to find name
             const potentialName = rowItems.find(s => s.length > 4 && !s.match(/\d/));
             const potentialBatch = rowItems.find(s => s.match(/[A-Z0-9]{3,}/) && s.length < 10 && s !== potentialName);

             // Prices: Sort found decimals. Usually smaller is Rate, larger is MRP
             let rate: number | '' = '';
             let mrp: number | '' = '';
             if (priceMatches && priceMatches.length >= 1) {
               const nums = priceMatches.map(parseFloat).sort((a,b) => a-b);
               if (nums.length >= 2) {
                 rate = nums[0];
                 mrp = nums[nums.length - 1]; // Highest value usually MRP
               } else {
                 mrp = nums[0];
               }
             }

             if (potentialName) {
               extractedItems.push({
                 id: crypto.randomUUID(),
                 name: potentialName.trim(),
                 batch: potentialBatch || '',
                 expiry: mfgDate || '',
                 qty: qtyMatch ? parseInt(qtyMatch[0]) : 1,
                 rate: rate,
                 mrp: mrp,
                 unit: 'Tablet' // Default
               });
             }
          }
        });
      }

      if (extractedItems.length === 0) {
        alert("Could not detect any product rows. Please ensure PDF has standard Invoice format.");
      } else {
        setPreviewData(extractedItems);
        setShowPreview(true);
      }

    } catch (error: any) {
      console.error(error);
      let msg = "Error parsing PDF.";
      if (error.name === 'MissingPDFException') msg = "PDF file is missing or invalid.";
      else if (error.name === 'InvalidPDFException') msg = "Invalid PDF structure.";
      else if (error.message?.includes('worker')) msg = "PDF Worker failed to load. Please try again or check internet connection.";
      
      alert(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handlePreviewChange = (id: string, field: keyof ImportItem, val: string | number) => {
    setPreviewData(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: val } : item
    ));
  };

  const removePreviewItem = (id: string) => {
    setPreviewData(prev => prev.filter(item => item.id !== id));
  };

  const finalizeImport = () => {
    let count = 0;
    let totalStockAdded = 0;

    previewData.forEach(item => {
      // Logic: Check if product exists (by name approx) or create new
      const existing = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
      
      const qty = typeof item.qty === 'number' ? item.qty : 0;
      const rate = typeof item.rate === 'number' ? item.rate : 0;
      const mrp = typeof item.mrp === 'number' ? item.mrp : 0;

      if (existing) {
        // Update Existing
        const updated = {
          ...existing,
          stock: existing.stock + qty,
          purchasePrice: rate > 0 ? rate : existing.purchasePrice,
          sellingPrice: mrp > 0 ? mrp : existing.sellingPrice,
          // Append batch/expiry info to notes/name if needed, or ignore for now as per schema limits
        };
        saveProduct(updated);
      } else {
        // Create New
        const newProd: Product = {
          id: crypto.randomUUID(),
          name: item.name,
          code: item.batch || 'INV-' + Date.now().toString().slice(-6), // Fallback code
          category: 'Pharma',
          stock: qty,
          stockUnit: item.unit,
          purchasePrice: rate,
          sellingPrice: mrp,
          gstPercent: 0, // Default
          gstIncluded: false
        };
        saveProduct(newProd);
      }
      count++;
      totalStockAdded += qty;
    });

    setImportStats({ added: count, totalStock: totalStockAdded });
    setProducts(getProducts()); // Refresh list
    setShowPreview(false);
    setImportFile(null);
    setPreviewData([]);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.code.includes(search)
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
          <p className="text-slate-500 text-sm">Manage stock, pricing, and product details</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setIsModalOpen(true); setIsImportMode(false); setFormData(initialForm); }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus size={18} className="mr-2" />
            Add Product
          </button>
          <button 
            onClick={() => { setIsModalOpen(true); setIsImportMode(true); setImportStats(null); }}
            className="flex items-center px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            <Upload size={18} className="mr-2" />
            Import Invoice
          </button>
        </div>
      </div>

      {/* Stats Alert */}
      {importStats && (
        <div className="mb-6 bg-green-50 border border-green-200 p-4 rounded-xl flex items-center animate-fade-in">
          <CheckCircle className="text-green-600 mr-3" />
          <div>
            <h4 className="font-bold text-green-800">Import Successful</h4>
            <p className="text-sm text-green-700">Processed <b>{importStats.added}</b> products. Added <b>{importStats.totalStock}</b> units to stock.</p>
          </div>
          <button onClick={() => setImportStats(null)} className="ml-auto text-green-500 hover:text-green-700"><X size={20}/></button>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by product name or code..." 
          className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-semibold text-slate-600">Product Name</th>
              <th className="p-4 font-semibold text-slate-600">Code</th>
              <th className="p-4 font-semibold text-slate-600">Stock</th>
              <th className="p-4 font-semibold text-slate-600">Buy Price</th>
              <th className="p-4 font-semibold text-slate-600">Sell Price</th>
              <th className="p-4 font-semibold text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition">
                <td className="p-4 font-medium text-slate-800">
                  {p.name}
                  <div className="text-[10px] text-slate-400 mt-1">
                    GST: {p.gstPercent}% ({p.gstIncluded ? 'Inc.' : 'Exc.'})
                  </div>
                </td>
                <td className="p-4 text-slate-500 font-mono text-xs">{p.code}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {p.stock} {p.stockUnit}
                  </span>
                </td>
                <td className="p-4 text-slate-600">₹{p.purchasePrice}</td>
                <td className="p-4 font-bold text-slate-800">₹{p.sellingPrice}</td>
                <td className="p-4 text-right">
                  <button onClick={() => handleEdit(p)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg mr-2">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  No products found. Add some to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Import Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl w-full shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh] ${showPreview ? 'max-w-5xl' : 'max-w-lg'}`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-xl font-bold text-slate-800">
                {isImportMode 
                  ? (showPreview ? 'Verify & Import Data' : 'Import Invoice PDF') 
                  : (formData.id ? 'Edit Product' : 'Add Product')
                }
              </h3>
              <button onClick={() => { setIsModalOpen(false); setShowPreview(false); setPreviewData([]); setImportFile(null); }} className="text-slate-400 hover:text-slate-600"><Trash2 size={24} className="rotate-45" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {isImportMode ? (
                showPreview ? (
                  /* --- PREVIEW TABLE --- */
                  <div className="space-y-4">
                     <div className="overflow-x-auto border border-gray-200 rounded-xl">
                       <table className="w-full text-sm text-left">
                         <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                           <tr>
                             <th className="px-4 py-3 min-w-[150px]">Product Name</th>
                             <th className="px-4 py-3 w-20">Qty</th>
                             <th className="px-4 py-3 w-24">Unit</th>
                             <th className="px-4 py-3 w-24">Buy Price</th>
                             <th className="px-4 py-3 w-24">MRP (Sell)</th>
                             <th className="px-4 py-3 w-28">Batch</th>
                             <th className="px-4 py-3 w-24">Exp</th>
                             <th className="px-4 py-3 w-10"></th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                           {previewData.map(item => (
                             <tr key={item.id} className="bg-white hover:bg-gray-50">
                               <td className="p-2">
                                 <input 
                                   className="w-full p-1 border rounded bg-transparent font-medium" 
                                   value={item.name} 
                                   onChange={e => handlePreviewChange(item.id, 'name', e.target.value)} 
                                 />
                               </td>
                               <td className="p-2">
                                 <input 
                                    type="tel"
                                    className="w-full p-1 border rounded bg-transparent" 
                                    value={item.qty} 
                                    onChange={e => handlePreviewChange(item.id, 'qty', parseInt(e.target.value) || '')} 
                                 />
                               </td>
                               <td className="p-2">
                                 <select 
                                   className="w-full p-1 border rounded bg-transparent text-xs"
                                   value={item.unit}
                                   onChange={e => handlePreviewChange(item.id, 'unit', e.target.value)}
                                 >
                                   {STOCK_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                 </select>
                               </td>
                               <td className="p-2">
                                  <input 
                                    type="tel"
                                    className="w-full p-1 border rounded bg-transparent" 
                                    value={item.rate} 
                                    placeholder="Rate"
                                    onChange={e => handlePreviewChange(item.id, 'rate', parseFloat(e.target.value) || '')} 
                                 />
                               </td>
                               <td className="p-2">
                                 <input 
                                    type="tel"
                                    className="w-full p-1 border rounded bg-transparent font-bold" 
                                    value={item.mrp} 
                                    placeholder="MRP"
                                    onChange={e => handlePreviewChange(item.id, 'mrp', parseFloat(e.target.value) || '')} 
                                 />
                               </td>
                               <td className="p-2">
                                 <input 
                                   className="w-full p-1 border rounded bg-transparent text-xs text-gray-500" 
                                   value={item.batch} 
                                   placeholder="Batch"
                                   onChange={e => handlePreviewChange(item.id, 'batch', e.target.value)} 
                                 />
                               </td>
                               <td className="p-2">
                                  <input 
                                   className="w-full p-1 border rounded bg-transparent text-xs text-gray-500" 
                                   value={item.expiry} 
                                   placeholder="MM/YY"
                                   onChange={e => handlePreviewChange(item.id, 'expiry', e.target.value)} 
                                 />
                               </td>
                               <td className="p-2 text-center">
                                 <button onClick={() => removePreviewItem(item.id)} className="text-red-400 hover:text-red-600">
                                   <X size={16} />
                                 </button>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                     <div className="flex justify-end gap-3 pt-4">
                       <button onClick={() => { setShowPreview(false); setImportFile(null); }} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-100">Cancel</button>
                       <button onClick={finalizeImport} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">
                         Confirm & Save ({previewData.length})
                       </button>
                     </div>
                  </div>
                ) : (
                  /* --- FILE UPLOAD UI --- */
                  <div className="text-center space-y-6">
                    <div className={`border-2 border-dashed rounded-xl p-10 transition-colors ${importFile ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50'}`}>
                      {importFile ? (
                         <div className="flex flex-col items-center">
                           <FileText size={48} className="text-indigo-600 mb-3" />
                           <p className="font-bold text-slate-700 text-lg">{importFile.name}</p>
                           <p className="text-sm text-slate-500 mb-6">{(importFile.size / 1024).toFixed(1)} KB</p>
                           <button onClick={() => setImportFile(null)} className="text-red-500 text-sm hover:underline">Remove</button>
                         </div>
                      ) : (
                        <>
                          <Upload size={48} className="mx-auto text-slate-400 mb-4" />
                          <p className="text-lg font-bold text-slate-700">Select Invoice PDF</p>
                          <p className="text-sm text-slate-500 mb-6">Supported Format: PDF (Table with Qty, MRP, Batch)</p>
                          <input 
                            type="file" 
                            accept="application/pdf" 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            id="fileUpload" 
                          />
                          <label htmlFor="fileUpload" className="cursor-pointer bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 shadow-lg transition-transform active:scale-95 inline-block">
                            Browse Files
                          </label>
                        </>
                      )}
                    </div>

                    {importFile && (
                      <button 
                        onClick={processPdf}
                        disabled={isParsing}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black mt-2 shadow-lg flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isParsing ? (
                          <>
                            <Loader2 size={20} className="mr-2 animate-spin" /> Analyzing PDF...
                          </>
                        ) : (
                          <>
                            <CheckCircle size={20} className="mr-2" /> Process & Preview
                          </>
                        )}
                      </button>
                    )}
                    
                    <div className="text-xs text-slate-400 text-left bg-gray-50 p-3 rounded">
                      <strong>Note:</strong> The system attempts to auto-detect products. You must verify the details in the preview screen before saving.
                    </div>
                  </div>
                )
              ) : (
                /* --- ADD/EDIT PRODUCT FORM --- */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                    <input 
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Code / Barcode</label>
                      <input 
                        className="w-full p-2 border border-slate-300 rounded-lg" 
                        value={formData.code}
                        onChange={e => setFormData({...formData, code: e.target.value})}
                      />
                    </div>
                    {/* STOCK + UNIT FIELD */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
                      <div className="flex">
                        <input 
                          type="number"
                          className="w-full p-2 border border-r-0 border-slate-300 rounded-l-lg outline-none" 
                          value={formData.stock}
                          onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                        />
                        <select 
                          className="bg-gray-50 border border-l-0 border-slate-300 rounded-r-lg text-sm px-2 outline-none text-slate-700 font-medium"
                          value={formData.stockUnit}
                          onChange={e => setFormData({...formData, stockUnit: e.target.value})}
                        >
                          {STOCK_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* PRICING ROW */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price</label>
                      <input 
                        type="number"
                        className="w-full p-2 border border-slate-300 rounded-lg" 
                        value={formData.purchasePrice}
                        onChange={e => setFormData({...formData, purchasePrice: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price</label>
                      <input 
                        type="number"
                        className="w-full p-2 border border-slate-300 rounded-lg" 
                        value={formData.sellingPrice}
                        onChange={e => setFormData({...formData, sellingPrice: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  {/* GST SECTION */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-sm font-bold text-slate-700">GST</label>
                      {/* GST TOGGLE */}
                      <button 
                        onClick={() => setFormData({...formData, gstIncluded: !formData.gstIncluded})}
                        className={`
                          relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                          ${formData.gstIncluded ? 'bg-indigo-600' : 'bg-gray-300'}
                        `}
                      >
                        <span className={`
                          inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                          ${formData.gstIncluded ? 'translate-x-6' : 'translate-x-1'}
                        `}/>
                      </button>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                      <span>{formData.gstIncluded ? 'Tax Included in Price' : 'Tax Added to Price'}</span>
                      <span className="font-bold text-indigo-600">{formData.gstPercent}%</span>
                    </div>

                    {/* GST SLABS */}
                    <div className="flex justify-between gap-1">
                      {GST_SLABS.map(slab => (
                         <button
                           key={slab}
                           onClick={() => setFormData({...formData, gstPercent: slab})}
                           className={`
                             flex-1 py-1 text-xs font-semibold rounded border transition-all
                             ${formData.gstPercent === slab 
                               ? 'bg-indigo-100 border-indigo-200 text-indigo-700' 
                               : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                           `}
                         >
                           {slab}%
                         </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={handleSave}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 mt-2 shadow-sm"
                  >
                    Save Product
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;