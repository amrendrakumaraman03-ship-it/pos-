import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  AlertCircle, 
  Wallet, 
  ShoppingCart,
  PlusCircle,
  PackagePlus,
  ArrowRight
} from 'lucide-react';
import { calculateTodayLiveCash, getProducts, getBills } from '../services/storage';

interface DashboardProps {
  changeTab: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ changeTab }) => {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayCash: 0,
    todayCreditGiven: 0,
    lowStockCount: 0
  });

  useEffect(() => {
    const { cashSales, creditReceived } = calculateTodayLiveCash();
    const bills = getBills();
    const todayStr = new Date().toISOString().split('T')[0];
    // Exclude Cancelled bills from sales stats
    const todayBills = bills.filter(b => b.date.startsWith(todayStr) && b.status !== 'CANCELLED');
    
    let totalSales = 0;
    let creditGiven = 0;

    todayBills.forEach(b => {
      totalSales += b.grandTotal;
      if (b.paymentMode === 'CREDIT') creditGiven += b.grandTotal;
      if (b.paymentMode === 'MIXED') creditGiven += (b.grandTotal - (b.cashAmount || 0) - (b.upiAmount || 0));
    });

    const products = getProducts();
    const lowStock = products.filter(p => p.stock < 10).length;

    setStats({
      todaySales: totalSales,
      todayCash: cashSales + creditReceived,
      todayCreditGiven: creditGiven,
      lowStockCount: lowStock
    });
  }, []);

  const StatCard = ({ title, value, sub, icon: Icon, colorClass, onClick }: any) => (
    <div 
      onClick={onClick}
      className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 transition-all group ${onClick ? 'cursor-pointer hover:shadow-md hover:border-indigo-100 active:scale-98' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 mt-1">₹{value.toLocaleString('en-IN')}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
          <Icon className={colorClass.replace('bg-', 'text-')} size={24} />
        </div>
      </div>
      {sub && <p className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">{sub}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
        <div className="text-sm text-slate-500">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Today's Sales" 
          value={stats.todaySales} 
          icon={TrendingUp} 
          colorClass="bg-emerald-500 text-emerald-600"
          sub="Tap for detailed analysis"
          onClick={() => changeTab('today-sales')}
        />
        <StatCard 
          title="Cash in Hand (Live)" 
          value={stats.todayCash} 
          icon={Wallet} 
          colorClass="bg-blue-500 text-blue-600"
          sub="Tap for cash ledger"
          onClick={() => changeTab('cash-in-hand')}
        />
        <StatCard 
          title="Credit Given" 
          value={stats.todayCreditGiven} 
          icon={AlertCircle} 
          colorClass="bg-amber-500 text-amber-600"
          sub="Risk for today"
        />
        <StatCard 
          title="Low Stock Items" 
          value={stats.lowStockCount} 
          icon={ShoppingCart} 
          colorClass="bg-rose-500 text-rose-600"
          sub="Items below 10 units"
          onClick={() => changeTab('inventory')}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => changeTab('billing')}
            className="flex flex-col items-center justify-center p-6 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors text-white"
          >
            <PlusCircle size={32} className="mb-2" />
            <span className="font-semibold">New Bill</span>
          </button>
          
          <button 
            onClick={() => changeTab('khata')}
            className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all text-slate-700"
          >
            <Wallet size={32} className="mb-2 text-emerald-600" />
            <span className="font-medium">Credit Entry</span>
          </button>

          <button 
            onClick={() => changeTab('inventory')}
            className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all text-slate-700"
          >
            <PackagePlus size={32} className="mb-2 text-blue-600" />
            <span className="font-medium">Add Stock</span>
          </button>

          <button 
            onClick={() => changeTab('ledger')}
            className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 hover:shadow-md transition-all text-slate-700"
          >
            <ArrowRight size={32} className="mb-2 text-slate-600" />
            <span className="font-medium">Close Day</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;