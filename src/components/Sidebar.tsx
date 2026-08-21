import React from 'react';
import { UserRole } from '../types';
import { 
  LayoutDashboard, FileText, PlusCircle, Truck, Building2,
  CreditCard, BarChart3, Smartphone, Settings, StickyNote, Tag
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  mobileOpen,
  setMobileOpen
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'accountant', 'viewer']
    },
    {
      id: 'invoices',
      label: 'Transport Invoices & Bills Registry',
      icon: FileText,
      roles: ['admin', 'accountant', 'viewer'],
      badge: 'LR Freight'
    },
    {
      id: 'create_invoice',
      label: 'Create Transport Invoice',
      icon: PlusCircle,
      roles: ['admin', 'accountant'],
      badge: 'LR / Bilty'
    },
    {
      id: 'transporter_ledger',
      label: 'Transporter Party Ledgers',
      icon: Building2,
      roles: ['admin', 'accountant', 'viewer']
    },
    {
      id: 'truck_ledger',
      label: 'Truck Ledger & Vouchers',
      icon: Truck,
      roles: ['admin', 'accountant', 'viewer']
    },
    {
      id: 'payments',
      label: 'Payment Tracker',
      icon: CreditCard,
      roles: ['admin', 'accountant', 'viewer']
    },
    {
      id: 'kasar_ledger',
      label: 'Kasar & Discounts',
      icon: Tag,
      roles: ['admin', 'accountant', 'viewer'],
      badge: 'Kasar'
    },
    {
      id: 'tax_reports',
      label: 'GST & Tax Reports',
      icon: BarChart3,
      roles: ['admin', 'accountant', 'viewer']
    },
    {
      id: 'notes_reminders',
      label: 'Notes & Reminders',
      icon: StickyNote,
      roles: ['admin', 'accountant', 'driver', 'viewer'],
      badge: 'Bhada Rates'
    },
    {
      id: 'driver_mode',
      label: 'Driver Mobile App',
      icon: Smartphone,
      roles: ['admin', 'driver', 'accountant'],
      badge: 'Driver'
    },
    {
      id: 'settings',
      label: 'Company Settings',
      icon: Settings,
      roles: ['admin', 'accountant']
    }
  ];

  const filteredNavs = navItems.filter(item => item.roles.includes(userRole));

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside className={`
        fixed lg:static top-12 bottom-0 left-0 z-40
        w-64 bg-slate-50 border-r border-slate-200 text-slate-700
        transform transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col justify-between shrink-0
      `}>
        <div className="p-3 space-y-1 overflow-y-auto">
          
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 my-2">
            Navigation Menu
          </div>

          {filteredNavs.map((nav) => {
            const Icon = nav.icon;
            const isActive = activeTab === nav.id;

            return (
              <button
                key={nav.id}
                onClick={() => handleNavClick(nav.id)}
                className={`
                  w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-semibold transition-all
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 font-bold border-l-2 border-blue-700' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }
                `}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span>{nav.label}</span>
                </div>
                {nav.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                    isActive ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {nav.badge}
                  </span>
                )}
              </button>
            );
          })}

        </div>

        {/* Bottom Role Info Footer */}
        <div className="p-3 border-t border-slate-200 bg-white space-y-2">
          <div className="bg-blue-900 text-white rounded-lg p-3 text-xs shadow-xs space-y-1">
            <div className="flex items-center justify-between font-bold">
              <span className="text-[10px] text-blue-200 uppercase tracking-wider">Role Access:</span>
              <span className="uppercase text-amber-300 font-black">{userRole}</span>
            </div>
            <p className="text-[10px] text-blue-100/80 leading-snug">
              {userRole === 'admin' && 'Full system control & tax management.'}
              {userRole === 'accountant' && 'Invoicing, party ledgers & payment entries.'}
              {userRole === 'viewer' && 'Read-only access to view reports and data.'}
              {userRole === 'driver' && 'Trip view, advance receipts & expense entry.'}
            </p>
          </div>
          <div className="text-center text-[10px] font-bold text-slate-500 font-mono tracking-tight pt-1">
            Design By <span className="text-blue-700 font-extrabold">Azazmadkiya</span>
          </div>
        </div>
      </aside>
    </>
  );
};
