import React, { useState, useMemo } from 'react';
import { Party, UserRole, INDIAN_STATES } from '../types';
import { 
  Building2, Users, MapPin, Phone, Mail, FileText, Plus, Search, 
  Edit, Trash2, ArrowRight, Shield, Download, Printer, CheckCircle2, 
  Layers, Truck, User, ArrowUpRight, Check, X, Filter, Navigation
} from 'lucide-react';

interface PartyPresetsManagerProps {
  userRole?: UserRole;
  parties: Party[];
  onAddParty: (party: Party) => Promise<void>;
  onEditParty: (party: Party) => Promise<void>;
  onDeleteParty: (partyId: string) => Promise<void>;
  onUseInInvoice?: (party: Party, targetSection: 'consignee' | 'shipto' | 'dispatched') => void;
}

export const PartyPresetsManager: React.FC<PartyPresetsManagerProps> = ({
  userRole = 'admin',
  parties,
  onAddParty,
  onEditParty,
  onDeleteParty,
  onUseInInvoice
}) => {
  const [activeSection, setActiveSection] = useState<'consignee_shipto' | 'dispatched'>('consignee_shipto');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStateFilter, setSelectedStateFilter] = useState('');
  const [subTypeFilter, setSubTypeFilter] = useState<'all' | 'consignee' | 'shipto'>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [targetPresetType, setTargetPresetType] = useState<'consignee_shipto' | 'dispatched'>('consignee_shipto');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    partyUser: '',
    gstin: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'GUJARAT',
    stateCode: '24',
    partyType: 'both' as Party['partyType'],
    openingBalance: 0,
    notes: ''
  });

  const isReadOnly = userRole === 'viewer';

  // Helper to get parties for Section 1: Consignee & Ship To
  const consigneeShipToParties = useMemo(() => {
    return parties.filter(p => {
      // Exclude pure transporters
      if (p.accountCategory === 'transporter' || p.partyType === 'transporter') return false;
      return true;
    });
  }, [parties]);

  // Helper to get parties for Section 2: Dispatched Party (Shipped From / Loading Site)
  const dispatchedParties = useMemo(() => {
    return parties.filter(p => {
      if (p.accountCategory === 'transporter' || p.partyType === 'transporter') return false;
      return true;
    });
  }, [parties]);

  // Filtered lists based on search & filters
  const filteredConsigneeShipTo = useMemo(() => {
    return consigneeShipToParties.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        p.name.toLowerCase().includes(q) ||
        (p.partyUser && p.partyUser.toLowerCase().includes(q)) ||
        (p.gstin && p.gstin.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q));

      const matchState = selectedStateFilter ? p.state === selectedStateFilter : true;
      const matchType = subTypeFilter === 'all' ? true : 
        subTypeFilter === 'consignee' ? (p.partyType === 'consignee' || p.partyType === 'both') :
        subTypeFilter === 'shipto' ? (p.partyType === 'shipto' || p.partyType === 'both' || p.partyType === 'consignee') : true;

      return matchSearch && matchState && matchType;
    });
  }, [consigneeShipToParties, searchQuery, selectedStateFilter, subTypeFilter]);

  const filteredDispatched = useMemo(() => {
    return dispatchedParties.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = 
        p.name.toLowerCase().includes(q) ||
        (p.partyUser && p.partyUser.toLowerCase().includes(q)) ||
        (p.gstin && p.gstin.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q));

      const matchState = selectedStateFilter ? p.state === selectedStateFilter : true;
      return matchSearch && matchState;
    });
  }, [dispatchedParties, searchQuery, selectedStateFilter]);

  // Handle GSTIN Input & Auto-State Detection
  const handleGSTINChange = (gstVal: string) => {
    const upper = gstVal.toUpperCase().trim();
    let updatedState = formData.state;
    let updatedCode = formData.stateCode;

    if (upper.length >= 2) {
      const code = upper.substring(0, 2);
      const matched = INDIAN_STATES.find(s => s.code === code);
      if (matched) {
        updatedState = matched.name.toUpperCase();
        updatedCode = matched.code;
      }
    }

    setFormData(prev => ({
      ...prev,
      gstin: upper,
      state: updatedState,
      stateCode: updatedCode
    }));
  };

  const handleOpenAddModal = (section: 'consignee_shipto' | 'dispatched') => {
    setTargetPresetType(section);
    setModalMode('add');
    setEditingId(null);
    setFormData({
      name: '',
      partyUser: '',
      gstin: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      state: 'GUJARAT',
      stateCode: '24',
      partyType: section === 'dispatched' ? 'dispatched' : 'both',
      openingBalance: 0,
      notes: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (party: Party, section: 'consignee_shipto' | 'dispatched') => {
    setTargetPresetType(section);
    setModalMode('edit');
    setEditingId(party.id);
    setFormData({
      name: party.name || '',
      partyUser: party.partyUser || '',
      gstin: party.gstin || '',
      phone: party.phone || '',
      email: party.email || '',
      address: party.address || '',
      city: party.city || '',
      state: party.state || 'GUJARAT',
      stateCode: party.stateCode || '24',
      partyType: party.partyType || (section === 'dispatched' ? 'dispatched' : 'both'),
      openingBalance: party.openingBalance || 0,
      notes: party.notes || ''
    });
    setShowModal(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter Party / Profile Name');
      return;
    }

    if (modalMode === 'add') {
      const newParty: Party = {
        id: `preset-${Date.now()}`,
        name: formData.name.trim(),
        partyUser: formData.partyUser.trim(),
        gstin: formData.gstin.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state,
        stateCode: formData.stateCode,
        partyType: formData.partyType,
        presetCategory: targetPresetType === 'dispatched' ? 'dispatched_party' : 'consignee_shipto',
        accountCategory: 'party',
        accountGroup: 'sundry_debtors',
        openingBalance: Number(formData.openingBalance) || 0,
        currentBalance: Number(formData.openingBalance) || 0,
        notes: formData.notes.trim(),
        createdAt: new Date().toISOString()
      };
      await onAddParty(newParty);
    } else if (editingId) {
      const existing = parties.find(p => p.id === editingId);
      if (existing) {
        const updated: Party = {
          ...existing,
          name: formData.name.trim(),
          partyUser: formData.partyUser.trim(),
          gstin: formData.gstin.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state,
          stateCode: formData.stateCode,
          partyType: formData.partyType || existing.partyType || 'both',
          presetCategory: existing.presetCategory || (targetPresetType === 'dispatched' ? 'dispatched_party' : 'consignee_shipto'),
          accountCategory: existing.accountCategory || 'party',
          accountGroup: existing.accountGroup || 'sundry_debtors',
          openingBalance: Number(formData.openingBalance) || 0,
          notes: formData.notes.trim()
        };
        await onEditParty(updated);
      }
    }

    setShowModal(false);
  };

  const handleDelete = async (party: Party) => {
    if (window.confirm(`Are you sure you want to delete preset profile "${party.name}"?`)) {
      await onDeleteParty(party.id);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Party Profiles & Custom Presets</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Manage destination receivers, delivery site presets & dispatched loading yards with contact Party Users.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {!isReadOnly && (
            <button
              onClick={() => handleOpenAddModal(activeSection)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeSection === 'consignee_shipto' 
                  ? 'Add Consignee / Ship To Preset' 
                  : 'Add Dispatched Party Preset'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 2 Main Sections Nav Tabs */}
      <div className="bg-slate-100/80 p-1 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <button
          onClick={() => {
            setActiveSection('consignee_shipto');
            setSearchQuery('');
          }}
          className={`py-3 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center space-x-2.5 transition-all ${
            activeSection === 'consignee_shipto'
              ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <MapPin className="w-4 h-4 text-blue-600" />
          <div className="text-left">
            <div className="font-extrabold leading-tight">Section 1: Consignee & Ship To (Delivery Sites)</div>
            <div className="text-[11px] font-normal text-slate-500">Receiver at Destination & Delivery Site Presets with Party User</div>
          </div>
          <span className="ml-auto bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {consigneeShipToParties.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveSection('dispatched');
            setSearchQuery('');
          }}
          className={`py-3 px-4 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center space-x-2.5 transition-all ${
            activeSection === 'dispatched'
              ? 'bg-white text-amber-800 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Truck className="w-4 h-4 text-amber-600" />
          <div className="text-left">
            <div className="font-extrabold leading-tight">Section 2: Dispatched Party (Shipped From)</div>
            <div className="text-[11px] font-normal text-slate-500">Loading Sites, Plant Gates & Loading Supervisors</div>
          </div>
          <span className="ml-auto bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {dispatchedParties.length}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeSection === 'consignee_shipto'
                ? "Search by Receiver Name, Party User, GSTIN, Phone, Address, City..."
                : "Search by Loading Site Name, Loading Incharge, GSTIN, Address, City..."
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSection === 'consignee_shipto' && (
            <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-bold text-slate-600 border border-slate-200">
              <button
                onClick={() => setSubTypeFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${subTypeFilter === 'all' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'}`}
              >
                All ({consigneeShipToParties.length})
              </button>
              <button
                onClick={() => setSubTypeFilter('consignee')}
                className={`px-2.5 py-1 rounded-md transition-all ${subTypeFilter === 'consignee' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Consignee (Receiver)
              </button>
              <button
                onClick={() => setSubTypeFilter('shipto')}
                className={`px-2.5 py-1 rounded-md transition-all ${subTypeFilter === 'shipto' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Ship To (Site)
              </button>
            </div>
          )}

          <select
            value={selectedStateFilter}
            onChange={e => setSelectedStateFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none"
          >
            <option value="">All States</option>
            {INDIAN_STATES.map(s => (
              <option key={s.code} value={s.name.toUpperCase()}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Presets List View */}
      {activeSection === 'consignee_shipto' ? (
        // SECTION 1: CONSIGNEE & SHIP TO PRESETS
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>Showing {filteredConsigneeShipTo.length} Consignee & Ship To Presets</span>
            <span className="text-blue-600 font-bold">Auto-fills in Create Transport Invoice & LR</span>
          </div>

          {filteredConsigneeShipTo.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Consignee or Ship To Presets Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Add preset profiles for destination receivers and delivery sites to save time when creating transport bills.
              </p>
              {!isReadOnly && (
                <button
                  onClick={() => handleOpenAddModal('consignee_shipto')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Consignee / Ship To Preset</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredConsigneeShipTo.map((party) => (
                <div 
                  key={party.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 shadow-xs hover:shadow-md transition-all p-4 flex flex-col justify-between relative group"
                >
                  <div>
                    {/* Header with Type Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="font-black text-slate-900 text-sm">{party.name}</span>
                        </div>
                        {party.city && (
                          <div className="text-[11px] font-semibold text-slate-500 flex items-center space-x-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{party.city}, {party.state}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-1">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                          {party.partyType === 'shipto' ? 'Ship To Site' : party.partyType === 'consignee' ? 'Consignee' : 'Receiver / Site'}
                        </span>
                      </div>
                    </div>

                    {/* Prominent Party User Field */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 my-2.5">
                      <div className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center space-x-1 mb-1">
                        <User className="w-3 h-3 text-blue-600" />
                        <span>Party User (Receiver Contact / Site Incharge)</span>
                      </div>
                      {party.partyUser ? (
                        <div className="text-xs font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200">
                          {party.partyUser}
                        </div>
                      ) : (
                        <div className="text-xs italic text-slate-400">
                          No Party User specified (Click Edit to add)
                        </div>
                      )}
                    </div>

                    {/* Address & GSTIN Details */}
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {party.gstin && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">GSTIN:</span>
                          <span className="font-mono font-bold text-slate-800">{party.gstin}</span>
                        </div>
                      )}

                      {party.phone && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">Phone / Mobile:</span>
                          <span className="font-semibold text-slate-800 flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{party.phone}</span>
                          </span>
                        </div>
                      )}

                      {party.address && (
                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 line-clamp-2">
                          <span className="font-semibold text-slate-700">Delivery Address: </span>
                          {party.address}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1">
                      {!isReadOnly && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(party, 'consignee_shipto')}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            title="Edit Preset"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(party)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete Preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>

                    {onUseInInvoice && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onUseInInvoice(party, 'consignee')}
                          className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors flex items-center space-x-0.5"
                          title="Apply as Consignee in New Invoice"
                        >
                          <span>Use Consignee</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onUseInInvoice(party, 'shipto')}
                          className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 transition-colors flex items-center space-x-0.5"
                          title="Apply as Ship To in New Invoice"
                        >
                          <span>Use Ship To</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // SECTION 2: DISPATCHED PARTY (SHIPPED FROM / LOADING SITES)
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>Showing {filteredDispatched.length} Dispatched Party / Loading Site Presets</span>
            <span className="text-amber-700 font-bold">Auto-fills in Create Transport Invoice & LR</span>
          </div>

          {filteredDispatched.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Dispatched Party Presets Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Add preset profiles for factories, quarries, and loading yards with Loading Incharge / Party User contacts.
              </p>
              {!isReadOnly && (
                <button
                  onClick={() => handleOpenAddModal('dispatched')}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Dispatched Party Preset</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredDispatched.map((party) => (
                <div 
                  key={party.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-amber-300 shadow-xs hover:shadow-md transition-all p-4 flex flex-col justify-between relative group"
                >
                  <div>
                    {/* Header with Type Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="font-black text-slate-900 text-sm">{party.name}</span>
                        {party.city && (
                          <div className="text-[11px] font-semibold text-slate-500 flex items-center space-x-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{party.city}, {party.state}</span>
                          </div>
                        )}
                      </div>

                      <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                        Loading Site / Dispatch
                      </span>
                    </div>

                    {/* Prominent Party User Field */}
                    <div className="bg-amber-50/50 border border-amber-200/80 rounded-lg p-2.5 my-2.5">
                      <div className="text-[10px] font-extrabold uppercase text-amber-900 flex items-center space-x-1 mb-1">
                        <User className="w-3 h-3 text-amber-700" />
                        <span>Party User (Loading Site / Dispatch Supervisor)</span>
                      </div>
                      {party.partyUser ? (
                        <div className="text-xs font-bold text-slate-900 bg-white px-2 py-1 rounded border border-amber-200">
                          {party.partyUser}
                        </div>
                      ) : (
                        <div className="text-xs italic text-slate-400">
                          No Loading Incharge specified (Click Edit to add)
                        </div>
                      )}
                    </div>

                    {/* Address & GSTIN Details */}
                    <div className="space-y-1.5 text-xs text-slate-600">
                      {party.gstin && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">GSTIN:</span>
                          <span className="font-mono font-bold text-slate-800">{party.gstin}</span>
                        </div>
                      )}

                      {party.phone && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium">Phone / Mobile:</span>
                          <span className="font-semibold text-slate-800 flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{party.phone}</span>
                          </span>
                        </div>
                      )}

                      {party.address && (
                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 line-clamp-2">
                          <span className="font-semibold text-slate-700">Loading Site Address: </span>
                          {party.address}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-1">
                      {!isReadOnly && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(party, 'dispatched')}
                            className="p-1.5 text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                            title="Edit Preset"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(party)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete Preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>

                    {onUseInInvoice && (
                      <button
                        onClick={() => onUseInInvoice(party, 'dispatched')}
                        className="text-[10px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded border border-amber-200 transition-colors flex items-center space-x-1"
                        title="Apply as Dispatched Party in New Invoice"
                      >
                        <span>Use as Dispatched Party</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full p-5 sm:p-6 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-lg ${targetPresetType === 'dispatched' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {modalMode === 'add' ? 'Add New' : 'Edit'}{' '}
                    {targetPresetType === 'dispatched' 
                      ? 'Dispatched Party (Loading Site)' 
                      : 'Consignee / Ship To Site'}{' '}
                    Preset
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {targetPresetType === 'dispatched' 
                      ? 'Configure loading yard details and Loading Incharge Party User.' 
                      : 'Configure destination receiver and Site Incharge Party User.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              {/* Profile / Party Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {targetPresetType === 'dispatched' 
                    ? 'Dispatched Party / Loading Site Name *' 
                    : 'Consignee / Delivery Site Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    targetPresetType === 'dispatched'
                      ? 'e.g. Shree Cement Loading Yard / Factory Gate'
                      : 'e.g. Gujarat Apex Logistics Pvt Ltd / Warehouse Site 1'
                  }
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* PARTY USER FIELD (HIGH PROMINENCE) */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3">
                <label className="block text-slate-800 font-black mb-1 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>
                      {targetPresetType === 'dispatched'
                        ? 'Party User (Loading Incharge / Dispatch Supervisor)'
                        : 'Party User (Receiver Contact / Site Incharge)'}
                    </span>
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold uppercase">Contact Field</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    targetPresetType === 'dispatched'
                      ? 'e.g. Ramesh Bhai (Loading Supervisor - 9825000000)'
                      : 'e.g. Suresh Verma (Site Incharge / Unloading Contact)'
                  }
                  value={formData.partyUser}
                  onChange={e => setFormData({ ...formData, partyUser: e.target.value })}
                  className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-blue-600 focus:outline-none"
                />
                <p className="text-[10.5px] text-slate-500 mt-1 font-medium">
                  This user/contact person is automatically linked when creating transport bills and printed on bilty notes.
                </p>
              </div>

              {/* GSTIN & State Code Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    GSTIN Number (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="24AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={e => handleGSTINChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase text-slate-900 font-bold focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">State & State Code</label>
                  <select
                    value={formData.state}
                    onChange={e => {
                      const st = e.target.value;
                      const matched = INDIAN_STATES.find(s => s.name.toUpperCase() === st);
                      setFormData({
                        ...formData,
                        state: st,
                        stateCode: matched ? matched.code : formData.stateCode
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s.code} value={s.name.toUpperCase()}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* City & Phone Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">City / Town</label>
                  <input
                    type="text"
                    placeholder="e.g. Morbi / Ahmedabad / Pune"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone / Mobile</label>
                  <input
                    type="text"
                    placeholder="e.g. 9825123456"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Full Address */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {targetPresetType === 'dispatched' ? 'Factory / Loading Yard Address' : 'Full Delivery Site Address'}
                </label>
                <textarea
                  rows={2}
                  placeholder="Plot No, Industrial Estate, Landmark, Highway..."
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:bg-white focus:border-blue-600 focus:outline-none resize-none"
                />
              </div>

              {/* Special Instructions / Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Notes / Instructions (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Weighbridge required before exit, gate pass timing 8AM - 8PM"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-medium focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white font-bold rounded-lg shadow-sm transition-all active:scale-95 ${
                    targetPresetType === 'dispatched'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {modalMode === 'add' ? 'Save Preset Profile' : 'Update Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
