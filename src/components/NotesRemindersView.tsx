import React, { useState, useEffect } from 'react';
import { NoteReminder, UserRole, Party, formatINR } from '../types';
import { 
  StickyNote, Plus, Search, MapPin, ArrowRight, Bell, Calendar, 
  Trash2, Edit, CheckCircle2, Clock, Check, Copy, Filter, Navigation,
  Building2, Truck, Tag, AlertCircle, FileText, Settings, PlusCircle, X
} from 'lucide-react';

interface NotesRemindersViewProps {
  userRole: UserRole;
  notes: NoteReminder[];
  parties?: Party[];
  onSaveNote: (note: NoteReminder) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onNavigateToCreateInvoice?: (origin: string, destination: string, bhadaAmount: number) => void;
}

const DEFAULT_CITIES = [
  'Pune, MH', 'Chinchwad, MH', 'Nigdi, MH', 'Bhosari, MH', 'Mumbai, MH', 
  'Thane, MH', 'Bhiwandi, MH', 'Nagpur, MH', 'Nashik, MH', 'Solapur, MH', 
  'Kolhapur, MH', 'Aurangabad, MH', 'Vapi, GJ', 'Surat, GJ', 'Ahmedabad, GJ', 
  'Vadodara, GJ', 'Rajkot, GJ', 'Delhi, DL', 'Gurugram, HR', 'Faridabad, HR', 
  'Indore, MP', 'Jaipur, RJ', 'Bengaluru, KA', 'Hyderabad, TS', 'Chennai, TN', 'Kolkata, WB'
];

const DEFAULT_PARTIES = [
  'Reliance Industries Ltd', 'Tata Steel Ltd', 'Adani Logistics', 
  'Jindal Steel & Power', 'UltraTech Cement', 'Sharma Logistics', 
  'Mahindra Logistics', 'VRL Logistics Ltd'
];

