import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { ShieldCheck, X, Chrome } from 'lucide-react';

interface AuthModalProps {
  onLoginSuccess: (user: UserProfile) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onLoginSuccess,
  onClose
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || 'user@ncbltransport.com',
        displayName: user.displayName || 'Transport User',
        role: selectedRole,
        photoURL: user.photoURL || undefined
      };

      onLoginSuccess(profile);
      onClose();
    } catch (err: any) {
      console.warn('Google sign-in warning:', err);
      setErrorMsg('Google Sign-In failed or was closed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl relative space-y-4">
        
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1">
          <div className="w-10 h-10 bg-blue-700 text-white rounded-lg flex items-center justify-center font-bold mx-auto shadow-xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">NCBL Transport Access</h3>
          <p className="text-xs text-slate-500">
            Secure Role-Based Authentication & Portal Access
          </p>
        </div>

        {/* Role Selector before login */}
        <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1.5">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Select Target Role:</label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(['admin', 'accountant', 'driver'] as const).map(role => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`py-1.5 rounded font-bold capitalize transition-all border text-xs ${
                  selectedRole === role
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 py-2 rounded font-bold transition-all flex items-center justify-center space-x-2 text-xs shadow-xs"
        >
          <Chrome className="w-4 h-4 text-blue-700" />
          <span>{loading ? 'Signing in...' : 'Sign In with Google'}</span>
        </button>

      </div>
    </div>
  );
};
