import React, { useState } from 'react';
import { UserProfile, AppUserAccount } from '../types';
import { getLocalUserAccounts } from '../services/firestoreService';
import { Truck, Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    setTimeout(() => {
      const cleanId = userId.trim().toLowerCase();
      const cleanPass = password.trim();

      // Check against current local/Firestore user account pool
      const users: AppUserAccount[] = getLocalUserAccounts();
      const matched = users.find(
        (u) => u.username.toLowerCase() === cleanId && u.password === cleanPass
      );

      if (matched) {
        const user: UserProfile = {
          uid: matched.id,
          displayName: matched.displayName,
          email: matched.email || `${matched.username}@ncbltransport.com`,
          role: matched.role,
          phone: matched.phone,
          truckNumber: matched.truckNumber,
          driverName: matched.driverName,
          transporterName: matched.transporterName,
          username: matched.username
        };
        localStorage.setItem('nirmala_logged_user', JSON.stringify(user));
        localStorage.setItem('ncbl_logged_user', JSON.stringify(user));
        onLoginSuccess(user);
      } else if (cleanId === 'azazmadkiya' && cleanPass === '9687709315') {
        const user: UserProfile = {
          uid: 'user-azazmadkiya',
          displayName: 'Azazmadkiya',
          email: 'azazmadkiya@ncbltransport.com',
          role: 'admin',
          username: 'azazmadkiya'
        };
        localStorage.setItem('nirmala_logged_user', JSON.stringify(user));
        localStorage.setItem('ncbl_logged_user', JSON.stringify(user));
        onLoginSuccess(user);
      } else {
        setErrorMsg('Invalid User ID or Password. Please try again.');
        setLoading(false);
      }
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 overflow-hidden relative z-10">
        
        {/* Top Header Banner */}
        <div className="bg-white border-b border-slate-200 text-slate-800 p-6 text-center space-y-2">
          <div className="w-auto h-16 flex items-center justify-center mx-auto mb-2">
            <img src="./logo.svg" alt="NCBL Transport Logo" className="h-full object-contain drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase text-blue-900 hidden">NCBL Transport</h1>
            <p className="text-xs text-slate-500 font-bold mt-0.5">Fleet Logistics & Tax Billing System</p>
          </div>
        </div>

        {/* Login Form Body */}
        <div className="p-6 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-slate-900">Sign In to Your Account</h2>
            <p className="text-xs text-slate-500">Enter your credentials to access the portal</p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                User ID / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter User ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-98 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center space-x-2 mt-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center text-[10px] text-slate-500 font-mono space-y-0.5">
          <div>NCBL TRANSPORT PORTAL • SECURE ACCESS</div>
          <div className="font-bold text-blue-700 tracking-wide text-[11px]">Design By Azazmadkiya</div>
        </div>

      </div>
    </div>
  );
};
