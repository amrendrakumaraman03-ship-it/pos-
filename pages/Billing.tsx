import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  Banknote, 
  Smartphone, 
  Percent,
  CheckCircle,
  Printer,
  AlertCircle
} from 'lucide-react';
import { Product, CartItem, Customer, PaymentMode, Bill } from '../types';
import { getProducts, getCustomers, saveBill } from '../services/storage';

const Billing: React.FC = () => {
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);

  // Transaction State
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Mixed Payment
  const [cashAmount, setCashAmount] = useState<string>('');
  
  // New Customer Form
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustData, setNewCustData] = useState({ name: '', mobile: '', address: '' });

  // Confirmation Modal
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProducts(getProducts());
    setCustomers(getCustomers());
  }, []);

  // Search Logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.code.toLowerCase().includes(q)
    ).slice(0, 5);
    setSearchResults(results);
    setSelectedProductIndex(0);
  }, [searchQuery, products]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1, discount: 0 }];
    });
    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.qty + delta);
        if (newQty > item.stock) {
          alert(`Only ${item.stock} in stock!`);
          return item;
        }
        return { ...item, qty: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // --- Calculations ---
  // Calculates Subtotal (Taxable Value) and Total GST based on inclusion logic
  const calculateTotals = () => {
    let subtotal = 0;
    let totalGst = 0;
    let totalDiscount = 0;

    cart.forEach(item => {
      const qty = item.qty;
      const price = item.sellingPrice;
      const rate = item.gstPercent;
      const isIncluded = item.gstIncluded;
      
      let itemTaxable = 0;
      let itemTax = 0;

      if (isIncluded) {
        // Price includes Tax. Extract Tax.
        // Formula: Tax = Price - (Price / (1 + Rate/100))
        const totalValue = price * qty;
        itemTaxable = totalValue / (1 + rate / 100);
        itemTax = totalValue - itemTaxable;
      } else {
        // Price excludes Tax. Add Tax.
        itemTaxable = price * qty;
        itemTax = itemTaxable * (rate / 100);
      }

      subtotal += itemTaxable;
      totalGst += itemTax;
      totalDiscount += (item.discount || 0);
    });

    // Grand Total is essentially Subtotal + GST - Discount
    // Math.round helps with currency precision
    const grandTotal = Math.round(subtotal + totalGst - totalDiscount);

    return { subtotal, totalGst, totalDiscount, grandTotal };
  };

  const { subtotal, totalGst, totalDiscount, grandTotal } = calculateTotals();

  // Validate and Show Confirmation
  const handleCheckout = () => {
    if (cart.length === 0) return alert("Cart is empty");
    if (paymentMode === PaymentMode.CREDIT && !selectedCustomer) return alert("Customer required for Credit");
    
    // Mixed validation
    if (paymentMode === PaymentMode.MIXED) {
      const cash = parseFloat(cashAmount) || 0;
      if (cash > grandTotal) return alert("Cash cannot exceed total");
    }

    setShowConfirmation(true);
  };

  // Actually Process the Bill
  const finalizeBill = () => {
    const bill: Bill = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      timestamp: Date.now(),
      items: cart,
      subtotal,
      totalGst,
      totalDiscount,
      grandTotal,
      paymentMode,
      customerId: selectedCustomer?.id,
      cashAmount: paymentMode === PaymentMode.MIXED ? (parseFloat(cashAmount) || 0) : undefined,
      upiAmount: paymentMode === PaymentMode.MIXED ? (grandTotal - (parseFloat(cashAmount) || 0)) : undefined,
      status: paymentMode === PaymentMode.CREDIT ? 'CREDIT' : 'PAID'
    };

    saveBill(bill, selectedCustomer || undefined);
    
    // Reset
    setCart([]);
    setPaymentMode(PaymentMode.CASH);
    setSelectedCustomer(null);
    setCashAmount('');
    setShowConfirmation(false);
    alert("Bill Generated Successfully!");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      setSelectedProductIndex(prev => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      setSelectedProductIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      if (searchResults.length > 0) {
        addToCart(searchResults[selectedProductIndex]);
      }
    }
  };

  // Customer Filter Logic
  const filteredCustomers = customers
    .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.mobile.includes(customerSearch))
    .sort((a, b) => {
      const q = customerSearch.toLowerCase();
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      // Exact match priority
      if (aName === q && bName !== q) return -1;
      if (bName === q && aName !== q) return 1;
      // Starts with priority
      if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
      if (bName.startsWith(q) && !aName.startsWith(q)) return 1;
      return 0;
    });

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      
      {/* LEFT: Payment & Cart */}
      <div className="flex-1 flex flex-col h-full lg:border-r border-gray-200">
        
        {/* Top Bar: Search */}
        <div className="p-4 bg-white border-b border-gray-200 shadow-sm relative z-10">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Scan Barcode or Search Product..." 
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-lg"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {/* Auto-suggest Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 w-full bg-white shadow-xl rounded-b-lg border border-gray-100 mt-1 max-h-60 overflow-auto">
                {searchResults.map((product, idx) => (
                  <div 
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`p-3 flex justify-between items-center cursor-pointer border-b border-gray-50 ${idx === selectedProductIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                  >
                    <div>
                      <p className="font-medium text-gray-800">{product.name}</p>
                      <p className="text-xs text-gray-500">Code: {product.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-600">₹{product.sellingPrice}</p>
                      <p className="text-[10px] text-gray-400">
                        {product.stock} {product.stockUnit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle: Cart Items */}
        <div className="flex-1 overflow-y-auto p-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCartIcon size={48} className="mb-4 opacity-20" />
              <p>Cart is empty. Scan items to begin.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="p-3 text-xs font-semibold text-gray-500 uppercase text-center">Qty</th>
                  <th className="p-3 text-xs font-semibold text-gray-500 uppercase text-right">Price</th>
                  <th className="p-3 text-xs font-semibold text-gray-500 uppercase text-right">Total</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {cart.map(item => {
                  const lineTotal = item.gstIncluded 
                    ? item.sellingPrice * item.qty 
                    : (item.sellingPrice * item.qty) * (1 + item.gstPercent / 100);
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-[10px] text-gray-400">
                          GST {item.gstPercent}% {item.gstIncluded ? '(Inc)' : '(Exc)'}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-2 bg-gray-100 rounded px-2 py-1 inline-flex">
                          <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:text-red-500"><Minus size={14}/></button>
                          <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:text-green-500"><Plus size={14}/></button>
                        </div>
                      </td>
                      <td className="p-3 text-right text-gray-600">₹{item.sellingPrice}</td>
                      <td className="p-3 text-right font-medium text-gray-800">
                        ₹{lineTotal.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom: Totals & Summary */}
        <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex justify-between items-end mb-4 text-sm text-gray-600">
            <div className="space-y-1">
              <p>Subtotal (Taxable): ₹{subtotal.toFixed(2)}</p>
              <p>Total GST: ₹{totalGst.toFixed(2)}</p>
              <p>Discount: ₹{totalDiscount.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 uppercase font-semibold">Grand Total</p>
              <p className="text-3xl font-bold text-gray-900">₹{grandTotal.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`
              w-full py-4 rounded-lg flex items-center justify-center space-x-2 text-lg font-bold text-white shadow-md transition-all
              ${cart.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95'}
            `}
          >
            <Printer size={20} />
            <span>PRINT & SAVE</span>
          </button>
        </div>
      </div>

      {/* RIGHT: Payment Options & Customer (Collapsible on Mobile) */}
      <div className="lg:w-96 bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto">
        <div className="p-5 space-y-6">
          
          {/* Payment Mode */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Payment Mode</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: PaymentMode.CASH, icon: Banknote, label: 'Cash', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                { id: PaymentMode.UPI, icon: Smartphone, label: 'UPI', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                { id: PaymentMode.CREDIT, icon: User, label: 'Credit', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
                { id: PaymentMode.MIXED, icon: Percent, label: 'Split', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setPaymentMode(mode.id)}
                  className={`
                    flex items-center p-3 rounded-lg border-2 transition-all
                    ${paymentMode === mode.id ? `${mode.border} ${mode.bg}` : 'border-gray-100 hover:border-gray-200 bg-white'}
                  `}
                >
                  <mode.icon size={20} className={`mr-2 ${mode.color}`} />
                  <span className={`font-semibold ${paymentMode === mode.id ? 'text-gray-900' : 'text-gray-500'}`}>{mode.label}</span>
                  {paymentMode === mode.id && <CheckCircle size={16} className="ml-auto text-gray-900" />}
                </button>
              ))}
            </div>
            
            {/* Mixed Payment Input */}
            {paymentMode === PaymentMode.MIXED && (
              <div className="mt-3 p-3 bg-purple-50 rounded border border-purple-100 animate-fade-in">
                <label className="text-xs text-purple-700 font-semibold">Cash Received</label>
                <div className="flex items-center mt-1">
                  <span className="p-2 bg-white border border-r-0 border-purple-200 text-gray-500 rounded-l">₹</span>
                  <input 
                    type="number" 
                    value={cashAmount}
                    onChange={e => setCashAmount(e.target.value)}
                    className="w-full p-2 border border-purple-200 rounded-r focus:outline-none focus:border-purple-400"
                    placeholder="0.00"
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs font-medium">
                  <span className="text-gray-500">Balance (UPI):</span>
                  <span className="text-purple-700">₹{Math.max(0, grandTotal - (parseFloat(cashAmount) || 0))}</span>
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Customer Selection */}
          <div className={`${paymentMode === PaymentMode.CREDIT ? 'bg-amber-50 -m-2 p-4 rounded-lg border border-amber-100' : ''}`}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Customer {paymentMode === PaymentMode.CREDIT && <span className="text-red-500">*</span>}
            </h3>
            
            {selectedCustomer ? (
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm relative group">
                 <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
                <p className="font-bold text-gray-800">{selectedCustomer.name}</p>
                <p className="text-sm text-gray-500">{selectedCustomer.mobile}</p>
                {selectedCustomer.address && <p className="text-xs text-gray-400 mt-1 truncate">{selectedCustomer.address}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <input 
                  type="text"
                  placeholder="Search Customer (Name/Mobile)"
                  className="w-full p-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
                
                {/* Customer Search Results */}
                {customerSearch && (
                  <div className="max-h-40 overflow-auto border border-gray-100 rounded bg-white">
                    {filteredCustomers.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                          className="p-2 hover:bg-gray-50 cursor-pointer text-sm flex justify-between items-center group"
                        >
                          <div>
                            <p className="font-medium group-hover:text-indigo-600">{c.name}</p>
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {c.mobile}
                          </div>
                        </div>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="p-2 text-xs text-gray-400 text-center">No existing customer found</div>
                      )}
                  </div>
                )}

                <button 
                  onClick={() => setShowNewCustomer(true)}
                  className="w-full py-2 text-sm text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50"
                >
                  + Add New Customer
                </button>
              </div>
            )}
          </div>

          {/* New Customer Modal Area (Inline for simplicity) */}
          {showNewCustomer && !selectedCustomer && (
            <div className="bg-white border border-indigo-100 p-4 rounded-lg shadow-sm space-y-3 animate-fade-in">
              <h4 className="font-semibold text-sm text-indigo-800">New Customer</h4>
              <input 
                className="w-full p-2 border rounded text-sm" 
                placeholder="Name"
                value={newCustData.name}
                onChange={e => setNewCustData({...newCustData, name: e.target.value})}
              />
              <input 
                className="w-full p-2 border rounded text-sm" 
                placeholder="Mobile"
                value={newCustData.mobile}
                onChange={e => setNewCustData({...newCustData, mobile: e.target.value})}
              />
               <input 
                className="w-full p-2 border rounded text-sm" 
                placeholder="Address (Optional)"
                value={newCustData.address}
                onChange={e => setNewCustData({...newCustData, address: e.target.value})}
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowNewCustomer(false)}
                  className="flex-1 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if(!newCustData.name) return alert("Name required");
                    const c: Customer = { id: crypto.randomUUID(), ...newCustData };
                    setCustomers(prev => [...prev, c]);
                    setSelectedCustomer(c);
                    setShowNewCustomer(false);
                    setNewCustData({ name: '', mobile: '', address: '' });
                  }}
                  className="flex-1 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
            <div className="bg-indigo-600 p-4 text-white text-center">
              <h3 className="text-lg font-bold">Confirm Transaction</h3>
              <p className="text-indigo-200 text-sm">Please verify details before proceeding</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Grand Total</p>
                <p className="text-4xl font-bold text-slate-800 mt-1">₹{grandTotal.toLocaleString('en-IN')}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2 border border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment Mode</span>
                  <span className="font-bold text-slate-800">{paymentMode}</span>
                </div>
                {paymentMode === PaymentMode.MIXED && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Split</span>
                    <span>Cash: {parseFloat(cashAmount) || 0} / UPI: {grandTotal - (parseFloat(cashAmount) || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500">Items</span>
                   <span className="font-bold text-slate-800">{cart.reduce((a, c) => a + c.qty, 0)}</span>
                </div>
                {selectedCustomer && (
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-500">Customer</span>
                     <span className="font-bold text-indigo-600">{selectedCustomer.name}</span>
                   </div>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button 
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 py-3 text-slate-600 font-bold bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={finalizeBill}
                  className="flex-1 py-3 text-white font-bold bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-transform active:scale-95"
                >
                  Confirm & Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Simple Icon component for empty state
const ShoppingCartIcon = ({ size, className }: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="8" cy="21" r="1"></circle>
    <circle cx="19" cy="21" r="1"></circle>
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
  </svg>
);

export default Billing;