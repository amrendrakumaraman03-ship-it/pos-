import React from 'react';
import { 
  LayoutDashboard, 
  ReceiptIndianRupee, 
  Package, 
  BookOpenCheck, 
  History, 
  X,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Billing', icon: ReceiptIndianRupee },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'khata', label: 'Khata (Credit)', icon: BookOpenCheck },
    { id: 'ledger', label: 'Daily Ledger', icon: History },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 h-full bg-slate-900 text-white z-30 transition-transform duration-300 ease-in-out
        w-64 flex flex-col shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="p-4 flex justify-between items-center border-b border-slate-700">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-transparent">
              Bharat-POS
            </h1>
            <p className="text-xs text-slate-400">Retail & Pharmacy</p>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id);
                      // On mobile, close drawer after selection
                      if (window.innerWidth < 768) setIsOpen(false);
                    }}
                    className={`
                      w-full flex items-center px-6 py-3 transition-colors relative
                      ${isActive ? 'bg-slate-800 text-orange-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
                    `}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400 rounded-r" />}
                    <Icon size={20} className="mr-3" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <button className="flex items-center text-slate-400 hover:text-white transition-colors w-full">
            <LogOut size={20} className="mr-3" />
            <span>Logout</span>
          </button>
          <div className="mt-4 text-xs text-center text-slate-500">
            v1.0.0 &bull; Secure Local
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
