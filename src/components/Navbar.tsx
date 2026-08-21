import React from 'react';
import { UserProfile, UserRole } from '../types';
import { 
  Truck, ShieldCheck, UserCheck, LogIn, LogOut, PlusCircle, FileText, Menu
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onChangePassword?: () => void;
  onSwitchRole: (role: UserRole) => void;
  onNewInvoice: () => void;
  onToggleSidebarMobile?: () => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenAuth,
  onLogout,
  onChangePassword,
  onSwitchRole,
  onNewInvoice,
  onToggleSidebarMobile,
}) => {
  return (
    <header className="h-12 bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          
          {/* Left Branding & Mobile Toggle */}
          <div className="flex items-center space-x-3">
            <button 
              onClick={onToggleSidebarMobile}
              className="lg:hidden p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none"
              title="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 cursor-pointer">
              <div className="h-7 w-auto flex items-center justify-center">
                <img src="./logo.svg" alt="NCBL Transport" className="h-full object-contain" />
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="hidden sm:inline-block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">
                  Logistics & Tax System
                </span>
                <span className="hidden lg:inline-block text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  Design By Azazmadkiya
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Quick New Invoice Button */}
            {['admin', 'accountant'].includes(currentUser?.role || '') && (
              <button
                onClick={onNewInvoice}
                className="hidden sm:flex items-center space-x-1 bg-blue-700 hover:bg-blue-800 text-white px-2.5 py-1 rounded text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>NEW INVOICE</span>
              </button>
            )}

            {/* Auth / Profile */}
            {currentUser && (
              <div className="flex items-center space-x-2.5 pl-3 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 leading-none">
                    {currentUser.displayName}
                  </div>
                  <div className="text-[10px] font-bold text-blue-700 uppercase flex items-center justify-end space-x-0.5 mt-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    <span>
                      {currentUser.role === 'driver' 
                        ? `Driver (${currentUser.truckNumber || 'GJ-07TU-9190'})` 
                        : currentUser.role === 'admin' 
                        ? 'Administrator' 
                        : currentUser.role === 'accountant' 
                        ? 'Accountant' 
                        : 'Viewer'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center space-x-1"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-xs font-bold hidden md:inline">Sign Out</span>
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
