import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Inventory from './pages/Inventory';
import Ledger from './pages/Ledger';
import Khata from './pages/Khata';
import TodaySales from './pages/TodaySales';
import CashInHand from './pages/CashInHand';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard changeTab={setActiveTab} />;
      case 'today-sales': return <TodaySales changeTab={setActiveTab} />;
      case 'cash-in-hand': return <CashInHand changeTab={setActiveTab} />;
      case 'billing': return <Billing />;
      case 'inventory': return <Inventory />;
      case 'ledger': return <Ledger />;
      case 'khata': return <Khata />;
      default: return <Dashboard changeTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300 md:ml-64">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="mr-3 text-slate-600">
              <Menu size={24} />
            </button>
            <span className="font-bold text-slate-800">Bharat-POS</span>
          </div>
          <div className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded">
            {activeTab === 'today-sales' ? 'SALES' : activeTab === 'cash-in-hand' ? 'CASH' : activeTab.toUpperCase()}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;