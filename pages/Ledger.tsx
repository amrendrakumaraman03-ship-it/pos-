import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  History, 
  Calculator, 
  Landmark, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Edit2,
  Calendar
} from 'lucide-react';
import { LedgerEntry } from '../types';
import { getLedgerEntry, calculateDailyStats, saveLedgerDay, getLedger } from '../services/storage';

const Ledger: React.FC = () => {
  // --- State ---
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [todayLedger, setTodayLedger] = useState<LedgerEntry | null>(null);
  const [historyMode, setHistoryMode] = useState(false);
  const [ledgerHistory, setLedgerHistory] = useState<LedgerEntry[]>([]);

  // Toggle Mode
  const [isAutoMode, setIsAutoMode] = useState(true);

  // Auto Data Store (Reference for Reverting)
  const [autoData, setAutoData] = useState({
    openingBalance: 0,
    grossSales: 0,
    onlineSales: 0,
    creditSales: 0
  });

  // Form Inputs (Strings to handle "Zero -> Nil" UX)
  const [inputs, setInputs] = useState({
    openingBalance: '',
    grossSales: '',
    onlineSales: '', // Wallet/UPI
    creditSales: '', // Credit Given
    expenses: '',    // Others
    actualCash: '',
    bankDeposit: '',
    notes: ''
  });

  // Helper to format number to input string (0 -> '')
  const formatInput = (num: number) => num === 0 ? '' : num.toString();
  // Helper to parse input string to number
  const parseNum = (str: string) => {
    const val = parseFloat(str);
    return isNaN(val) ? 0 : val;
  };

  // --- Effects ---

  useEffect(() => {
    fetchData(selectedDate);
    setLedgerHistory(getLedger().filter(l => l.isClosed).sort((a,b) => b.date.localeCompare(a.date)));
  }, [selectedDate]);

  const fetchData = (date: string) => {
    const base = getLedgerEntry(date);
    setTodayLedger(base);

    if (!base.isClosed) {
      // Calculate Live Stats for the selected date
      const stats = calculateDailyStats(date);
      // For Opening Balance, use what getLedgerEntry provided (which is derived from previous day)
      const baseOpening = base.openingBalance;

      // Store Auto Data
      setAutoData({
        openingBalance: baseOpening,
        grossSales: stats.grossSales,
        onlineSales: stats.onlineSales,
        creditSales: stats.creditSales
      });

      // Initialize Inputs
      setInputs({
        openingBalance: formatInput(baseOpening),
        grossSales: formatInput(stats.grossSales),
        onlineSales: formatInput(stats.onlineSales),
        creditSales: formatInput(stats.creditSales),
        expenses: formatInput(base.expenses || 0),
        actualCash: base.actualCash ? formatInput(base.actualCash) : '',
        bankDeposit: base.depositedToBank ? formatInput(base.depositedToBank) : '',
        notes: base.notes || ''
      });
      
      // Reset mode to Auto when changing dates for fresh calculation, unless persisted logic added later
      setIsAutoMode(true);
    }
  };

  // Live Auto-Refresh when in Auto Mode (if bills added while viewing)
  useEffect(() => {
    if (isAutoMode && todayLedger && !todayLedger.isClosed) {
      const stats = calculateDailyStats(selectedDate);
      
      // Update Auto Data Ref
      setAutoData(prev => ({
        ...prev,
        grossSales: stats.grossSales,
        onlineSales: stats.onlineSales,
        creditSales: stats.creditSales
      }));

      // Sync Inputs
      setInputs(prev => ({
        ...prev,
        // Opening balance stays as is (from autoData init) in Auto Mode
        grossSales: formatInput(stats.grossSales),
        onlineSales: formatInput(stats.onlineSales),
        creditSales: formatInput(stats.creditSales)
      }));
    }
  }, [isAutoMode, todayLedger, selectedDate]);

  const handleModeSwitch = (mode: 'auto' | 'manual') => {
    const newAutoMode = mode === 'auto';
    setIsAutoMode(newAutoMode);
    
    if (newAutoMode) {
      // Revert to Auto Values
      setInputs(prev => ({
        ...prev,
        openingBalance: formatInput(autoData.openingBalance),
        grossSales: formatInput(autoData.grossSales),
        onlineSales: formatInput(autoData.onlineSales),
        creditSales: formatInput(autoData.creditSales)
      }));
    }
  };

  // --- Calculations ---

  const currentOpening = parseNum(inputs.openingBalance);
  const currentGross = parseNum(inputs.grossSales);
  const currentOnline = parseNum(inputs.onlineSales);
  const currentCredit = parseNum(inputs.creditSales);
  const currentExpenses = parseNum(inputs.expenses);
  
  const totalDeductions = currentOnline + currentCredit + currentExpenses;
  const expectedCash = (currentOpening + currentGross) - totalDeductions;
  
  const actualCashVal = parseNum(inputs.actualCash);
  const bankDepositVal = parseNum(inputs.bankDeposit);
  const adjustedClosingCash = actualCashVal - bankDepositVal;
  const difference = actualCashVal - expectedCash;

  // --- Handlers ---

  const handleCloseDay = () => {
    if (!todayLedger) return;
    if (inputs.actualCash === '') return alert("Please enter Actual Closing Cash count.");
    if (bankDepositVal > actualCashVal) return alert("Bank deposit cannot exceed actual cash.");

    const closingEntry: LedgerEntry = {
      ...todayLedger,
      date: selectedDate, // Ensure we save for selected date
      openingBalance: currentOpening,
      grossSales: currentGross,
      onlineSales: currentOnline,
      creditSales: currentCredit,
      expenses: currentExpenses,
      
      expectedCash: expectedCash,
      actualCash: actualCashVal,
      depositedToBank: bankDepositVal,
      closingBalance: adjustedClosingCash,
      difference: difference,
      
      isClosed: true,
      isAutoMode: isAutoMode,
      notes: inputs.notes
    };

    saveLedgerDay(closingEntry);
    alert("Day Closed Successfully!");
    fetchData(selectedDate); // Reload
  };

  const handleInputChange = (field: keyof typeof inputs, value: string) => {
    // Validate: No more than 2 decimal places
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1] && parts[1].length > 2) return;
    }
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  // --- Render Components ---

  const InputField = ({ 
    val, 
    field, 
    disabled = false,
    label,
    large = false
  }: { val: string, field: keyof typeof inputs, disabled?: boolean, label?: string, large?: boolean }) => (
    <div className={`${disabled ? 'opacity-90' : ''}`}>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <input 
        type="number"
        disabled={disabled}
        value={val}
        onChange={e => handleInputChange(field, e.target.value)}
        placeholder="0"
        onWheel={(e) => e.currentTarget.blur()}
        className={`
          w-full rounded-lg outline-none transition-all
          ${large ? 'text-lg font-bold py-3 pl-8 pr-4 border' : 'p-3 text-base font-semibold border'}
          ${disabled 
            ? 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed' 
            : 'bg-white border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 text-slate-800 shadow-sm'
          }
        `}
      />
    </div>
  );

  // --- Main Render ---

  if (historyMode) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Ledger History</h2>
          <button onClick={() => setHistoryMode(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Back to Daily</button>
        </div>
        <div className="space-y-4">
          {ledgerHistory.map(l => (
            <div key={l.date} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-300 transition" onClick={() => { setSelectedDate(l.date); setHistoryMode(false); }}>
              <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                <span className="font-bold text-slate-700">{l.date}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${l.difference === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {l.difference === 0 ? 'Matched' : `Diff: ${l.difference > 0 ? '+' : ''}${l.difference}`}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs uppercase">Opening</p>
                  <p className="font-semibold">₹{l.openingBalance}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase">Total Sales</p>
                  <p className="font-semibold">₹{l.grossSales}</p>
                </div>
                 <div>
                  <p className="text-gray-500 text-xs uppercase">Bank Dep.</p>
                  <p className="font-semibold">₹{l.depositedToBank}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase">Closing (C/F)</p>
                  <p className="font-semibold text-indigo-600">₹{l.closingBalance}</p>
                </div>
              </div>
            </div>
          ))}
          {ledgerHistory.length === 0 && <div className="text-center py-10 text-gray-400">No history available</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto pb-24">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center">
            <Calculator className="mr-2 text-indigo-600" /> Daily Reconciliation
          </h2>
          <p className="text-xs text-gray-500 mt-1">Verify cash and close day</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          {/* Date Picker */}
          <div className="bg-white border border-gray-200 rounded-lg flex items-center px-3 py-2 shadow-sm flex-1 md:flex-none">
            <Calendar size={16} className="text-gray-400 mr-2" />
            <input 
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="outline-none text-sm font-semibold text-slate-700 w-full"
            />
          </div>

          <button 
            onClick={() => setHistoryMode(true)}
            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center bg-indigo-50 px-3 py-2 rounded-lg transition-colors border border-indigo-100"
          >
            <History size={16} className="mr-1" /> History
          </button>
        </div>
      </div>

      {!todayLedger ? (
        <div className="text-center py-10">Loading...</div>
      ) : todayLedger.isClosed ? (
        /* --- READ ONLY CLOSED VIEW --- */
        <div className="space-y-6 animate-fade-in">
          <div className="bg-emerald-50 border border-emerald-200 p-8 rounded-xl text-center shadow-sm">
            <Lock size={48} className="mx-auto text-emerald-500 mb-4" />
            <h2 className="text-2xl font-bold text-emerald-800">Day Closed</h2>
            <p className="text-emerald-600 font-medium text-sm mt-1">{new Date(selectedDate).toDateString()}</p>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-gray-100 bg-gray-50 font-bold text-gray-700">Summary</div>
             <div className="p-4 space-y-3">
               <div className="flex justify-between text-sm"><span>Opening Balance</span> <span className="font-mono">₹{todayLedger.openingBalance}</span></div>
               <div className="flex justify-between text-sm"><span>Gross Sales</span> <span className="font-mono">+ ₹{todayLedger.grossSales}</span></div>
               <div className="flex justify-between text-sm text-gray-500"><span>Deductions (Online/Credit/Exp)</span> <span className="font-mono">- ₹{todayLedger.onlineSales + todayLedger.creditSales + todayLedger.expenses}</span></div>
               <div className="border-t border-dashed my-2"></div>
               <div className="flex justify-between font-bold text-slate-800"><span>Expected Cash</span> <span>₹{todayLedger.expectedCash}</span></div>
               <div className="flex justify-between text-indigo-600 font-bold"><span>Actual Cash</span> <span>₹{todayLedger.actualCash}</span></div>
               <div className="flex justify-between text-red-500 text-sm"><span>Bank Deposit</span> <span>- ₹{todayLedger.depositedToBank}</span></div>
               <div className="bg-slate-100 p-3 rounded flex justify-between font-bold text-lg mt-2">
                 <span>Closing Balance (C/F)</span>
                 <span>₹{todayLedger.closingBalance}</span>
               </div>
               
               {todayLedger.notes && (
                 <div className="mt-2 text-xs text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-100">
                   <strong>Note:</strong> {todayLedger.notes}
                 </div>
               )}
             </div>
          </div>
        </div>
      ) : (
        /* --- ACTIVE RECONCILIATION FORM --- */
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* OPENING BALANCE CARD */}
            <div className={`p-4 rounded-xl shadow-sm border transition-colors ${!isAutoMode ? 'bg-white border-indigo-300 ring-2 ring-indigo-50' : 'bg-white border-slate-200'}`}>
              <label className="block text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
                {isAutoMode ? 'Opening Balance (Auto)' : 'Opening Balance (Manual)'}
              </label>
              <div className="flex items-center">
                <span className="text-xl font-bold text-slate-400 mr-1">₹</span>
                <input
                  type="number"
                  value={inputs.openingBalance}
                  disabled={isAutoMode}
                  onChange={(e) => handleInputChange('openingBalance', e.target.value)}
                  placeholder="0"
                  onWheel={(e) => e.currentTarget.blur()}
                  className={`w-full bg-transparent text-2xl font-bold outline-none placeholder-slate-300 ${isAutoMode ? 'text-slate-700 cursor-not-allowed' : 'text-slate-900'}`}
                />
              </div>
            </div>

            {/* TODAY'S SALES CARD */}
            <div className="bg-indigo-600 p-4 rounded-xl shadow-md shadow-indigo-200 text-white">
              <p className="text-xs text-indigo-100 font-bold uppercase tracking-wider mb-1">Total Sales (Gross)</p>
              <div className="flex items-center">
                 <span className="text-xl font-bold text-indigo-300 mr-1">₹</span>
                 <span className="text-2xl font-bold">{currentGross.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* AUTO / MANUAL TOGGLE */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-100 p-1 rounded-full flex relative w-64 shadow-inner">
              <div 
                className={`absolute top-1 bottom-1 w-[48%] bg-white rounded-full shadow-sm transition-all duration-300 ease-out ${isAutoMode ? 'left-1' : 'left-[51%]'}`} 
              />
              <button 
                onClick={() => handleModeSwitch('auto')} 
                className={`flex-1 flex items-center justify-center py-2 rounded-full text-sm font-bold z-10 transition-colors ${isAutoMode ? 'text-indigo-600' : 'text-gray-500'}`}
              >
                <RefreshCw size={14} className="mr-2" /> Auto Fetch
              </button>
              <button 
                onClick={() => handleModeSwitch('manual')}
                className={`flex-1 flex items-center justify-center py-2 rounded-full text-sm font-bold z-10 transition-colors ${!isAutoMode ? 'text-indigo-600' : 'text-gray-500'}`}
              >
                <Edit2 size={14} className="mr-2" /> Manual
              </button>
            </div>
          </div>

          {/* MAIN CONTENT FORM */}
          <div className="space-y-6 animate-fade-in-up">
            
            {/* SECTION A: SALES */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Today's Sales (+)</label>
              <div className="relative">
                 <span className="absolute left-4 top-3.5 text-gray-400 font-bold">₹</span>
                 <input 
                    type="number" 
                    value={inputs.grossSales}
                    disabled={isAutoMode}
                    onChange={e => handleInputChange('grossSales', e.target.value)}
                    placeholder="0"
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`w-full pl-8 pr-4 py-3 rounded-lg border text-lg font-bold outline-none transition-all ${isAutoMode ? 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white border-indigo-200 focus:ring-2 focus:ring-indigo-500 text-slate-800'}`}
                 />
              </div>
            </div>

            {/* SECTION B: DEDUCTIONS */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deductions (–)</h3>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField 
                  val={inputs.onlineSales} field="onlineSales" disabled={isAutoMode} label="Wallet / UPI" 
                />
                <InputField 
                  val={inputs.creditSales} field="creditSales" disabled={isAutoMode} label="Credit Given" 
                />
                <div className="md:col-span-2">
                  <InputField 
                    val={inputs.expenses} field="expenses" label="Expenses / Others (Always Manual)" 
                  />
                </div>
              </div>
            </div>

            {/* SECTION C: EXPECTED CASH */}
            <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Landmark size={100} />
              </div>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Expected Cash in Drawer</p>
              <h2 className="text-4xl font-bold mb-2">₹{expectedCash.toLocaleString('en-IN')}</h2>
              <p className="text-blue-200 text-xs font-medium opacity-80 flex items-center">
                (Opening + Sales) - Deductions
              </p>
            </div>

            {/* SECTION D: ACTUAL CASH */}
            <div className="bg-slate-900 p-6 rounded-xl shadow-lg text-white">
              <label className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Actual Closing Cash (Counted)</label>
              <div className="relative">
                 <span className="absolute left-4 top-3.5 text-slate-500 font-bold text-xl">₹</span>
                 <input 
                    type="number" 
                    value={inputs.actualCash}
                    onChange={e => handleInputChange('actualCash', e.target.value)}
                    placeholder="0.00"
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-2xl font-bold text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                 />
              </div>
            </div>

            {/* SECTION E: BANK DEPOSIT */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center text-indigo-900 font-bold text-sm uppercase">
                   <Landmark size={16} className="mr-2" /> Cash Sent to Bank
                 </div>
                 <span className="text-[10px] bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded font-bold">DEPOSIT</span>
              </div>
              <input 
                 type="number"
                 value={inputs.bankDeposit}
                 onChange={e => handleInputChange('bankDeposit', e.target.value)}
                 placeholder="Enter amount..."
                 onWheel={(e) => e.currentTarget.blur()}
                 className="w-full p-3 border border-indigo-200 rounded-lg bg-white text-lg font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-400 outline-none mb-3"
              />
              <div className="flex justify-between items-center text-sm border-t border-indigo-200 pt-3">
                <span className="text-indigo-400 font-medium">Closing Cash → Adjusted</span>
                <span className="font-bold text-indigo-900 text-lg">₹{adjustedClosingCash.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* SECTION F: ALERTS */}
            {inputs.actualCash !== '' && (
              difference < 0 ? (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start">
                  <div className="p-2 bg-red-100 rounded-full mr-3 text-red-600"><AlertTriangle size={20} /></div>
                  <div>
                    <h4 className="font-bold text-red-800">Shortage Detected</h4>
                    <p className="text-sm text-red-600">Difference: <span className="font-bold">₹{difference}</span></p>
                  </div>
                </div>
              ) : difference > 0 ? (
                 <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-start">
                  <div className="p-2 bg-green-100 rounded-full mr-3 text-green-600"><CheckCircle2 size={20} /></div>
                  <div>
                    <h4 className="font-bold text-green-800">Excess Detected</h4>
                     <p className="text-sm text-green-600">Difference: <span className="font-bold">+₹{difference}</span></p>
                  </div>
                </div>
              ) : (
                 <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center justify-center text-green-700 font-bold">
                   <CheckCircle2 size={20} className="mr-2" /> Perfect Match
                 </div>
              )
            )}

            {/* SECTION G: NOTES */}
            <div>
               <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Notes / Details (Optional)</label>
               <textarea 
                 value={inputs.notes}
                 onChange={e => setInputs({...inputs, notes: e.target.value})}
                 className="w-full p-4 border border-gray-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
                 placeholder="Person name, specific details, or reasons for discrepancies..."
                 rows={3}
               />
            </div>

            {/* CLOSE BUTTON */}
            {inputs.actualCash !== '' && (
              <button 
                onClick={handleCloseDay}
                className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-xl shadow-lg hover:bg-black transition-transform active:scale-95 flex justify-center items-center"
              >
                <Lock size={20} className="mr-2" />
                CLOSE DAY & SAVE
              </button>
            )}

          </div>
        </>
      )}
    </div>
  );
};

export default Ledger;