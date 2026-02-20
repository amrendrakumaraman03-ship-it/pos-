import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Trash2, 
  TrendingUp, 
  CreditCard, 
  Banknote, 
  Smartphone,
  User,
  Clock,
  ChevronRight,
  Receipt,
  AlertCircle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { Bill, PaymentMode } from '../types';
import { getBills, cancelBill } from '../services/storage';

interface TodaySalesProps {
  changeTab: (tab: string) => void;
}

const TodaySales: React.FC<TodaySalesProps> = ({ changeTab }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'history' | 'analysis'>('history');
  const [bills, setBills] = useState<Bill[]>([]);
  
  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = () => {
    const allBills = getBills();
    const filtered = allBills.filter(b => b.date.startsWith(selectedDate));
    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    setBills(filtered);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to cancel this bill? Stock will be restored.')) {
      cancelBill(id);
      fetchData();
    }
  };

  // --- Derived Metrics ---
  const activeBills = bills.filter(b => b.status !== 'CANCELLED');
  const totalSales = activeBills.reduce((sum, b) => sum + b.grandTotal, 0);
  const totalCount = activeBills.length;
  const avgBillValue = totalCount > 0 ? Math.round(totalSales / totalCount) : 0;

  // --- Chart Data Preparation ---
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    displayHour: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`,
    sales: 0,
    count: 0
  }));

  activeBills.forEach(b => {
    const date = new Date(b.timestamp);
    const h = date.getHours();
    hourlyData[h].sales += b.grandTotal;
    hourlyData[h].count += 1;
  });

  // Find Peak Hour
  let peakHour = hourlyData[0];
  hourlyData.forEach(h => {
    if (h.sales > peakHour.sales) peakHour = h;
  });

  // Helper for Payment Icon
  const getPaymentIcon = (mode: PaymentMode) => {
    switch(mode) {
      case PaymentMode.CASH: return <Banknote size={14} className="text-emerald-600" />;
      case PaymentMode.UPI: return <Smartphone size={14} className="text-blue-600" />;
      case PaymentMode.CREDIT: return <User size={14} className="text-amber-600" />;
      default: return <CreditCard size={14} className="text-purple-600" />;
    }
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
            <h1 className="text-lg font-bold text-slate-800">Sales Summary</h1>
            <p className="text-xs text-slate-500">
              {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* 2. CONTROLS AREA */}
      <div className="p-4 space-y-4">
        {/* Date Selector */}
        <div className="bg-white p-2 rounded-lg border border-gray-200 flex items-center shadow-sm">
          <Calendar size={18} className="text-gray-400 ml-2" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-2 outline-none text-slate-700 font-medium"
          />
        </div>

        {/* Toggle */}
        <div className="flex bg-gray-200 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('history')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${viewMode === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
          >
            History
          </button>
          <button 
            onClick={() => setViewMode('analysis')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${viewMode === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
          >
            Analysis
          </button>
        </div>
      </div>

      {/* 3. CONTENT AREA */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        
        {viewMode === 'history' ? (
          <div className="space-y-4 animate-fade-in-up">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-md shadow-indigo-200">
                <p className="text-[10px] uppercase opacity-80 font-bold">Sales</p>
                <p className="text-lg font-bold">₹{totalSales.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Bills</p>
                <p className="text-lg font-bold text-slate-800">{totalCount}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Avg Bill</p>
                <p className="text-lg font-bold text-slate-800">₹{avgBillValue}</p>
              </div>
            </div>

            {/* Bill List */}
            <div>
              <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">Transactions</h3>
              {bills.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Receipt size={48} className="mx-auto mb-2 opacity-20" />
                  <p>No bills found for this date.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bills.map(bill => (
                    <div key={bill.id} className={`bg-white p-4 rounded-xl border shadow-sm relative ${bill.status === 'CANCELLED' ? 'border-red-100 bg-red-50 opacity-70' : 'border-gray-100'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-full mr-3 ${bill.status === 'CANCELLED' ? 'bg-red-100 text-red-500' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Receipt size={18} />
                          </div>
                          <div>
                            <p className={`font-bold ${bill.status === 'CANCELLED' ? 'text-red-800 line-through' : 'text-slate-800'}`}>
                              Bill #{bill.id.slice(0, 8)}
                            </p>
                            <div className="flex items-center text-xs text-gray-500 mt-0.5">
                              <Clock size={10} className="mr-1" />
                              {new Date(bill.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              <span className="mx-2">•</span>
                              <span className="flex items-center gap-1">
                                {getPaymentIcon(bill.paymentMode)}
                                {bill.paymentMode}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${bill.status === 'CANCELLED' ? 'text-red-600' : 'text-slate-800'}`}>
                            ₹{bill.grandTotal}
                          </p>
                          {bill.status === 'CANCELLED' && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">CANCELLED</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Action */}
                      {bill.status !== 'CANCELLED' && (
                        <div className="border-t border-gray-100 mt-3 pt-2 flex justify-end">
                          <button 
                            onClick={() => handleDelete(bill.id)}
                            className="text-xs text-red-500 flex items-center px-2 py-1 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={12} className="mr-1" /> Cancel Bill
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            {/* Chart Section */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                <TrendingUp size={16} className="mr-2 text-indigo-600" /> Sales Trend
              </h3>
              
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-72">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={hourlyData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis 
                      dataKey="displayHour" 
                      tick={{fontSize: 10}} 
                      interval={3}
                     />
                     <YAxis tick={{fontSize: 10}} width={30} />
                     <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                      itemStyle={{color: '#4f46e5', fontWeight: 'bold'}}
                     />
                     <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      dot={{r: 2, fill:'#4f46e5'}}
                      activeDot={{r: 6}}
                     />
                   </LineChart>
                 </ResponsiveContainer>
              </div>
            </div>

            {/* Peak Hour Badge */}
            {peakHour.sales > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 p-4 rounded-xl flex items-center">
                <div className="p-3 bg-white rounded-full shadow-sm text-orange-500 mr-4">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <p className="text-xs text-orange-800 font-bold uppercase tracking-wider">Peak Hour</p>
                  <p className="text-lg font-bold text-slate-800">
                    {peakHour.displayHour} 
                    <span className="text-sm font-normal text-slate-500 ml-2">(₹{peakHour.sales})</span>
                  </p>
                  <p className="text-xs text-orange-700 mt-1">{peakHour.count} bills generated</p>
                </div>
              </div>
            )}
            
            {/* Empty State for Chart */}
            {totalSales === 0 && (
              <div className="text-center p-8 text-gray-400">
                <p>No sales data to analyze for this day.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. FIXED FOOTER (History Mode Only) */}
      {viewMode === 'history' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:ml-64 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
             <div>
               <p className="text-xs text-gray-500 uppercase">Total Sales</p>
               <p className="text-xl font-bold text-slate-900">₹{totalSales.toLocaleString('en-IN')}</p>
             </div>
             <div className="text-right">
                <p className="text-xs text-gray-500 uppercase">Bills</p>
                <p className="text-xl font-bold text-indigo-600">{totalCount}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodaySales;