import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Plus, 
  FileText, 
  X, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  Info 
} from 'lucide-react';
import { getKhata, getCustomers, addKhataPayment, addManualKhataDebit } from '../services/storage';
import { KhataEntry, Customer } from '../types';

const Khata: React.FC = () => {
  const [entries, setEntries] = useState<KhataEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerBalances, setCustomerBalances] = useState<{[key:string]: number}>({});
  
  // -- Modals State --
  // 1. Payment Receive Modal
  const [selectedCustIdForPay, setSelectedCustIdForPay] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');

  // 2. Add Manual Credit Modal
  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [newCredit, setNewCredit] = useState({
    mobile: '',
    name: '',
    address: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: 'Manual Credit'
  });
  // Used to track if we found an existing customer in Manual Credit modal
  const [existingCreditCustomer, setExistingCreditCustomer] = useState<Customer | null>(null);

  // 3. View History Modal
  const [historyCustId, setHistoryCustId] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    const rawData = getKhata();
    const custData = getCustomers();
    setEntries(rawData);
    setCustomers(custData);
    calculateBalances(rawData, custData);
  };

  const calculateBalances = (khata: KhataEntry[], custs: Customer[]) => {
    const balances: {[key:string]: number} = {};
    
    // Initialize
    custs.forEach(c => balances[c.id] = 0);

    // Calc
    khata.forEach(k => {
      if (!balances[k.customerId]) balances[k.customerId] = 0;
      if (k.type === 'DEBIT') balances[k.customerId] += k.amount;
      else balances[k.customerId] -= k.amount;
    });

    setCustomerBalances(balances);
  };

  // --- Handlers ---

  const handleReceivePayment = () => {
    if (!selectedCustIdForPay || !payAmount) return;
    addKhataPayment(selectedCustIdForPay, parseFloat(payAmount), new Date().toISOString());
    refreshData();
    setSelectedCustIdForPay(null);
    setPayAmount('');
  };

  // Auto-fill logic when typing mobile in "Add Credit" modal
  const handleMobileBlur = () => {
    const found = customers.find(c => c.mobile === newCredit.mobile);
    if (found) {
      setExistingCreditCustomer(found);
      setNewCredit(prev => ({ ...prev, name: found.name, address: found.address || '' }));
    } else {
      setExistingCreditCustomer(null);
    }
  };

  const handleAddManualCredit = () => {
    if (!newCredit.mobile || !newCredit.name || !newCredit.amount) {
      return alert("Mobile, Name and Amount are required");
    }

    const customerToSave: Customer = existingCreditCustomer 
      ? { ...existingCreditCustomer, name: newCredit.name, address: newCredit.address } // Update existing just in case
      : { id: crypto.randomUUID(), name: newCredit.name, mobile: newCredit.mobile, address: newCredit.address };

    addManualKhataDebit(
      customerToSave,
      parseFloat(newCredit.amount),
      newCredit.date,
      newCredit.description
    );

    refreshData();
    setIsAddCreditOpen(false);
    setNewCredit({ mobile: '', name: '', address: '', amount: '', date: new Date().toISOString().split('T')[0], description: 'Manual Credit' });
    setExistingCreditCustomer(null);
  };

  // --- Derived Data ---
  
  const totalGiven = entries.filter(e => e.type === 'DEBIT').reduce((acc, e) => acc + e.amount, 0);
  const totalReceived = entries.filter(e => e.type === 'CREDIT').reduce((acc, e) => acc + e.amount, 0);
  
  const chartData = [
    { name: 'Credit Given', amount: totalGiven },
    { name: 'Received', amount: totalReceived }
  ];

  const debtors = (Object.entries(customerBalances) as [string, number][])
    .filter(([_, bal]) => bal !== 0) // Show all non-zero balances, even negative (overpaid)
    .map(([id, bal]) => {
      const c = customers.find(x => x.id === id);
      return { id, name: c?.name || 'Unknown', mobile: c?.mobile || '', bal };
    })
    .sort((a, b) => b.bal - a.bal);

  // History for selected customer
  const customerHistory = historyCustId 
    ? entries.filter(e => e.customerId === historyCustId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  const historyCustomerName = customers.find(c => c.id === historyCustId)?.name;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Khata (Credit Ledger)</h2>
        <button 
          onClick={() => setIsAddCreditOpen(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition"
        >
          <Plus size={18} className="mr-2" />
          Add Manual Credit
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold mb-4 text-slate-600">Credit Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold mb-4 text-slate-600">Recovery Status</h3>
          <div className="text-center py-8">
             <p className="text-4xl font-bold text-slate-800">
               {totalGiven === 0 ? '100%' : Math.round((totalReceived / totalGiven) * 100)}%
             </p>
             <p className="text-sm text-slate-400 mt-2">Recovery Rate</p>
          </div>
          <div className="space-y-2 text-sm">
             <div className="flex justify-between">
               <span>Total Due:</span>
               <span className="font-bold text-red-600">₹{totalGiven - totalReceived}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Debtors List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-700">Outstanding Customers</h3>
        </div>
        <table className="w-full text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4 text-right">Balance Due</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {debtors.map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="p-4">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-gray-400">{d.mobile}</div>
                </td>
                <td className={`p-4 text-right font-bold ${d.bal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{d.bal}
                </td>
                <td className="p-4 text-right space-x-2">
                  <button 
                    onClick={() => setHistoryCustId(d.id)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded tooltip"
                    title="View History"
                  >
                    <FileText size={18} />
                  </button>
                  {d.bal > 0 && (
                    <button 
                      onClick={() => setSelectedCustIdForPay(d.id)}
                      className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 text-sm font-medium"
                    >
                      Receive
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {debtors.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-slate-400">No pending credits! Good job.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 1. PAYMENT MODAL */}
      {selectedCustIdForPay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold mb-4">Receive Payment</h3>
            <p className="text-sm text-gray-500 mb-4">From: {customers.find(c => c.id === selectedCustIdForPay)?.name}</p>
            <input 
              type="number" 
              className="w-full p-3 border rounded-lg mb-4 text-lg"
              placeholder="Enter Amount"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setSelectedCustIdForPay(null)} className="flex-1 py-2 bg-gray-100 rounded-lg font-medium">Cancel</button>
              <button onClick={handleReceivePayment} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MANUAL CREDIT MODAL */}
      {isAddCreditOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-0 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Add Manual Credit</h3>
              <button onClick={() => setIsAddCreditOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Customer Search/Entry */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Customer Mobile</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Enter Mobile to Search/Add"
                    value={newCredit.mobile}
                    onChange={e => setNewCredit({...newCredit, mobile: e.target.value})}
                    onBlur={handleMobileBlur}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    className={`w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${existingCreditCustomer ? 'bg-gray-50' : ''}`}
                    placeholder="Person Name"
                    value={newCredit.name}
                    onChange={e => setNewCredit({...newCredit, name: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Address (Optional)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Area / City"
                    value={newCredit.address}
                    onChange={e => setNewCredit({...newCredit, address: e.target.value})}
                  />
                </div>
              </div>

              <hr className="border-gray-100" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Amount</label>
                  <input 
                    type="number" 
                    className="w-full p-2 border border-gray-200 rounded-lg font-bold text-gray-800"
                    placeholder="0.00"
                    value={newCredit.amount}
                    onChange={e => setNewCredit({...newCredit, amount: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
                  <input 
                    type="date" 
                    className="w-full p-2 border border-gray-200 rounded-lg"
                    value={newCredit.date}
                    onChange={e => setNewCredit({...newCredit, date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Description / Note</label>
                <div className="relative">
                   <Info className="absolute left-3 top-3 text-gray-400" size={16} />
                   <input 
                    type="text" 
                    className="w-full pl-9 p-2 border border-gray-200 rounded-lg"
                    placeholder="Reason for credit..."
                    value={newCredit.description}
                    onChange={e => setNewCredit({...newCredit, description: e.target.value})}
                  />
                </div>
              </div>

              <button 
                onClick={handleAddManualCredit}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition"
              >
                Save Credit Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. HISTORY MODAL */}
      {historyCustId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl animate-fade-in">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-gray-800 text-lg">{historyCustomerName}</h3>
                <p className="text-xs text-gray-500">Ledger History</p>
              </div>
              <button onClick={() => setHistoryCustId(null)} className="p-1 hover:bg-gray-200 rounded-full"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Debit (Given)</th>
                    <th className="px-3 py-2 text-right">Credit (Recv)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customerHistory.map(h => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-600">
                        <div className="flex items-center">
                          <Calendar size={12} className="mr-1 text-gray-400" />
                          {h.date.split('T')[0]}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-medium text-gray-800">{h.description}</td>
                      <td className="px-3 py-3 text-right text-red-600 font-medium">
                        {h.type === 'DEBIT' ? `₹${h.amount}` : '-'}
                      </td>
                      <td className="px-3 py-3 text-right text-green-600 font-medium">
                         {h.type === 'CREDIT' ? `₹${h.amount}` : '-'}
                      </td>
                    </tr>
                  ))}
                  {customerHistory.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400">No transaction history found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 text-right rounded-b-xl">
              <span className="text-sm text-gray-500 mr-2">Current Balance:</span>
              <span className={`text-lg font-bold ${(customerBalances[historyCustId] || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{customerBalances[historyCustId] || 0}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Khata;