export const NotesRemindersView: React.FC<NotesRemindersViewProps> = ({
  userRole,
  notes,
  parties = [],
  onSaveNote,
  onDeleteNote,
  onNavigateToCreateInvoice
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'bhada_rate' | 'reminder' | 'general'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dynamic origin & destination city dropdown lists synced with InvoiceBuilder presets
  const [originCities, setOriginCitiesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nt_preset_origin_cities');
      const base: string[] = saved ? JSON.parse(saved) : DEFAULT_CITIES;
      const extra = notes.map(n => n.originCity).filter((c): c is string => Boolean(c && c.trim()));
      return Array.from(new Set([...base, ...extra]));
    } catch {
      return DEFAULT_CITIES;
    }
  });

  const [destCities, setDestCitiesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nt_preset_dest_cities');
      const base: string[] = saved ? JSON.parse(saved) : DEFAULT_CITIES;
      const extra = notes.map(n => n.destinationCity).filter((c): c is string => Boolean(c && c.trim()));
      return Array.from(new Set([...base, ...extra]));
    } catch {
      return DEFAULT_CITIES;
    }
  });

  // Dynamic party names dropdown list
  const [partyNamesList, setPartyNamesList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nt_preset_party_names');
      const base: string[] = saved ? JSON.parse(saved) : DEFAULT_PARTIES;
      const propParties = parties ? parties.map(p => p.name) : [];
      const extra = notes.map(n => n.partyName).filter((p): p is string => Boolean(p && p.trim()));
      return Array.from(new Set([...base, ...propParties, ...extra]));
    } catch {
      return DEFAULT_PARTIES;
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nt_preset_origin_cities', JSON.stringify(originCities));
    } catch (_) {}
  }, [originCities]);

  useEffect(() => {
    try {
      localStorage.setItem('nt_preset_dest_cities', JSON.stringify(destCities));
    } catch (_) {}
  }, [destCities]);

  useEffect(() => {
    try {
      localStorage.setItem('nt_preset_party_names', JSON.stringify(partyNamesList));
    } catch (_) {}
  }, [partyNamesList]);

  // Dropdown options management modal state
  type DropdownCategory = 'origin' | 'destination' | 'party';
  const [activeManageCategory, setActiveManageCategory] = useState<DropdownCategory | null>(null);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [editingOption, setEditingOption] = useState<{ oldVal: string; newVal: string } | null>(null);

  // Add new option to dropdown list
  const handleAddOption = (category: DropdownCategory, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (category === 'origin') {
      if (!originCities.includes(trimmed)) {
        setOriginCitiesList([trimmed, ...originCities]);
      }
      setOriginCity(trimmed);
    } else if (category === 'destination') {
      if (!destCities.includes(trimmed)) {
        setDestCitiesList([trimmed, ...destCities]);
      }
      setDestinationCity(trimmed);
    } else if (category === 'party') {
      if (!partyNamesList.includes(trimmed)) {
        setPartyNamesList([trimmed, ...partyNamesList]);
      }
      setPartyName(trimmed);
    }
    setNewOptionInput('');
  };

  // Delete option from dropdown list
  const handleDeleteOption = (category: DropdownCategory, optionToDelete: string) => {
    if (category === 'origin') {
      setOriginCitiesList(prev => prev.filter(item => item !== optionToDelete));
    } else if (category === 'destination') {
      setDestCitiesList(prev => prev.filter(item => item !== optionToDelete));
    } else if (category === 'party') {
      setPartyNamesList(prev => prev.filter(item => item !== optionToDelete));
    }
  };

  // Edit / Modify option in dropdown list
  const handleEditOptionSubmit = (category: DropdownCategory, oldVal: string, newVal: string) => {
    const trimmed = newVal.trim();
    if (!trimmed || trimmed === oldVal) {
      setEditingOption(null);
      return;
    }

    if (category === 'origin') {
      setOriginCitiesList(prev => prev.map(item => item === oldVal ? trimmed : item));
      if (originCity === oldVal) setOriginCity(trimmed);
    } else if (category === 'destination') {
      setDestCitiesList(prev => prev.map(item => item === oldVal ? trimmed : item));
      if (destinationCity === oldVal) setDestinationCity(trimmed);
    } else if (category === 'party') {
      setPartyNamesList(prev => prev.map(item => item === oldVal ? trimmed : item));
      if (partyName === oldVal) setPartyName(trimmed);
    }
    setEditingOption(null);
  };

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteReminder | null>(null);

  // Modal Form State
  const [category, setCategory] = useState<'bhada_rate' | 'reminder' | 'general'>('bhada_rate');
  const [title, setTitle] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [bhadaAmount, setBhadaAmount] = useState<number | ''>('');
  const [ratePerTon, setRatePerTon] = useState<number | ''>('');
  const [vehicleType, setVehicleType] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [partyName, setPartyName] = useState('');
  const [description, setDescription] = useState('');

  // Filter notes
  const filteredNotes = notes.filter(item => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;

    return (
      item.title?.toLowerCase().includes(search) ||
      item.originCity?.toLowerCase().includes(search) ||
      item.destinationCity?.toLowerCase().includes(search) ||
      item.partyName?.toLowerCase().includes(search) ||
      item.vehicleType?.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search) ||
      String(item.bhadaAmount || '').includes(search)
    );
  });

  const bhadaCount = notes.filter(n => n.category === 'bhada_rate').length;
  const reminderCount = notes.filter(n => n.category === 'reminder' && !n.isCompleted).length;
  const generalCount = notes.filter(n => n.category === 'general').length;

  const handleOpenAddModal = (defaultCategory: 'bhada_rate' | 'reminder' | 'general' = 'bhada_rate') => {
    setEditingNote(null);
    setCategory(defaultCategory);
    setTitle('');
    setOriginCity('');
    setDestinationCity('');
    setBhadaAmount('');
    setRatePerTon('');
    setVehicleType('');
    setReminderDate(new Date().toISOString().split('T')[0]);
    setPartyName('');
    setDescription('');
    setShowModal(true);
  };

  const handleOpenEditModal = (note: NoteReminder) => {
    setEditingNote(note);
    setCategory(note.category);
    setTitle(note.title || '');
    setOriginCity(note.originCity || '');
    setDestinationCity(note.destinationCity || '');
    setBhadaAmount(note.bhadaAmount !== undefined ? note.bhadaAmount : '');
    setRatePerTon(note.ratePerTon !== undefined ? note.ratePerTon : '');
    setVehicleType(note.vehicleType || '');
    setReminderDate(note.reminderDate || '');
    setPartyName(note.partyName || '');
    setDescription(note.description || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let autoTitle = title;
    if (category === 'bhada_rate') {
      autoTitle = title.trim() || `${originCity || 'Origin'} ➔ ${destinationCity || 'Dest'} Bhada Rate`;
    } else if (!autoTitle.trim()) {
      autoTitle = category === 'reminder' ? 'Payment / Transport Follow-up' : 'Transport Note';
    }

    const numRatePerTon = ratePerTon === '' ? undefined : Number(ratePerTon);
    const numBhadaAmount = category === 'bhada_rate'
      ? (numRatePerTon !== undefined ? numRatePerTon : (bhadaAmount === '' ? undefined : Number(bhadaAmount)))
      : (bhadaAmount === '' ? undefined : Number(bhadaAmount));

    const noteToSave: NoteReminder = {
      id: editingNote ? editingNote.id : `note-${Date.now()}`,
      title: autoTitle,
      category,
      originCity: originCity.trim(),
      destinationCity: destinationCity.trim(),
      bhadaAmount: numBhadaAmount,
      ratePerTon: numRatePerTon,
      vehicleType: vehicleType.trim(),
      reminderDate: reminderDate,
      partyName: partyName.trim(),
      description: description.trim(),
      isCompleted: editingNote ? editingNote.isCompleted : false,
      createdAt: editingNote ? editingNote.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (originCity.trim()) {
      try {
        const saved = localStorage.getItem('nt_preset_origin_cities');
        const existing: string[] = saved ? JSON.parse(saved) : DEFAULT_CITIES;
        if (!existing.includes(originCity.trim())) {
          localStorage.setItem('nt_preset_origin_cities', JSON.stringify([originCity.trim(), ...existing]));
        }
      } catch (_) {}
    }
    if (destinationCity.trim()) {
      try {
        const saved = localStorage.getItem('nt_preset_dest_cities');
        const existing: string[] = saved ? JSON.parse(saved) : DEFAULT_CITIES;
        if (!existing.includes(destinationCity.trim())) {
          localStorage.setItem('nt_preset_dest_cities', JSON.stringify([destinationCity.trim(), ...existing]));
        }
      } catch (_) {}
    }

    await onSaveNote(noteToSave);
    setShowModal(false);
  };

  const handleToggleComplete = async (note: NoteReminder) => {
    await onSaveNote({
      ...note,
      isCompleted: !note.isCompleted,
      updatedAt: new Date().toISOString()
    });
  };

  const handleCopyBhadaRate = (note: NoteReminder) => {
    const text = `Origin: ${note.originCity || 'N/A'} ➔ Destination: ${note.destinationCity || 'N/A'} | Bhada Amount: ₹${formatINR(note.bhadaAmount)} ${note.ratePerTon ? '| Rate: ₹' + note.ratePerTon + '/Ton' : ''} ${note.vehicleType ? '| Truck: ' + note.vehicleType : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner & Quick Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-800">
            <StickyNote className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Notes, Reminders & Route Bhada Rates
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Save City-to-City freight charges (Bhada Amount), track due payment reminders, and keep transport notes.
          </p>
        </div>

        {['admin', 'accountant'].includes(userRole) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenAddModal('bhada_rate')}
              className="flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              <span>+ SAVE BHADA RATE (ORIGIN ➔ DEST)</span>
            </button>
            <button
              onClick={() => handleOpenAddModal('reminder')}
              className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Bell className="w-4 h-4" />
              <span>+ ADD REMINDER</span>
            </button>
            <button
              onClick={() => handleOpenAddModal('general')}
              className="flex items-center space-x-1.5 bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ NOTE</span>
            </button>
          </div>
        )}
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div 
          onClick={() => setCategoryFilter('bhada_rate')}
          className={`cursor-pointer bg-white border p-3 rounded-lg flex items-center justify-between transition-all ${
            categoryFilter === 'bhada_rate' ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Route Bhada Rates</div>
              <div className="text-[11px] text-slate-500">Origin City ➔ Dest City Rates</div>
            </div>
          </div>
          <span className="text-sm font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            {bhadaCount} Saved
          </span>
        </div>

        <div 
          onClick={() => setCategoryFilter('reminder')}
          className={`cursor-pointer bg-white border p-3 rounded-lg flex items-center justify-between transition-all ${
            categoryFilter === 'reminder' ? 'border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">Reminders & Follow-ups</div>
              <div className="text-[11px] text-slate-500">Pending payment & POD tasks</div>
            </div>
          </div>
          <span className="text-sm font-extrabold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            {reminderCount} Pending
          </span>
        </div>

        <div 
          onClick={() => setCategoryFilter('general')}
          className={`cursor-pointer bg-white border p-3 rounded-lg flex items-center justify-between transition-all ${
            categoryFilter === 'general' ? 'border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/20' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">General Notes</div>
              <div className="text-[11px] text-slate-500">Office & Transport Scratchpad</div>
            </div>
          </div>
          <span className="text-sm font-extrabold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
            {generalCount} Notes
          </span>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded font-bold transition-all ${
              categoryFilter === 'all' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items ({notes.length})
          </button>
          <button
            onClick={() => setCategoryFilter('bhada_rate')}
            className={`px-3 py-1.5 rounded font-bold transition-all flex items-center space-x-1 ${
              categoryFilter === 'bhada_rate' 
                ? 'bg-blue-700 text-white shadow-xs' 
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Bhada Rates ({bhadaCount})</span>
          </button>
          <button
            onClick={() => setCategoryFilter('reminder')}
            className={`px-3 py-1.5 rounded font-bold transition-all flex items-center space-x-1 ${
              categoryFilter === 'reminder' 
                ? 'bg-amber-600 text-white shadow-xs' 
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Reminders ({notes.filter(n => n.category === 'reminder').length})</span>
          </button>
          <button
            onClick={() => setCategoryFilter('general')}
            className={`px-3 py-1.5 rounded font-bold transition-all flex items-center space-x-1 ${
              categoryFilter === 'general' 
                ? 'bg-purple-700 text-white shadow-xs' 
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>General ({generalCount})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search city, bhada, party, title..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded pl-8 pr-2 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Grid Content */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <StickyNote className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No notes or reminders found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Save Route Bhada rates (Origin City ➔ Destination City with Bhada Amount), create payment reminders, or make transport notes.
          </p>
          {['admin', 'accountant'].includes(userRole) && (
            <button
              onClick={() => handleOpenAddModal('bhada_rate')}
              className="inline-flex items-center space-x-1.5 bg-blue-700 text-white px-3.5 py-1.5 rounded text-xs font-bold"
            >
              <Navigation className="w-4 h-4" />
              <span>Save First Bhada Rate</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {filteredNotes.map(note => {
            const isBhada = note.category === 'bhada_rate';
            const isReminder = note.category === 'reminder';

            return (
              <div 
                key={note.id}
                className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
                  note.isCompleted ? 'opacity-60 bg-slate-50 border-slate-200' : 
                  isBhada ? 'border-blue-200 hover:border-blue-400' :
                  isReminder ? 'border-amber-200 hover:border-amber-400' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Category Header Badge & Actions */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1 ${
                      isBhada ? 'bg-blue-100 text-blue-800' :
                      isReminder ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {isBhada && <Navigation className="w-3 h-3" />}
                      {isReminder && <Bell className="w-3 h-3" />}
                      {!isBhada && !isReminder && <StickyNote className="w-3 h-3" />}
                      <span>{isBhada ? 'ROUTE BHADA RATE' : isReminder ? 'REMINDER' : 'GENERAL NOTE'}</span>
                    </span>

                    <div className="flex items-center space-x-1">
                      {isBhada && (
                        <button
                          onClick={() => handleCopyBhadaRate(note)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-700 transition-colors"
                          title="Copy Bhada Rate Info"
                        >
                          {copiedId === note.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {['admin', 'accountant'].includes(userRole) && (
                        <>
                          <button
                            onClick={() => handleOpenEditModal(note)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-700 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this note/reminder?')) {
                                onDeleteNote(note.id);
                              }
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ROUTE BHADA DISPLAY */}
                  {isBhada ? (
                    <div className="space-y-2">
                      {/* Origin City -> Destination City Header */}
                      <div className="bg-slate-900 text-white p-2.5 rounded-lg flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 font-bold text-xs truncate">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{note.originCity || 'Origin'}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-400 shrink-0 mx-1" />
                        <div className="flex items-center space-x-1.5 font-bold text-xs truncate">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{note.destinationCity || 'Destination'}</span>
                        </div>
                      </div>

                      {/* Rate Per Ton Big Highlight */}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-800 uppercase block">Rate Per Ton:</span>
                          <span className="text-base font-black text-emerald-900 font-mono">
                            ₹{formatINR(note.ratePerTon ?? note.bhadaAmount)} / Ton
                          </span>
                        </div>
                        {note.bhadaAmount && note.ratePerTon && note.bhadaAmount !== note.ratePerTon ? (
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 font-bold block">Bhada Amount</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">
                              ₹{formatINR(note.bhadaAmount)}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {note.vehicleType && (
                        <div className="flex items-center space-x-1.5 text-slate-600 text-xs font-medium">
                          <Truck className="w-3.5 h-3.5 text-slate-400" />
                          <span>Truck: <strong>{note.vehicleType}</strong></span>
                        </div>
                      )}

                      {note.description && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">
                          {note.description}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* REMINDER OR GENERAL NOTE DISPLAY */
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className={`font-bold text-sm text-slate-900 ${note.isCompleted ? 'line-through text-slate-400' : ''}`}>
                          {note.title}
                        </h3>
                        {isReminder && (
                          <button
                            onClick={() => handleToggleComplete(note)}
                            className={`p-1 rounded-full transition-colors ${
                              note.isCompleted ? 'text-emerald-600 bg-emerald-50' : 'text-slate-300 hover:text-emerald-600'
                            }`}
                            title={note.isCompleted ? 'Mark Pending' : 'Mark Completed'}
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      {note.reminderDate && (
                        <div className="flex items-center space-x-1 text-amber-700 font-semibold text-xs">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Due: {note.reminderDate}</span>
                        </div>
                      )}

                      {note.partyName && (
                        <div className="flex items-center space-x-1 text-slate-600 text-xs">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Party: <strong>{note.partyName}</strong></span>
                        </div>
                      )}

                      {note.description && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">
                          {note.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    Saved: {new Date(note.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                  {isBhada && onNavigateToCreateInvoice && (
                    <button
                      onClick={() => onNavigateToCreateInvoice(note.originCity || '', note.destinationCity || '', note.bhadaAmount || 0)}
                      className="text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors"
                    >
                      <span>Create Bill</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <StickyNote className="w-5 h-5 text-blue-700" />
                <h2 className="text-base font-bold text-slate-900">
                  {editingNote ? 'Edit Item' : 'Add Note, Reminder or Route Bhada Rate'}
                </h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              
              {/* Category Selector */}
              <div>
                <label className="block text-slate-600 font-bold mb-1">Select Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory('bhada_rate')}
                    className={`py-2 px-2 rounded font-bold border text-center transition-all ${
                      category === 'bhada_rate' 
                        ? 'bg-blue-700 text-white border-blue-700 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Route Bhada Rate
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('reminder')}
                    className={`py-2 px-2 rounded font-bold border text-center transition-all ${
                      category === 'reminder' 
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('general')}
                    className={`py-2 px-2 rounded font-bold border text-center transition-all ${
                      category === 'general' 
                        ? 'bg-purple-700 text-white border-purple-700 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    General Note
                  </button>
                </div>
              </div>

              {/* SPECIFIC FIELDS FOR ROUTE BHADA RATE */}
              {category === 'bhada_rate' && (
                <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-slate-700 font-bold text-xs">Origin City *</label>
                        <div className="flex items-center space-x-1 shrink-0">
                          <select
                            className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-blue-700 rounded px-1.5 py-0.5 font-bold focus:outline-none cursor-pointer"
                            onChange={e => {
                              if (e.target.value === '__manage__') {
                                setActiveManageCategory('origin');
                              } else if (e.target.value) {
                                setOriginCity(e.target.value);
                              }
                            }}
                            value=""
                          >
                            <option value="">Quick List...</option>
                            {originCities.map(c => (
                              <option key={`note-orig-${c}`} value={c}>{c}</option>
                            ))}
                            <option value="__manage__" className="font-bold text-blue-700">⚙ + Edit / Manage List...</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setActiveManageCategory('origin')}
                            className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-800 font-extrabold px-1.5 py-0.5 rounded border border-blue-300 transition-colors whitespace-nowrap"
                            title="Add, edit or delete origin cities"
                          >
                            +Edit
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        required
                        list="notes-origin-cities-list"
                        placeholder="e.g. Pune, MH"
                        value={originCity}
                        onChange={e => setOriginCity(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-900 focus:border-blue-600 focus:outline-none text-xs"
                      />
                      <datalist id="notes-origin-cities-list">
                        {originCities.map(c => (
                          <option key={`dl-notes-orig-${c}`} value={c} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-slate-700 font-bold text-xs">Destination City *</label>
                        <div className="flex items-center space-x-1 shrink-0">
                          <select
                            className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-blue-700 rounded px-1.5 py-0.5 font-bold focus:outline-none cursor-pointer"
                            onChange={e => {
                              if (e.target.value === '__manage__') {
                                setActiveManageCategory('destination');
                              } else if (e.target.value) {
                                setDestinationCity(e.target.value);
                              }
                            }}
                            value=""
                          >
                            <option value="">Quick List...</option>
                            {destCities.map(c => (
                              <option key={`note-dest-${c}`} value={c}>{c}</option>
                            ))}
                            <option value="__manage__" className="font-bold text-blue-700">⚙ + Edit / Manage List...</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setActiveManageCategory('destination')}
                            className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-800 font-extrabold px-1.5 py-0.5 rounded border border-blue-300 transition-colors whitespace-nowrap"
                            title="Add, edit or delete destination cities"
                          >
                            +Edit
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        required
                        list="notes-dest-cities-list"
                        placeholder="e.g. Mumbai, MH"
                        value={destinationCity}
                        onChange={e => setDestinationCity(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-900 focus:border-blue-600 focus:outline-none text-xs"
                      />
                      <datalist id="notes-dest-cities-list">
                        {destCities.map(c => (
                          <option key={`dl-notes-dest-${c}`} value={c} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label className="block text-emerald-800 font-bold mb-1 text-xs">Rate Per Ton (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      placeholder="e.g. 1250"
                      value={ratePerTon}
                      onChange={e => setRatePerTon(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-emerald-400 rounded px-2.5 py-1.5 font-mono font-bold text-slate-900 focus:border-emerald-600 focus:outline-none text-xs"
                    />
                  </div>
                </div>
              )}

              {/* REMINDER / GENERAL TITLE */}
              {category !== 'bhada_rate' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-0.5">Title *</label>
                  <input
                    type="text"
                    required
                    placeholder={category === 'reminder' ? "e.g. Follow up payment for Invoice #1021" : "e.g. New Transport Policy Notes"}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              {category === 'reminder' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-0.5 text-xs">Due Date</label>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={e => setReminderDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 focus:border-blue-600 focus:outline-none text-xs"
                  />
                </div>
              )}

              {/* Party Name Dropdown Field with Quick List and +Edit Button */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-slate-700 font-bold text-xs">Party Name (Optional)</label>
                  <div className="flex items-center space-x-1 shrink-0">
                    <select
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-blue-700 rounded px-1.5 py-0.5 font-bold focus:outline-none cursor-pointer"
                      onChange={e => {
                        if (e.target.value === '__manage__') {
                          setActiveManageCategory('party');
                        } else if (e.target.value) {
                          setPartyName(e.target.value);
                        }
                      }}
                      value=""
                    >
                      <option value="">Quick List...</option>
                      {partyNamesList.map(p => (
                        <option key={`note-party-${p}`} value={p}>{p}</option>
                      ))}
                      <option value="__manage__" className="font-bold text-blue-700">⚙ + Edit / Manage List...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setActiveManageCategory('party')}
                      className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-800 font-extrabold px-1.5 py-0.5 rounded border border-blue-300 transition-colors whitespace-nowrap"
                      title="Add, edit or delete party names"
                    >
                      +Edit
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  list="notes-party-names-list"
                  placeholder="e.g. Sharma Logistics, Reliance Ind."
                  value={partyName}
                  onChange={e => setPartyName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-900 focus:border-blue-600 focus:outline-none text-xs"
                />
                <datalist id="notes-party-names-list">
                  {partyNamesList.map(p => (
                    <option key={`dl-notes-party-${p}`} value={p} />
                  ))}
                </datalist>
              </div>

              {/* Remarks / Description */}
              <div>
                <label className="block text-slate-700 font-bold mb-0.5">Remarks / Description / Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Enter details, driver notes, toll inclusion remarks, or instructions..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-5 py-2 rounded shadow-xs"
                >
                  {editingNote ? 'Update Saved Note' : 'Save Note / Bhada Rate'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal Overlay for Managing Dropdown Options (Origin/Destination Cities & Party Names) */}
      {activeManageCategory && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-blue-900 text-white p-3.5 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm uppercase tracking-wide">
                  Manage {activeManageCategory === 'origin' ? 'Origin City' : activeManageCategory === 'destination' ? 'Destination City' : 'Party Name'} Dropdown List
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setActiveManageCategory(null); setNewOptionInput(''); setEditingOption(null); }}
                className="text-slate-300 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Add New Option Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Add New {activeManageCategory === 'origin' ? 'Origin City' : activeManageCategory === 'destination' ? 'Destination City' : 'Party Name'} Option
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder={
                      activeManageCategory === 'origin' || activeManageCategory === 'destination'
                        ? "e.g. Nashik, MH or Vapi, GJ"
                        : "e.g. Sharma Logistics or Reliance Ind."
                    }
                    value={newOptionInput}
                    onChange={e => setNewOptionInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption(activeManageCategory, newOptionInput);
                      }
                    }}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-semibold focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddOption(activeManageCategory, newOptionInput)}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded flex items-center space-x-1 shrink-0 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* List of Existing Dropdown Options */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                    Current {activeManageCategory === 'party' ? 'Party Names' : 'Cities'} (
                    {activeManageCategory === 'origin'
                      ? originCities.length
                      : activeManageCategory === 'destination'
                      ? destCities.length
                      : partyNamesList.length}
                    )
                  </label>
                  <span className="text-[10px] text-slate-400">✏ Edit / Modify or 🗑 Delete</span>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50 p-1">
                  {(activeManageCategory === 'origin'
                    ? originCities
                    : activeManageCategory === 'destination'
                    ? destCities
                    : partyNamesList).length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                      No custom options found.
                    </div>
                  ) : (
                    (activeManageCategory === 'origin'
                      ? originCities
                      : activeManageCategory === 'destination'
                      ? destCities
                      : partyNamesList).map(opt => (
                      <div key={`manage-opt-${opt}`} className="flex items-center justify-between p-2 hover:bg-white rounded transition-colors">
                        {editingOption && editingOption.oldVal === opt ? (
                          <div className="flex items-center space-x-2 w-full">
                            <input
                              type="text"
                              value={editingOption.newVal}
                              onChange={e => setEditingOption({ ...editingOption, newVal: e.target.value })}
                              className="flex-1 bg-white border border-blue-500 rounded px-2 py-1 font-bold text-slate-800 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleEditOptionSubmit(activeManageCategory, editingOption.oldVal, editingOption.newVal)}
                              className="bg-emerald-600 text-white p-1 rounded hover:bg-emerald-700"
                              title="Save Changes"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOption(null)}
                              className="bg-slate-300 text-slate-700 p-1 rounded hover:bg-slate-400"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold text-slate-800 truncate">{opt}</span>
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingOption({ oldVal: opt, newVal: opt })}
                                className="text-slate-400 hover:text-blue-600 p-1 transition-colors"
                                title="Edit / Modify name"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOption(activeManageCategory, opt)}
                                className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                                title="Delete option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-3 text-right">
              <button
                type="button"
                onClick={() => { setActiveManageCategory(null); setNewOptionInput(''); setEditingOption(null); }}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 rounded text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
