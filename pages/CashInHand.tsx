import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Landmark, 
  Wallet, 
  AlertTriangle, 
  CheckCircle2, 
  History,
  Info,
  X,
  ChevronRight
} from 'lucide-react';
import { LedgerEntry } from '../types';
import { getLedger, getTodayLedger, calculateTodayLiveStats } from '../services/storage';

interface CashInHandProps {
  changeTab: (tab: string) => void;
}

const CashInHand: React.FC<CashInHandProps> = ({ changeTab }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<LedgerEntry | null>(null);
  const [historyList, setHistoryList] = useState<LedgerEntry[]>([]);
  const [depositHistory, setDepositHistory] = useState<LedgerEntry[]>([]);
  
  // Modals
  const [showDepositHistory, setShowDepositHistory] = useState(false);
  const [selectedLedgerDetail, setSelectedLedgerDetail] = useState<LedgerEntry | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = () => {
    const allLedger = getLedger();
    // Sort descending by date
    const sorted = [...allLedger].sort((a, b) => b.date.localeCompare(a.date));
    setHistoryList(sorted.filter(l => l.isClosed));
    setDepositHistory(sorted.filter(l => l.depositedToBank > 0));

    // Current Date Logic
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    let entry = allLedger.find(l => l.date === selectedDate);

    if (isToday) {
      // If it's today, we might need live stats overlaid on stored ledger (if open)
      const base = getTodayLedger(); // Gets stored today or inits new
      if (!base.isClosed) {
        const stats = calculateTodayLiveStats();
        // Recalculate expected cash live
        const expected = (base.openingBalance + stats.grossSales) - (stats.onlineSales + stats.creditSales + (base.expenses || 0) + (base.depositedToBank || 0));
        
        entry = {
          ...base,
          ...stats,
          expectedCash: expected,
          // Actual cash and difference are effectively unknown/pending if open
          // But we keep what's in base if user partially filled it
        };
      } else {
        entry = base;
      }
    }

    setData(entry || null);
  };

  // --- Helpers ---
  const getStatusColor = (diff: number) => {
    if (diff === 0) return 'text-green-600 bg-green-50 border-green-200';
    if (diff < 0) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  const getStatusLabel = (diff: number) => {
    if (diff === 0) return 'Matched';
    if (diff < 0) return 'Short';
    return 'Excess';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      
      {/* 1. HEADER */}
      <div className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <button onClick={() => changeTab('dashboard')} className="mr-3 p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Cash In Hand</h1>
            <p className="text-xs text-slate-500">
              {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* 2. DATE SELECTOR */}
        <div className="bg-white p-2 rounded-lg border border-gray-200 flex items-center shadow-sm max-w-sm">
          <Calendar size={18} className="text-gray-400 ml-2" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-2 outline-none text-slate-700 font-medium"
          />
        </div>

        {/* 3. SUMMARY CARDS */}
        {data ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Expected */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
               <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Expected Cash</p>
               <h3 className="text-2xl font-bold text-blue-600">₹{data.expectedCash.toLocaleString('en-IN')}</h3>
               <p className="text-[10px] text-slate-400 mt-2 flex items-center">
                 <Info size={10} className="mr-1" />
                 Opening + Sales - Deductions
               </p>
            </div>

            {/* Actual */}
            <div className="bg-slate-800 p-5 rounded-xl shadow-md text-white">
               <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Actual Closing</p>
               <h3 className="text-2xl font-bold text-white">
                 {data.isClosed ? `₹${data.actualCash.toLocaleString('en-IN')}` : '--'}
               </h3>
               {!data.isClosed && <p className="text-xs text-slate-400 mt-1">Day not closed yet</p>}
            </div>

            {/* Difference */}
            <div className={`p-5 rounded-xl border shadow-sm ${data.isClosed ? getStatusColor(data.difference) : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
               <p className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70">Difference</p>
               <h3 className="text-2xl font-bold">
                 {data.isClosed ? `₹${data.difference}` : '--'}
               </h3>
               {data.isClosed && (
                 <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-2 inline-block bg-white bg-opacity-40`}>
                   {getStatusLabel(data.difference)}
                 </span>
               )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">No data available for this date.</div>
        )}

        {/* 4. BANK DEPOSIT SUMMARY */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center">
             <div className="p-3 bg-indigo-100 rounded-full text-indigo-600 mr-4">
               <Landmark size={24} />
             </div>
             <div>
               <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">Cash Sent To Bank</h3>
               <p className="text-2xl font-bold text-slate-800">
                 ₹{(data?.depositedToBank || 0).toLocaleString('en-IN')}
               </p>
             </div>
          </div>
          <button 
            onClick={() => setShowDepositHistory(true)}
            className="px-4 py-2 bg-white text-indigo-600 font-semibold text-sm rounded-lg border border-indigo-200 hover:bg-indigo-50 transition shadow-sm"
          >
            View Deposit History
          </button>
        </div>

        {/* 6. CASH DIFFERENCE LEDGER LIST */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
             <h3 className="font-bold text-slate-700 flex items-center">
               <History size={18} className="mr-2 text-slate-400" />
               Cash Difference Ledger
             </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {historyList.length === 0 ? (
               <div className="p-8 text-center text-gray-400 text-sm">No closed days in history.</div>
            ) : (
              historyList.map((entry) => (
                <div 
                  key={entry.date} 
                  onClick={() => setSelectedLedgerDetail(entry)}
                  className="p-4 hover:bg-gray-50 transition cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{entry.date}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-1">
                      <span>Exp: <span className="font-medium">₹{entry.expectedCash}</span></span>
                      <span>Act: <span className="font-medium text-slate-700">₹{entry.actualCash}</span></span>
                    </div>
                  </div>
                  <div className="text-right flex items-center">
                    <div className="mr-3">
                      <p className={`font-bold text-sm ${entry.difference === 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {entry.difference > 0 ? '+' : ''}{entry.difference}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${entry.difference === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {getStatusLabel(entry.difference)}
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 5. DEPOSIT HISTORY MODAL */}
      {showDepositHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col animate-fade-in-up shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-slate-800 flex items-center">
                <Landmark size={18} className="mr-2 text-indigo-600" /> Deposit History
              </h3>
              <button onClick={() => setShowDepositHistory(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
               {depositHistory.length === 0 ? (
                 <div className="p-8 text-center text-gray-400">No bank deposits found.</div>
               ) : (
                 <div className="space-y-2">
                   {depositHistory.map(entry => (
                     <div key={entry.date} className="p-3 bg-white border border-gray-100 rounded-lg shadow-sm flex justify-between items-center">
                        <div>
                          <p className="font-medium text-slate-700 text-sm">{entry.date}</p>
                          {entry.notes && <p className="text-xs text-gray-400 truncate max-w-[150px]">{entry.notes}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600">₹{entry.depositedToBank}</p>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* 7. LEDGER DETAIL MODAL */}
      {selectedLedgerDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in-up shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                 <h3 className="font-bold text-slate-800">Ledger Details</h3>
                 <p className="text-xs text-gray-500">{selectedLedgerDetail.date}</p>
              </div>
              <button onClick={() => setSelectedLedgerDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-4">
               {/* Summary Block */}
               <div className={`p-4 rounded-xl border text-center ${selectedLedgerDetail.difference === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-xs font-bold uppercase tracking-wider opacity-60 mb-1">Status</p>
                  <p className={`text-xl font-bold ${selectedLedgerDetail.difference === 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {getStatusLabel(selectedLedgerDetail.difference)} 
                    {selectedLedgerDetail.difference !== 0 && ` (₹${selectedLedgerDetail.difference})`}
                  </p>
               </div>

               {/* Details Grid */}
               <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Opening Cash</span>
                    <span className="font-mono font-medium">₹{selectedLedgerDetail.openingBalance}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Total Sales (Gross)</span>
                    <span className="font-mono font-medium text-green-600">+ ₹{selectedLedgerDetail.grossSales}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Wallet / UPI</span>
                    <span className="font-mono font-medium text-red-400">- ₹{selectedLedgerDetail.onlineSales}</span>
                  </div>
                   <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Credit Given</span>
                    <span className="font-mono font-medium text-red-400">- ₹{selectedLedgerDetail.creditSales}</span>
                  </div>
                   <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Expenses</span>
                    <span className="font-mono font-medium text-red-400">- ₹{selectedLedgerDetail.expenses}</span>
                  </div>
                   <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Bank Deposit</span>
                    <span className="font-mono font-medium text-red-600">- ₹{selectedLedgerDetail.depositedToBank}</span>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg space-y-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-700">Expected Cash</span>
                      <span className="font-bold text-slate-800">₹{selectedLedgerDetail.expectedCash}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-700">Actual Cash</span>
                      <span className="font-bold text-blue-600">₹{selectedLedgerDetail.actualCash}</span>
                    </div>
                  </div>
               </div>

               {selectedLedgerDetail.notes && (
                 <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800">
                   <p className="font-bold text-xs uppercase mb-1 opacity-70">Notes</p>
                   {selectedLedgerDetail.notes}
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CashInHand;