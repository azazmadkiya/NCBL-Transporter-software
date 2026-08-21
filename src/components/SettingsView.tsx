import React, { useState } from 'react';
import { CompanySettings, Invoice, Party, Vehicle, Expense, UserProfile, AppUserAccount, UserRole } from '../types';
import { 
  Settings, Building2, CreditCard, Save, CheckCircle2, 
  Database, Download, Upload, FileJson, AlertCircle, RefreshCw, X, FileCheck,
  ShieldCheck, KeyRound, User, Lock, Plus, Edit2, Trash2, Users, Truck
} from 'lucide-react';
import { 
  exportFirestoreBackup, restoreFirestoreBackup, TransportBackupData,
  saveUserAccount, deleteUserAccount
} from '../services/firestoreService';
import { ChangePasswordModal } from './ChangePasswordModal';

interface SettingsViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
  currentUser?: UserProfile | null;
  allUsers?: AppUserAccount[];
  invoices?: Invoice[];
  parties?: Party[];
  vehicles?: Vehicle[];
  expenses?: Expense[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  currentUser = null,
  allUsers = [],
  invoices = [],
  parties = [],
  vehicles = [],
  expenses = []
}) => {
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // User & Password Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [targetPasswordUser, setTargetPasswordUser] = useState<AppUserAccount | null>(null);

  // Add/Edit User Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUserAccount | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<AppUserAccount>>({
    username: '',
    displayName: '',
    email: '',
    password: '',
    role: 'viewer',
    phone: '',
    truckNumber: '',
    driverName: '',
    transporterName: ''
  });
  const [userSaveMsg, setUserSaveMsg] = useState<string | null>(null);

  // Backup & Restore states
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);
  const [pendingImportData, setPendingImportData] = useState<TransportBackupData | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      displayName: '',
      email: '',
      password: '',
      role: 'driver',
      phone: '',
      truckNumber: vehicles[0]?.vehicleNumber || '',
      driverName: vehicles[0]?.driverName || '',
      transporterName: ''
    });
    setUserSaveMsg(null);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (user: AppUserAccount) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      password: user.password,
      role: user.role,
      phone: user.phone || '',
      truckNumber: user.truckNumber || '',
      driverName: user.driverName || '',
      transporterName: user.transporterName || ''
    });
    setUserSaveMsg(null);
    setShowUserModal(true);
  };

  const handleSaveUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.username?.trim() || !userFormData.password?.trim()) {
      alert('Username and Password are required.');
      return;
    }

    const cleanUsername = userFormData.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const userToSave: AppUserAccount = {
      id: editingUser ? editingUser.id : `user-${cleanUsername}`,
      username: cleanUsername,
      displayName: userFormData.displayName?.trim() || cleanUsername,
      email: userFormData.email?.trim() || `${cleanUsername}@ncbltransport.com`,
      password: userFormData.password.trim(),
      role: (userFormData.role as UserRole) || 'viewer',
      phone: userFormData.phone?.trim() || '',
      truckNumber: userFormData.truckNumber?.trim().toUpperCase() || '',
      driverName: userFormData.driverName?.trim().toUpperCase() || '',
      transporterName: userFormData.transporterName?.trim().toUpperCase() || '',
      updatedAt: new Date().toISOString()
    };

    await saveUserAccount(userToSave);
    setUserSaveMsg('User account saved successfully!');
    setTimeout(() => {
      setShowUserModal(false);
      setUserSaveMsg(null);
    }, 1000);
  };

  const handleDeleteUserClick = async (userId: string, username: string) => {
    if (username.toLowerCase() === 'azazmadkiya') {
      alert('Primary administrator account "azazmadkiya" cannot be deleted.');
      return;
    }
    if (confirm(`Are you sure you want to delete user account "${username}"?`)) {
      await deleteUserAccount(userId);
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    setBackupSuccessMessage(null);
    setImportErrorMessage(null);

    try {
      const backupData = await exportFirestoreBackup({
        invoices,
        parties,
        vehicles,
        expenses,
        settings: formData
      });

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `ncbl_transport_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupSuccessMessage(
        `Backup exported successfully! Downloaded ${backupData.invoices?.length || 0} Invoices, ${backupData.parties?.length || 0} Parties, ${backupData.vehicles?.length || 0} Vehicles, ${backupData.expenses?.length || 0} Expenses.`
      );
    } catch (err) {
      console.error('Export error:', err);
      setImportErrorMessage('Failed to generate database backup file.');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportErrorMessage(null);
    setBackupSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let parsed = JSON.parse(event.target?.result as string);

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Selected file is not a valid JSON object.');
        }

        // If wrapped in { data: ... }
        if (parsed.data && typeof parsed.data === 'object') {
          parsed = parsed.data;
        }

        // Check if any recognized collection exists
        const hasValidContent = 
          Array.isArray(parsed.invoices) ||
          Array.isArray(parsed.bills) ||
          Array.isArray(parsed.parties) ||
          Array.isArray(parsed.transporters) ||
          Array.isArray(parsed.customers) ||
          Array.isArray(parsed.vehicles) ||
          Array.isArray(parsed.trucks) ||
          Array.isArray(parsed.expenses) ||
          Array.isArray(parsed.products) ||
          Array.isArray(parsed.stockProducts) ||
          Array.isArray(parsed.stock_transactions) ||
          Array.isArray(parsed.stockTransactions) ||
          Array.isArray(parsed.notes_reminders) ||
          Array.isArray(parsed.notes) ||
          Array.isArray(parsed.reminders) ||
          Array.isArray(parsed.app_users) ||
          Array.isArray(parsed.users) ||
          Boolean(parsed.settings || parsed.companySettings || parsed.company_profile) ||
          Array.isArray(parsed);

        if (!hasValidContent) {
          throw new Error('Invalid transport backup file: No recognizeable invoices, parties, vehicles, expenses, products, or settings found.');
        }

        // Normalize if root is array
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && ('invoiceNumber' in parsed[0] || 'totalAmount' in parsed[0])) {
            parsed = { invoices: parsed };
          } else if (parsed.length > 0 && ('truckNumber' in parsed[0] || 'registrationNumber' in parsed[0])) {
            parsed = { vehicles: parsed };
          } else if (parsed.length > 0 && ('companyName' in parsed[0] || 'partyCode' in parsed[0])) {
            parsed = { parties: parsed };
          } else {
            parsed = { invoices: parsed };
          }
        }

        setPendingImportData(parsed as TransportBackupData);
        setShowImportConfirm(true);
      } catch (err) {
        setImportErrorMessage(err instanceof Error ? err.message : 'Failed to parse JSON backup file.');
        setPendingImportData(null);
      }
    };

    reader.onerror = () => {
      setImportErrorMessage('Error reading selected file.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = async () => {
    if (!pendingImportData) return;

    setImporting(true);
    setImportErrorMessage(null);
    setBackupSuccessMessage(null);

    try {
      const result = await restoreFirestoreBackup(pendingImportData);

      const summaryParts = [
        result.invoicesCount > 0 ? `${result.invoicesCount} Invoices` : null,
        result.partiesCount > 0 ? `${result.partiesCount} Parties` : null,
        result.vehiclesCount > 0 ? `${result.vehiclesCount} Vehicles` : null,
        result.expensesCount > 0 ? `${result.expensesCount} Expenses` : null,
        result.productsCount > 0 ? `${result.productsCount} Products` : null,
        result.stockTxCount > 0 ? `${result.stockTxCount} Stock Entries` : null,
        result.notesCount > 0 ? `${result.notesCount} Notes` : null,
        result.usersCount > 0 ? `${result.usersCount} Users` : null,
        result.settingsUpdated ? `Company Profile` : null
      ].filter(Boolean);

      setBackupSuccessMessage(
        summaryParts.length > 0
          ? `Data Restored Successfully! Restored: ${summaryParts.join(', ')} to Firestore database.`
          : 'Data restoration completed successfully!'
      );
      setShowImportConfirm(false);
      setPendingImportData(null);
    } catch (err) {
      console.error('Restore error:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to restore data to Firestore.';
      setImportErrorMessage(`${errMsg} Please check your connection and try again.`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <Settings className="w-4 h-4 text-blue-700" />
            <span>Transport Company Profile & Billing Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure GSTIN, PAN, registered office address, bank account details for invoice footers & print terms.
          </p>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-2.5 py-1 rounded font-bold flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Company Profile Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-100 pb-2">
            <Building2 className="w-3.5 h-3.5 text-blue-700" />
            <span>Transport Entity Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 font-bold mb-0.5">Transport Company Name *</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-0.5">Tagline / Slogan</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-0.5">Transport GSTIN *</label>
              <input
                type="text"
                required
                value={formData.gstin}
                onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-0.5">PAN Number *</label>
              <input
                type="text"
                required
                value={formData.pan}
                onChange={e => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-0.5">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-0.5">Billing Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-500 font-bold mb-0.5">Office Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-0.5">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-0.5">State & Pincode</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.state}
                  onChange={e => setFormData({ ...formData, state: e.target.value })}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none"
                />
                <input
                  type="text"
                  value={formData.pincode}
                  onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                  className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit Save Transport Details */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded transition-all shadow-xs flex items-center space-x-1.5 text-xs"
            >
              <Save className="w-4 h-4" />
              <span>Save Transport Entity Details</span>
            </button>
          </div>
        </div>

      </form>

      {/* User Accounts & Password Security Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>User Accounts & Password Security</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Manage login credentials, user access roles, and change passwords
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setTargetPasswordUser(null);
                setShowPasswordModal(true);
              }}
              className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change My Password</span>
            </button>

            {['admin'].includes(currentUser?.role || '') && (
              <button
                type="button"
                onClick={handleOpenAddUser}
                className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add User</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Active User Info Card */}
        {currentUser && (
          <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-blue-700 text-white rounded-lg flex items-center justify-center font-bold shadow-xs">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900 flex items-center space-x-2">
                  <span>{currentUser.displayName}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-mono font-bold px-1.5 py-0.5 rounded">
                    @{currentUser.username || currentUser.displayName?.toLowerCase().replace(/\s+/g, '')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex items-center space-x-2 mt-0.5">
                  <span>Role: <strong className="text-blue-800 uppercase font-semibold">{currentUser.role}</strong></span>
                  <span>•</span>
                  <span>{currentUser.email}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setTargetPasswordUser(null);
                setShowPasswordModal(true);
              }}
              className="bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 font-bold px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-700" />
              <span>Update Password</span>
            </button>
          </div>
        )}

        {/* User Accounts Directory Table (Visible to Admin) */}
        {['admin'].includes(currentUser?.role || '') && allUsers.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>All System Users ({allUsers.length})</span>
              </span>
              <button
                type="button"
                onClick={handleOpenAddUser}
                className="bg-blue-700 hover:bg-blue-800 text-white px-2.5 py-1 rounded text-xs font-bold transition-all shadow-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add User Account</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">User / Name</th>
                    <th className="p-2.5">User ID / Login</th>
                    <th className="p-2.5">Role & Assignment</th>
                    <th className="p-2.5">Phone / Email</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-medium">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-bold text-slate-900">
                        <div>{u.displayName}</div>
                        {u.role === 'driver' && (u.driverName || u.transporterName) && (
                          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                            Driver: {u.driverName || u.transporterName}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-blue-700 font-bold">
                        @{u.username}
                      </td>
                      <td className="p-2.5">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : u.role === 'accountant' 
                              ? 'bg-blue-100 text-blue-800' 
                              : u.role === 'driver' 
                              ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {u.role === 'driver' ? 'Driver Portal' : u.role}
                          </span>
                          {u.role === 'driver' && u.truckNumber && (
                            <div className="text-[10px] font-mono font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center space-x-1">
                              <span>TRUCK: {u.truckNumber}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px]">
                        <div>{u.phone || '—'}</div>
                        <div className="text-[10px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetPasswordUser(u);
                              setShowPasswordModal(true);
                            }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-1.5 rounded transition-colors"
                            title={`Change Password for ${u.displayName}`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditUser(u)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded transition-colors"
                            title="Edit User Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {u.username.toLowerCase() !== 'azazmadkiya' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUserClick(u.id, u.username)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Database Backup & Import Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
            <Database className="w-4 h-4 text-blue-700" />
            <span>Data Management (Firestore Manual Backup & Import)</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            {invoices.length} Invoices | {parties.length} Parties | {vehicles.length} Trucks | {expenses.length} Expenses
          </span>
        </div>

        {/* Success / Error Notification Banners */}
        {backupSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{backupSuccessMessage}</div>
            <button 
              onClick={() => setBackupSuccessMessage(null)}
              className="text-emerald-600 hover:text-emerald-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {importErrorMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{importErrorMessage}</div>
            <button 
              onClick={() => setImportErrorMessage(null)}
              className="text-amber-600 hover:text-amber-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          {/* Export / Backup Block */}
          <div className="border border-slate-200 bg-slate-50/50 p-3.5 rounded-lg space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Download className="w-4 h-4 text-blue-700" />
                <span>Export Firestore Backup (JSON)</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Download a structured JSON copy of all transport invoices, party ledgers, truck profiles, trip expenses, and billing settings.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              disabled={exporting}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 px-3 rounded transition-all shadow-xs flex items-center justify-center space-x-1.5 text-xs"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Backup...</span>
                </>
              ) : (
                <>
                  <FileJson className="w-3.5 h-3.5" />
                  <span>Download Backup (.json)</span>
                </>
              )}
            </button>
          </div>

          {/* Import / Restore Block */}
          <div className="border border-slate-200 bg-slate-50/50 p-3.5 rounded-lg space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Upload className="w-4 h-4 text-blue-700" />
                <span>Restore / Import Data from JSON</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Select a previously saved `.json` transport backup file to restore or merge records directly into Firestore.
              </p>
            </div>

            <label className="w-full mt-2 cursor-pointer bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold py-2 px-3 rounded transition-all shadow-xs flex items-center justify-center space-x-1.5 text-xs">
              <FileCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>Select Backup JSON File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

        </div>

      </div>

      {/* Confirmation Modal for Restore */}
      {showImportConfirm && pendingImportData && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-lg text-slate-800 shadow-xl relative space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Upload className="w-4 h-4 text-blue-700" />
                <span>Confirm Database Restoration</span>
              </h3>
              <button 
                onClick={() => setShowImportConfirm(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded space-y-1">
              <div className="font-bold flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Notice before restoring:</span>
              </div>
              <p className="text-[11px] text-amber-900">
                This will merge/update matching document IDs into your Firestore database ({pendingImportData.companyName || 'Transport App'}).
              </p>
            </div>

            {/* Content summary */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2 text-xs">
              <div className="font-bold text-slate-800 border-b border-slate-200 pb-1">
                Backup File Details
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                <div>
                  Export Date: <strong className="text-slate-800 font-mono">{pendingImportData.exportedAt ? new Date(pendingImportData.exportedAt).toLocaleString() : 'Unknown'}</strong>
                </div>
                <div>
                  Version: <strong className="text-slate-800 font-mono">{pendingImportData.version || '1.0'}</strong>
                </div>
                <div>
                  Invoices: <strong className="text-blue-700 font-bold">{(pendingImportData.invoices || pendingImportData.bills)?.length || 0}</strong>
                </div>
                <div>
                  Parties: <strong className="text-blue-700 font-bold">{(pendingImportData.parties || pendingImportData.transporters || pendingImportData.customers)?.length || 0}</strong>
                </div>
                <div>
                  Vehicles / Trucks: <strong className="text-blue-700 font-bold">{(pendingImportData.vehicles || pendingImportData.trucks)?.length || 0}</strong>
                </div>
                <div>
                  Expenses: <strong className="text-blue-700 font-bold">{pendingImportData.expenses?.length || 0}</strong>
                </div>
                <div>
                  Stock Products: <strong className="text-blue-700 font-bold">{(pendingImportData.products || pendingImportData.stockProducts || pendingImportData.items)?.length || 0}</strong>
                </div>
                <div>
                  Notes / Reminders: <strong className="text-blue-700 font-bold">{(pendingImportData.notes_reminders || pendingImportData.notes || pendingImportData.reminders)?.length || 0}</strong>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportConfirm(false)}
                disabled={importing}
                className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={importing}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded transition-all shadow-xs flex items-center space-x-1.5 text-xs"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Restoring to Firestore...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    <span>Confirm Restore Data</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setTargetPasswordUser(null);
        }}
        currentUser={currentUser}
        allUsers={allUsers}
        targetUser={targetPasswordUser}
      />

      {/* Add / Edit User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-md text-slate-800 shadow-2xl relative space-y-4">
            
            <button
              onClick={() => setShowUserModal(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
              <div className="w-9 h-9 bg-blue-700 text-white rounded-lg flex items-center justify-center font-bold shadow-xs">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingUser ? 'Edit User Account' : 'Create New User Account'}
                </h3>
                <p className="text-xs text-slate-500">System credentials and access role</p>
              </div>
            </div>

            {userSaveMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded text-xs flex items-center space-x-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{userSaveMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveUserSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Singh"
                  value={userFormData.displayName || ''}
                  onChange={(e) => setUserFormData({ ...userFormData, displayName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-semibold focus:border-blue-500 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Username / Login ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingUser?.username?.toLowerCase() === 'azazmadkiya'}
                    placeholder="e.g. rameshsingh"
                    value={userFormData.username || ''}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                    className="w-full bg-white border border-slate-300 disabled:bg-slate-100 rounded-lg p-2.5 text-slate-900 font-mono font-bold focus:border-blue-500 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Set Password"
                    value={userFormData.password || ''}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono font-bold focus:border-blue-500 focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Access Rights Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[10.5px]">
                  User Access Rights & Permissions <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUserFormData({ ...userFormData, role: 'admin' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      userFormData.role === 'admin'
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-500'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                      <span>Full Rights (Admin)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Full access to create, edit, delete, users, backup & settings
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserFormData({ ...userFormData, role: 'viewer' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      userFormData.role === 'viewer'
                        ? 'border-slate-800 bg-slate-100 text-slate-900 ring-1 ring-slate-700'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-600" />
                      <span>Only View (Viewer)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Read-only access to ledgers & reports (No add / edit / delete)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserFormData({ ...userFormData, role: 'accountant' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      userFormData.role === 'accountant'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center space-x-1">
                      <FileCheck className="w-3.5 h-3.5 text-blue-700" />
                      <span>Billing & Ledger</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Create/edit invoices, tax bills, record payments & reports
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserFormData({ ...userFormData, role: 'driver' })}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      userFormData.role === 'driver'
                        ? 'border-amber-600 bg-amber-50 text-amber-900 ring-1 ring-amber-500'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-amber-700" />
                      <span>Driver Trips Mode</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Mobile portal for single truck trip logging & expenses
                    </p>
                  </button>
                </div>
              </div>

              {/* Driver Assignment Section (When role is driver) */}
              {userFormData.role === 'driver' && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-1.5">
                    <span className="font-bold text-amber-950 uppercase tracking-wider text-[10.5px] flex items-center space-x-1.5">
                      <Truck className="w-3.5 h-3.5 text-amber-700" />
                      <span>Driver & Vehicle Assignment</span>
                    </span>
                    <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                      One-Vehicle Access
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-amber-900 mb-1">
                        Assigned Truck / Vehicle No. <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-1">
                        {vehicles.length > 0 && (
                          <select
                            value={userFormData.truckNumber || ''}
                            onChange={(e) => {
                              const selTruck = e.target.value;
                              const matchedV = vehicles.find(v => v.vehicleNumber === selTruck);
                              setUserFormData({
                                ...userFormData,
                                truckNumber: selTruck,
                                driverName: userFormData.driverName || matchedV?.driverName || ''
                              });
                            }}
                            className="w-full bg-white border border-amber-300 rounded p-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 text-xs mb-1"
                          >
                            <option value="">-- Select Registered Truck --</option>
                            {vehicles.map(v => (
                              <option key={v.id} value={v.vehicleNumber}>
                                {v.vehicleNumber} ({v.driverName || 'No Driver'} - {v.vehicleType || 'Truck'})
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          required
                          placeholder="e.g. GJ-07TU-9190"
                          value={userFormData.truckNumber || ''}
                          onChange={(e) => setUserFormData({ ...userFormData, truckNumber: e.target.value.toUpperCase() })}
                          className="w-full bg-white border border-amber-300 rounded p-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 text-xs uppercase"
                        />
                      </div>
                      <span className="text-[9.5px] text-amber-800/80">Select from fleet or type truck number</span>
                    </div>

                    <div>
                      <label className="block font-bold text-amber-900 mb-1">
                        Driver Name / Transporter Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ramesh Singh or Fleet Driver"
                        value={userFormData.driverName || ''}
                        onChange={(e) => setUserFormData({ 
                          ...userFormData, 
                          driverName: e.target.value.toUpperCase(),
                          displayName: userFormData.displayName || e.target.value 
                        })}
                        className="w-full bg-white border border-amber-300 rounded p-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500 text-xs uppercase"
                      />
                      <span className="text-[9.5px] text-amber-800/80">Driver or Transporter Firm Name</span>
                    </div>
                  </div>

                  <div className="bg-amber-100/60 border border-amber-300/60 rounded p-2 text-[10.5px] text-amber-950 font-medium leading-relaxed flex items-start space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-800 shrink-0 mt-0.5" />
                    <div>
                      <strong>Strict Data Isolation:</strong> This driver will strictly <strong>ONLY</strong> see trips, LR details, and fuel/trip expenses for vehicle <strong>{userFormData.truckNumber || 'Assigned Truck'}</strong> ({userFormData.driverName || 'Driver Name'}). All customer ledgers and other fleet data are blocked.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={userFormData.phone || ''}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:border-blue-500 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="user@ncbltransport.com"
                    value={userFormData.email || ''}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:border-blue-500 focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg shadow-xs flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingUser ? 'Update User Account' : 'Create User Account'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};

