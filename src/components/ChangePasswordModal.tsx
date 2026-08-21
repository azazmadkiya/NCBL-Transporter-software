import React, { useState } from 'react';
import { AppUserAccount, UserProfile } from '../types';
import { changeUserPassword } from '../services/firestoreService';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | null;
  allUsers?: AppUserAccount[];
  targetUser?: AppUserAccount | null;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  allUsers = [],
  targetUser
}) => {
  // Determine selected target user account
  const activeUser = targetUser || allUsers.find(
    u => u.username.toLowerCase() === (currentUser?.username || currentUser?.email || '').toLowerCase()
  ) || allUsers[0];

  const [selectedUserId, setSelectedUserId] = useState<string>(activeUser?.id || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin' || !currentUser;
  const isEditingOtherUser = Boolean(targetUser) || (selectedUserId && selectedUserId !== currentUser?.uid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation password do not match.');
      return;
    }

    const effectiveTarget = allUsers.find(u => u.id === selectedUserId) || activeUser;
    if (!effectiveTarget) {
      setErrorMsg('User account could not be found.');
      return;
    }

    setLoading(true);
    try {
      // If admin editing another user or resetting, current password verification is bypassed
      const needCurrentPass = !isAdmin && !isEditingOtherUser;
      const res = await changeUserPassword(
        effectiveTarget.id,
        newPassword,
        needCurrentPass ? currentPassword : undefined
      );

      if (res.success) {
        setSuccessMsg(res.message);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-md text-slate-800 shadow-2xl relative space-y-4">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 bg-blue-700 text-white rounded-xl flex items-center justify-center font-bold shadow-xs">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {targetUser ? `Reset Password: ${targetUser.displayName}` : 'Change Account Password'}
            </h3>
            <p className="text-xs text-slate-500">
              Update authentication security credentials
            </p>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs flex items-center space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs flex items-center space-x-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          
          {/* User selector if admin and not locking target */}
          {!targetUser && allUsers.length > 1 && isAdmin && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Select User Account
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 font-semibold focus:border-blue-500 focus:outline-none text-xs"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.username}) — {u.role.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Current Password (if required for non-admin) */}
          {!isAdmin && !isEditingOtherUser && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-10 text-slate-900 focus:border-blue-500 focus:outline-none text-xs font-mono font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                required
                placeholder="Enter new password (min 4 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-10 text-slate-900 focus:border-blue-500 focus:outline-none text-xs font-mono font-medium"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPass ? 'text' : 'password'}
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-10 text-slate-900 focus:border-blue-500 focus:outline-none text-xs font-mono font-medium"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>Password Security Note</span>
            </div>
            <p>
              The new password will be synced to Firestore and immediately active across all devices.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Update Password'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
