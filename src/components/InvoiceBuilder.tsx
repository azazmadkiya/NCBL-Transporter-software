import React, { useState, useEffect } from 'react';
import { 
  Invoice, Party, Vehicle, TaxSlab, TaxType, TaxMechanism, InvoiceType, InvoiceItem, formatINR, NoteReminder 
} from '../types';
import { 
  Truck, Plus, Trash2, Save, ArrowLeft, Calculator, AlertCircle, FileText, CheckCircle2, Settings, PlusCircle, X, Edit, Copy, Check, UserPlus, Building, StickyNote, Navigation, RotateCcw, Search, Users, User 
} from 'lucide-react';
import { saveParty, deleteParty, saveNoteReminder } from '../services/firestoreService';

export const MONTH_CODES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

export interface BillSeriesOption {
  id: string;
  label: string;
  prefix: string;
  pattern?: string;
  description?: string;
  isDefault?: boolean;
}

export const DEFAULT_BILL_SERIES_OPTIONS: BillSeriesOption[] = [
  { id: 'PR', label: 'PR Series', prefix: 'PR', pattern: 'PR/MONTH/1', isDefault: true },
  { id: 'VT', label: 'VT Series', prefix: 'VT', pattern: 'VT/MONTH/1', isDefault: true },
  { id: 'LE', label: 'LE Series', prefix: 'LE', pattern: 'LE/MONTH/1', isDefault: true },
  { id: 'GPT', label: 'GPT Series', prefix: 'GPT', pattern: 'GPT/MONTH/1', isDefault: true },
];

export const BILL_SERIES_OPTIONS = DEFAULT_BILL_SERIES_OPTIONS;

export const getMonthAbbreviation = (dateStr?: string): string => {
  if (!dateStr) return MONTH_CODES[new Date().getMonth()];
  const parts = dateStr.split('-');
  if (parts.length >= 2) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return MONTH_CODES[monthIndex];
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return MONTH_CODES[d.getMonth()];
  }
  return MONTH_CODES[new Date().getMonth()];
};

export const calculateNextSeriesInvoiceNumber = (
  prefix: string,
  dateStr: string,
  allInvoices: Invoice[] = [],
  excludeInvoiceId?: string
): string => {
  const cleanPrefix = (prefix || 'PR').trim().toUpperCase();
  const monthAbbr = getMonthAbbreviation(dateStr);
  
  // Format is: PREFIX/MONTH/NUM (e.g. PR/AUG/1, VT/SEP/1, LE/OCT/1, GPT/NOV/1)
  const escapedPrefix = cleanPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}\\/${monthAbbr}\\/(\\d+)$`, 'i');

  let maxNumber = 0;
  for (let i = 0; i < allInvoices.length; i++) {
    const inv = allInvoices[i];
    if (excludeInvoiceId && inv.id === excludeInvoiceId) continue;
    if (!inv.invoiceNumber) continue;

    const match = inv.invoiceNumber.trim().match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  const nextNumber = maxNumber + 1;
  return `${cleanPrefix}/${monthAbbr}/${nextNumber}`;
};

interface InvoiceBuilderProps {
  initialInvoice?: Invoice | null;
  parties: Party[];
  vehicles: Vehicle[];
  invoices?: Invoice[];
  notesReminders?: NoteReminder[];
  onSave: (invoice: Invoice) => void;
  onAddParty?: (party: Party) => void;
  onCancel: () => void;
}

export const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({
  initialInvoice,
  parties,
  vehicles,
  invoices = [],
  notesReminders = [],
  onSave,
  onAddParty,
  onCancel
}) => {
  // Generate default Invoice & LR numbers
  const todayStr = new Date().toISOString().split('T')[0];
  const autoLRNum = `NT-LR-${Math.floor(8000 + Math.random() * 1000)}`;

  // Bill Series Dynamic Presets synced with localStorage
  const [billSeriesList, setBillSeriesList] = useState<BillSeriesOption[]>(() => {
    const saved = localStorage.getItem('nt_preset_bill_series_list_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return DEFAULT_BILL_SERIES_OPTIONS;
  });

  const [showBillSeriesModal, setShowBillSeriesModal] = useState(false);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [seriesForm, setSeriesForm] = useState<{ prefix: string; label: string; description: string }>({
    prefix: '',
    label: '',
    description: ''
  });

  useEffect(() => {
    localStorage.setItem('nt_preset_bill_series_list_v2', JSON.stringify(billSeriesList));
  }, [billSeriesList]);

  const detectInitialSeries = (invNum?: string): string => {
    if (!invNum) return 'PR';
    const clean = invNum.trim().toUpperCase();
    for (const opt of billSeriesList) {
      if (clean.startsWith(`${opt.prefix}/`)) {
        return opt.prefix;
      }
    }
    return 'custom';
  };

  const [invoiceType, setInvoiceType] = useState<InvoiceType>(initialInvoice?.invoiceType || 'normal_bill');
  const [selectedSeries, setSelectedSeries] = useState<string>(() => {
    if (initialInvoice?.invoiceNumber) {
      return detectInitialSeries(initialInvoice.invoiceNumber);
    }
    return 'PR';
  });

  const [invoiceDate, setInvoiceDate] = useState(initialInvoice?.invoiceDate || todayStr);

  const [invoiceNumber, setInvoiceNumber] = useState(() => {
    if (initialInvoice?.invoiceNumber) {
      return initialInvoice.invoiceNumber;
    }
    return calculateNextSeriesInvoiceNumber('PR', initialInvoice?.invoiceDate || todayStr, invoices);
  });

  const [salesBillNumber, setSalesBillNumber] = useState(initialInvoice?.salesBillNumber || '');
  const [salesBillDate, setSalesBillDate] = useState(initialInvoice?.salesBillDate || '');
  const [purchaseBillNumber, setPurchaseBillNumber] = useState(initialInvoice?.purchaseBillNumber || '');
  const [purchaseDate, setPurchaseDate] = useState(initialInvoice?.purchaseDate || '');
  const [lrNumber, setLrNumber] = useState(initialInvoice?.lrNumber || autoLRNum);
  const [lrDate, setLrDate] = useState(initialInvoice?.lrDate || todayStr);
  const [dueDate, setDueDate] = useState(initialInvoice?.dueDate || todayStr);

  const handleSeriesChange = (newSeries: string) => {
    setSelectedSeries(newSeries);
    if (newSeries !== 'custom') {
      const nextNum = calculateNextSeriesInvoiceNumber(newSeries, invoiceDate, invoices, initialInvoice?.id);
      setInvoiceNumber(nextNum);
    }
  };

  const handleInvoiceDateChange = (newDate: string) => {
    setInvoiceDate(newDate);
    // Auto-update month & sequence in invoice number if using a standard series
    if (selectedSeries && selectedSeries !== 'custom') {
      const nextNum = calculateNextSeriesInvoiceNumber(selectedSeries, newDate, invoices, initialInvoice?.id);
      setInvoiceNumber(nextNum);
    } else if (!initialInvoice) {
      // Check if current invoiceNumber follows any PREFIX/MONTH/NUM
      const parts = invoiceNumber.split('/');
      if (parts.length === 3 && billSeriesList.some(o => o.prefix === parts[0].toUpperCase())) {
        const nextNum = calculateNextSeriesInvoiceNumber(parts[0].toUpperCase(), newDate, invoices, initialInvoice?.id);
        setInvoiceNumber(nextNum);
      }
    }
  };

  const handleRefreshNextNumber = () => {
    const prefix = selectedSeries === 'custom' ? (billSeriesList[0]?.prefix || 'PR') : selectedSeries;
    const nextNum = calculateNextSeriesInvoiceNumber(prefix, invoiceDate, invoices, initialInvoice?.id);
    setInvoiceNumber(nextNum);
    if (selectedSeries === 'custom') {
      setSelectedSeries(prefix);
    }
  };

  const handleOpenAddSeriesModal = () => {
    setEditingSeriesId(null);
    setSeriesForm({ prefix: '', label: '', description: '' });
    setShowBillSeriesModal(true);
  };

  const handleSaveBillSeries = () => {
    const cleanPrefix = seriesForm.prefix.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanPrefix) return;

    const cleanLabel = seriesForm.label.trim() || `${cleanPrefix} Series`;
    const cleanDesc = seriesForm.description.trim();

    if (editingSeriesId) {
      setBillSeriesList(prev => prev.map(s => {
        if (s.id === editingSeriesId) {
          return {
            ...s,
            prefix: cleanPrefix,
            label: cleanLabel,
            description: cleanDesc,
            pattern: `${cleanPrefix}/MONTH/1`
          };
        }
        return s;
      }));

      if (selectedSeries === editingSeriesId || selectedSeries === cleanPrefix) {
        setSelectedSeries(cleanPrefix);
        const nextNum = calculateNextSeriesInvoiceNumber(cleanPrefix, invoiceDate, invoices, initialInvoice?.id);
        setInvoiceNumber(nextNum);
      }
      setEditingSeriesId(null);
    } else {
      const existing = billSeriesList.find(s => s.prefix.toUpperCase() === cleanPrefix);
      if (existing) {
        setSelectedSeries(existing.prefix);
        const nextNum = calculateNextSeriesInvoiceNumber(existing.prefix, invoiceDate, invoices, initialInvoice?.id);
        setInvoiceNumber(nextNum);
      } else {
        const newOption: BillSeriesOption = {
          id: cleanPrefix,
          label: cleanLabel,
          prefix: cleanPrefix,
          pattern: `${cleanPrefix}/MONTH/1`,
          description: cleanDesc,
          isDefault: false
        };
        setBillSeriesList(prev => [...prev, newOption]);
        setSelectedSeries(cleanPrefix);
        const nextNum = calculateNextSeriesInvoiceNumber(cleanPrefix, invoiceDate, invoices, initialInvoice?.id);
        setInvoiceNumber(nextNum);
      }
    }

    setSeriesForm({ prefix: '', label: '', description: '' });
  };

  const handleDeleteBillSeries = (seriesId: string) => {
    setBillSeriesList(prev => prev.filter(s => s.id !== seriesId));
    if (editingSeriesId === seriesId) {
      setEditingSeriesId(null);
      setSeriesForm({ prefix: '', label: '', description: '' });
    }
    if (selectedSeries === seriesId) {
      const fallback = billSeriesList.find(s => s.id !== seriesId)?.prefix || 'PR';
      setSelectedSeries(fallback);
      const nextNum = calculateNextSeriesInvoiceNumber(fallback, invoiceDate, invoices, initialInvoice?.id);
      setInvoiceNumber(nextNum);
    }
  };

  const handleStartEditBillSeries = (series: BillSeriesOption) => {
    setEditingSeriesId(series.id);
    setSeriesForm({
      prefix: series.prefix,
      label: series.label,
      description: series.description || ''
    });
  };

  const handleResetBillSeries = () => {
    setBillSeriesList(DEFAULT_BILL_SERIES_OPTIONS);
    setEditingSeriesId(null);
    setSeriesForm({ prefix: '', label: '', description: '' });
  };

  const handleApplyBillSeries = (prefix: string) => {
    handleSeriesChange(prefix);
    setShowBillSeriesModal(false);
  };

  // Consignor
  const [selectedPartyId, setSelectedPartyId] = useState(initialInvoice?.partyId || '');
  const [consignorName, setConsignorName] = useState(initialInvoice?.consignorName || '');
  const [consignorPartyUser, setConsignorPartyUser] = useState(initialInvoice?.consignorPartyUser || '');
  const [consignorGSTIN, setConsignorGSTIN] = useState(initialInvoice?.consignorGSTIN || '');
  const [consignorCity, setConsignorCity] = useState(initialInvoice?.consignorCity || '');
  const [consignorMobile, setConsignorMobile] = useState(initialInvoice?.consignorMobile || '');
  const [consignorAddress, setConsignorAddress] = useState(initialInvoice?.consignorAddress || '');
  const [consignorState, setConsignorState] = useState(initialInvoice?.consignorState || 'GUJARAT');
  const [consignorStateCode, setConsignorStateCode] = useState(initialInvoice?.consignorStateCode || '24');

  // Consignee
  const [consigneeName, setConsigneeName] = useState(initialInvoice?.consigneeName || '');
  const [consigneePartyUser, setConsigneePartyUser] = useState(initialInvoice?.consigneePartyUser || '');
  const [consigneeGSTIN, setConsigneeGSTIN] = useState(initialInvoice?.consigneeGSTIN || '');
  const [consigneeCity, setConsigneeCity] = useState(initialInvoice?.consigneeCity || '');
  const [consigneeMobile, setConsigneeMobile] = useState(initialInvoice?.consigneeMobile || '');
  const [consigneeAddress, setConsigneeAddress] = useState(initialInvoice?.consigneeAddress || '');
  const [consigneeState, setConsigneeState] = useState(initialInvoice?.consigneeState || 'Maharashtra');

  // Ship To (Delivery Destination)
  const [shipToName, setShipToName] = useState(initialInvoice?.shipToName || '');
  const [shipToPartyUser, setShipToPartyUser] = useState(initialInvoice?.shipToPartyUser || '');
  const [shipToGSTIN, setShipToGSTIN] = useState(initialInvoice?.shipToGSTIN || '');
  const [shipToCity, setShipToCity] = useState(initialInvoice?.shipToCity || '');
  const [shipToMobile, setShipToMobile] = useState(initialInvoice?.shipToMobile || '');
  const [shipToAddress, setShipToAddress] = useState(initialInvoice?.shipToAddress || '');
  const [shipToState, setShipToState] = useState(initialInvoice?.shipToState || '');

  // Dispatched Party (Shipped From / Loading Location)
  const [dispatchedPartyName, setDispatchedPartyName] = useState(initialInvoice?.dispatchedPartyName || '');
  const [dispatchedPartyPartyUser, setDispatchedPartyPartyUser] = useState(initialInvoice?.dispatchedPartyPartyUser || '');
  const [dispatchedPartyGSTIN, setDispatchedPartyGSTIN] = useState(initialInvoice?.dispatchedPartyGSTIN || '');
  const [dispatchedPartyCity, setDispatchedPartyCity] = useState(initialInvoice?.dispatchedPartyCity || '');
  const [dispatchedPartyMobile, setDispatchedPartyMobile] = useState(initialInvoice?.dispatchedPartyMobile || '');
  const [dispatchedPartyAddress, setDispatchedPartyAddress] = useState(initialInvoice?.dispatchedPartyAddress || '');
  const [dispatchedPartyState, setDispatchedPartyState] = useState(initialInvoice?.dispatchedPartyState || '');

  // Route & Fleet
  const [origin, setOrigin] = useState(initialInvoice?.origin || '');
  const [destination, setDestination] = useState(initialInvoice?.destination || '');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState(initialInvoice?.vehicleNumber || '');
  const [driverName, setDriverName] = useState(initialInvoice?.driverName || '');
  const [driverPhone, setDriverPhone] = useState(initialInvoice?.driverPhone || '');
  const [materialType, setMaterialType] = useState(initialInvoice?.materialType || 'General Freight');

  // Line items
  const [items, setItems] = useState<InvoiceItem[]>(
    initialInvoice?.items || [
      {
        id: 'item-1',
        description: 'Freight Charges for Goods Transportation',
        packagesCount: 100,
        weightTons: 10,
        ratePerTon: 2500,
        quantity: 10,
        unit: 'Tons',
        amount: 25000
      }
    ]
  );

  // Charges
  const [loadingCharges, setLoadingCharges] = useState(initialInvoice?.loadingCharges || 0);
  const [unloadingCharges, setUnloadingCharges] = useState(initialInvoice?.unloadingCharges || 0);
  const [detentionCharges, setDetentionCharges] = useState(initialInvoice?.detentionCharges || 0);
  const [otherCharges, setOtherCharges] = useState(initialInvoice?.otherCharges || 0);

  // Tax Settings
  const [taxSlab, setTaxSlab] = useState<TaxSlab>(initialInvoice?.taxSlab ?? 0);
  const [taxType, setTaxType] = useState<TaxType>(initialInvoice?.taxType || 'intra_state');
  const [taxMechanism, setTaxMechanism] = useState<TaxMechanism>(initialInvoice?.taxMechanism || 'exempt');

  // Advances & Round Off
  const [advancePaid, setAdvancePaid] = useState(initialInvoice?.advancePaid || 0);
  const [fuelDeduction, setFuelDeduction] = useState(initialInvoice?.fuelDeduction || 0);
  const [kasarDeduction, setKasarDeduction] = useState<number>(initialInvoice?.kasarDeduction || 0);
  const [roundOff, setRoundOff] = useState<number>(initialInvoice?.roundOff || 0);
  const [notes, setNotes] = useState(initialInvoice?.notes || '');
  const [savedBhadaToast, setSavedBhadaToast] = useState(false);

  const handleQuickSaveRouteBhadaToNotes = async () => {
    const originVal = origin.trim() || 'Origin City';
    const destVal = destination.trim() || 'Destination City';
    const amountVal = grossFreight || 0;
    const rateVal = items[0]?.ratePerTon || (items[0]?.quantity > 0 ? items[0].amount / items[0].quantity : amountVal);

    const newNote: NoteReminder = {
      id: `note-${Date.now()}`,
      title: `${originVal} ➔ ${destVal} Bhada Rate`,
      category: 'bhada_rate',
      originCity: originVal,
      destinationCity: destVal,
      bhadaAmount: amountVal,
      ratePerTon: rateVal,
      vehicleType: vehicleNumber ? `Truck: ${vehicleNumber}` : undefined,
      description: `Saved from Invoice ${invoiceNumber || ''} (${invoiceDate || ''}). Rate (₹): ${formatINR(rateVal)}. Gross Freight: ₹${formatINR(amountVal)}`,
      isCompleted: false,
      createdAt: new Date().toISOString()
    };

    await saveNoteReminder(newNote);
    setSavedBhadaToast(true);
    setTimeout(() => setSavedBhadaToast(false), 3500);
  };

  // Search notes for a matching Route Bhada Rate (Origin City -> Destination City)
  const matchingBhadaNote = React.useMemo(() => {
    if (!origin.trim() || !destination.trim() || !notesReminders || notesReminders.length === 0) return null;
    const o = origin.toLowerCase().trim();
    const d = destination.toLowerCase().trim();

    return notesReminders.find(note => 
      note.category === 'bhada_rate' &&
      note.originCity && note.destinationCity &&
      (note.originCity.toLowerCase().trim() === o || note.originCity.toLowerCase().trim().includes(o) || o.includes(note.originCity.toLowerCase().trim())) &&
      (note.destinationCity.toLowerCase().trim() === d || note.destinationCity.toLowerCase().trim().includes(d) || d.includes(note.destinationCity.toLowerCase().trim()))
    ) || null;
  }, [origin, destination, notesReminders]);

  const handleApplyMatchingBhadaRate = () => {
    if (!matchingBhadaNote) return;
    const newRate = matchingBhadaNote.ratePerTon ?? matchingBhadaNote.bhadaAmount;
    if (newRate === undefined) return;

    setItems(prevItems => {
      if (prevItems.length === 0) {
        return [{
          id: 'item-1',
          description: `Freight Charges (${origin} to ${destination})`,
          packagesCount: 1,
          weightTons: 10,
          ratePerTon: matchingBhadaNote.ratePerTon || newRate,
          quantity: 10,
          unit: 'Tons',
          amount: matchingBhadaNote.bhadaAmount || (10 * newRate)
        }];
      }
      const updated = [...prevItems];
      const qty = Number(updated[0].quantity) || 1;
      const rateVal = matchingBhadaNote.ratePerTon ?? (matchingBhadaNote.bhadaAmount ? matchingBhadaNote.bhadaAmount / qty : newRate);
      const amtVal = matchingBhadaNote.bhadaAmount ?? (qty * rateVal);

      updated[0] = {
        ...updated[0],
        ratePerTon: rateVal,
        amount: amtVal
      };
      return updated;
    });
  };

  // TDS Settings (Income Tax Section 194C)
  const [tdsApplicable, setTdsApplicable] = useState<boolean>(initialInvoice?.tdsApplicable || false);
  const [tdsDeducteeType, setTdsDeducteeType] = useState<'individual' | 'company' | 'custom'>(
    initialInvoice?.tdsDeducteeType || 'individual'
  );
  const [tdsRate, setTdsRate] = useState<number>(initialInvoice?.tdsRate ?? 1);
  const [customTdsAmount, setCustomTdsAmount] = useState<number>(initialInvoice?.tdsAmount || 0);

  // Default initial values for dropdowns
  const DEFAULT_CITIES = [
    'Pune, MH', 'Chinchwad, MH', 'Nigdi, MH', 'Bhosari, MH', 'Mumbai, MH', 
    'Thane, MH', 'Bhiwandi, MH', 'Nagpur, MH', 'Nashik, MH', 'Solapur, MH', 
    'Kolhapur, MH', 'Aurangabad, MH', 'Vapi, GJ', 'Surat, GJ', 'Ahmedabad, GJ', 
    'Vadodara, GJ', 'Rajkot, GJ', 'Delhi, DL', 'Gurugram, HR', 'Faridabad, HR', 
    'Indore, MP', 'Jaipur, RJ', 'Bengaluru, KA', 'Hyderabad, TS', 'Chennai, TN', 'Kolkata, WB'
  ];

  const DEFAULT_MATERIALS = [
    'General Freight',
    'Cement & Building Material',
    'Steel Rods, Pipes & Coils',
    'Industrial Machinery & Equipment',
    'Agricultural Produce & Food Grains',
    'Chemicals & Liquid Drums',
    'FMCG & Packaged Goods',
    'Electronics & Household Appliances',
    'Automobile Parts & Components',
    'Textiles & Garment Bales',
    'Paper Rolls & Packaging Material',
    'Scrap & Metal Waste',
    'Fertilizers & Minerals',
    'Coal & Mining Ores'
  ];

  const DEFAULT_DESCRIPTIONS = [
    'Freight Charges for Goods Transportation',
    'Full Truck Load (FTL) Freight Charges',
    'Part Truck Load (PTL) Cargo Charges',
    'Container Haulage & Movement Charges',
    'Inter-State Heavy Transport Freight',
    'Local Shuttle & Cartage Charges',
    'Loading & Unloading Extra Charges',
    'Detention & Halting Charges',
    'Return Freight & Empty Running Charges',
    'Extra Waiting / Halting Allowance'
  ];

  const DEFAULT_CONSIGNEES = [
    'Gujarat Apex Logistics, Surat',
    'Site Engineer / Plant Incharge',
    'Destination Warehouse / Stockyard',
    'Cash Receiver / Direct Gate Delivery',
    'Shree Sales & Logistics, Mumbai',
    'Mahalaxmi Steel Depot, Pune'
  ];

  const DEFAULT_CONSIGNORS = [
    'Shree Cement Ltd, Pune',
    'Cash Customer / Walk-in',
    'Tata Motors Ltd, Chinchwad',
    'JSW Steel Supply, Nigdi',
    'Self / Internal Transport'
  ];

  const DEFAULT_SHIP_TO = [
    'Same as Consignee Address',
    'Site 1 - Industrial Estate, Chakan, Pune',
    'Warehouse Gate #3, Bhiwandi, Thane',
    'Plant Unloading Yard, Vapi Industrial Area',
    'Central Depot, Sanand, Ahmedabad',
    'Shree Steel Yard Gate #2, Nagpur'
  ];

  const DEFAULT_DISPATCHED_PARTY = [
    'Same as Consignor Address',
    'Factory Unit #1 - Loading Yard, Pune',
    'Main Dispatch Warehouse, Chakan',
    'Plant Loading Yard Gate #2, Surat',
    'Central Depot, Vapi Industrial Area'
  ];

  interface DispatchedPartyPreset {
    id: string;
    name: string;
    gstin?: string;
    city?: string;
    mobile?: string;
    state?: string;
    address?: string;
  }

  const DEFAULT_DISPATCHED_PARTY_PRESETS: DispatchedPartyPreset[] = [
    {
      id: 'dp-default-1',
      name: 'Factory Unit #1 - Loading Yard, Pune',
      gstin: '27AABCU9603R1ZM',
      city: 'Pune',
      mobile: '+91 98230 11223',
      state: 'MAHARASHTRA',
      address: 'Plot No. 45, MIDC Industrial Area, Phase II, Chakan, Pune - 410501'
    },
    {
      id: 'dp-default-2',
      name: 'Main Dispatch Warehouse, Chakan',
      gstin: '27AABCU9603R1ZM',
      city: 'Chakan, Pune',
      mobile: '+91 98230 44556',
      state: 'MAHARASHTRA',
      address: 'Gate No. 12, Chakan Logistics Park, Pune - 410501'
    },
    {
      id: 'dp-default-3',
      name: 'Plant Loading Yard Gate #2, Surat',
      gstin: '24AAACG9876E1Z2',
      city: 'Surat',
      mobile: '+91 98250 77889',
      state: 'GUJARAT',
      address: 'Plot 108, GIDC Industrial Estate, Sachin, Surat - 394230'
    },
    {
      id: 'dp-default-4',
      name: 'Central Depot, Vapi Industrial Area',
      gstin: '24AAACG9876E1Z2',
      city: 'Vapi',
      mobile: '+91 98250 33445',
      state: 'GUJARAT',
      address: 'Phase IV, GIDC Industrial Area, Near Highway Gate, Vapi - 396195'
    }
  ];

  interface ConsigneeQuickPreset {
    id: string;
    name: string;
    gstin?: string;
    city?: string;
    mobile?: string;
    state?: string;
    address?: string;
  }

  const DEFAULT_CONSIGNEE_QUICK_PRESETS: ConsigneeQuickPreset[] = [
    {
      id: 'cge-default-1',
      name: 'Gujarat Apex Logistics Hub',
      gstin: '24AAACG1122D1Z4',
      city: 'Surat',
      mobile: '+91 98980 12345',
      state: 'GUJARAT',
      address: 'Plot 55, Ring Road Logistics Park, Surat - 395002'
    },
    {
      id: 'cge-default-2',
      name: 'Maharashtra Heavy Industries Ltd',
      gstin: '27AABCM4455E1Z9',
      city: 'Pune',
      mobile: '+91 98220 54321',
      state: 'MAHARASHTRA',
      address: 'MIDC Phase III, Behind Toll Plaza, Pune - 411018'
    },
    {
      id: 'cge-default-3',
      name: 'National Distribution Depot',
      gstin: '24AAACG9876E1Z2',
      city: 'Kandla',
      mobile: '+91 98240 67890',
      state: 'GUJARAT',
      address: 'Warehouse Block B, Near Port Road, Kandla - 370210'
    },
    {
      id: 'cge-default-4',
      name: 'Supreme Steel Traders',
      gstin: '27AAACS7788K1Z5',
      city: 'Navi Mumbai',
      mobile: '+91 98200 98765',
      state: 'MAHARASHTRA',
      address: 'Steel Market Complex, Kalamboli, Navi Mumbai - 410218'
    }
  ];

  interface ShipToQuickPreset {
    id: string;
    name: string;
    gstin?: string;
    city?: string;
    mobile?: string;
    state?: string;
    address?: string;
  }

  const DEFAULT_SHIP_TO_QUICK_PRESETS: ShipToQuickPreset[] = [
    {
      id: 'st-default-1',
      name: 'Project Site #4 - Bridge Construction, Surat',
      gstin: '24AAACG1122D1Z4',
      city: 'Surat',
      mobile: '+91 98790 11223',
      state: 'GUJARAT',
      address: 'Near NH-48 Express Highway Junction, Surat - 395006'
    },
    {
      id: 'st-default-2',
      name: 'Central Receiving Yard, Chakan',
      gstin: '27AABCM4455E1Z9',
      city: 'Chakan',
      mobile: '+91 98600 33445',
      state: 'MAHARASHTRA',
      address: 'Plot 88, Logistics Corridor, Chakan, Pune - 410501'
    },
    {
      id: 'st-default-3',
      name: 'Plant Delivery Gate #3, Vapi',
      gstin: '24AAACG9876E1Z2',
      city: 'Vapi',
      mobile: '+91 98255 66778',
      state: 'GUJARAT',
      address: 'Phase III, GIDC Industrial Estate, Vapi - 396195'
    },
    {
      id: 'st-default-4',
      name: 'Mega Power Project Site, Jamnagar',
      gstin: '24AAACG9876E1Z2',
      city: 'Jamnagar',
      mobile: '+91 98242 88990',
      state: 'GUJARAT',
      address: 'Gate No. 4, Energy Corridor, Jamnagar - 361001'
    }
  ];

  // Dynamic state for dropdown options synced with localStorage
  const [originCities, setOriginCities] = useState<string[]>(() => {
    const saved = localStorage.getItem('nt_preset_origin_cities');
    return saved ? JSON.parse(saved) : DEFAULT_CITIES;
  });

  const [destCities, setDestCities] = useState<string[]>(() => {
    const saved = localStorage.getItem('nt_preset_dest_cities');
    return saved ? JSON.parse(saved) : DEFAULT_CITIES;
  });

  const [materials, setMaterials] = useState<string[]>(() => {
    const saved = localStorage.getItem('nt_preset_materials');
    return saved ? JSON.parse(saved) : DEFAULT_MATERIALS;
  });

  const [descriptions, setDescriptions] = useState<string[]>(() => {
    const saved = localStorage.getItem('nt_preset_descriptions');
    return saved ? JSON.parse(saved) : DEFAULT_DESCRIPTIONS;
  });

  const [consigneePresets, setConsigneePresets] = useState<string[]>(() => {
    const saved = localStorage.getItem('nt_preset_consignees');
    return saved ? JSON.parse(saved) : DEFAULT_CONSIGNEES;
  });

  const [consignorPresets, setConsignorPresets] = useState<string[]>(() => {
    const saved = localStorage.getItem('nt_preset_consignors');
    return saved ? JSON.parse(saved) : DEFAULT_CONSIGNORS;
  });

  const [shipToPresets, setShipToPresets] = useState<string[]>(() => {
    const saved = localStorage.getItem('nt_preset_shipto');
    return saved ? JSON.parse(saved) : DEFAULT_SHIP_TO;
  });

  const [dispatchedPartyPresets, setDispatchedPartyPresets] = useState<string[]>(() => {
    const saved = localStorage.getItem('nt_preset_dispatched_party');
    return saved ? JSON.parse(saved) : DEFAULT_DISPATCHED_PARTY;
  });

  // Structured Dispatched Party Quick List Presets
  const [dispatchedPresets, setDispatchedPresets] = useState<DispatchedPartyPreset[]>(() => {
    const saved = localStorage.getItem('nt_preset_dispatched_party_list_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return DEFAULT_DISPATCHED_PARTY_PRESETS;
  });

  const [showDispatchedManageModal, setShowDispatchedManageModal] = useState(false);
  const [editingDispatchedPresetId, setEditingDispatchedPresetId] = useState<string | null>(null);
  const [newDispatchedPresetForm, setNewDispatchedPresetForm] = useState<{
    name: string;
    gstin: string;
    city: string;
    mobile: string;
    state: string;
    address: string;
  }>({
    name: '',
    gstin: '',
    city: '',
    mobile: '',
    state: 'GUJARAT',
    address: ''
  });

  useEffect(() => {
    localStorage.setItem('nt_preset_dispatched_party_list_v2', JSON.stringify(dispatchedPresets));
  }, [dispatchedPresets]);

  const handleApplyDispatchedPreset = (preset: DispatchedPartyPreset) => {
    setDispatchedPartyName(preset.name);
    setDispatchedPartyGSTIN(preset.gstin || '');
    setDispatchedPartyCity(preset.city || '');
    setDispatchedPartyMobile(preset.mobile || '');
    setDispatchedPartyState(preset.state || 'GUJARAT');
    setDispatchedPartyAddress(preset.address || '');
  };

  const handleSaveDispatchedPreset = () => {
    const trimmedName = newDispatchedPresetForm.name.trim();
    if (!trimmedName) return;

    const gstinVal = newDispatchedPresetForm.gstin.trim().toUpperCase();
    const cityVal = newDispatchedPresetForm.city.trim();
    const mobileVal = newDispatchedPresetForm.mobile.trim();
    const stateVal = newDispatchedPresetForm.state.trim() || 'GUJARAT';
    const addressVal = newDispatchedPresetForm.address.trim();

    if (editingDispatchedPresetId) {
      setDispatchedPresets(prev => prev.map(item => {
        if (item.id === editingDispatchedPresetId) {
          return {
            ...item,
            name: trimmedName,
            gstin: gstinVal,
            city: cityVal,
            mobile: mobileVal,
            state: stateVal,
            address: addressVal
          };
        }
        return item;
      }));

      // Keep active dispatched form data synchronized if this preset was in use
      if (dispatchedPartyName === trimmedName || dispatchedPartyName === '') {
        setDispatchedPartyName(trimmedName);
        setDispatchedPartyGSTIN(gstinVal);
        setDispatchedPartyCity(cityVal);
        setDispatchedPartyMobile(mobileVal);
        setDispatchedPartyState(stateVal);
        setDispatchedPartyAddress(addressVal);
      }

      setEditingDispatchedPresetId(null);
    } else {
      const newPreset: DispatchedPartyPreset = {
        id: `dp-preset-${Date.now()}`,
        name: trimmedName,
        gstin: gstinVal,
        city: cityVal,
        mobile: mobileVal,
        state: stateVal,
        address: addressVal
      };
      setDispatchedPresets(prev => [newPreset, ...prev.filter(p => p.name.toLowerCase() !== trimmedName.toLowerCase())]);
    }

    setNewDispatchedPresetForm({
      name: '',
      gstin: '',
      city: '',
      mobile: '',
      state: 'GUJARAT',
      address: ''
    });
  };

  const handleDeleteDispatchedPreset = (id: string) => {
    setDispatchedPresets(prev => prev.filter(p => p.id !== id));
    if (editingDispatchedPresetId === id) {
      setEditingDispatchedPresetId(null);
      setNewDispatchedPresetForm({ name: '', gstin: '', city: '', mobile: '', state: 'GUJARAT', address: '' });
    }
  };

  const handleStartEditDispatchedPreset = (preset: DispatchedPartyPreset) => {
    setEditingDispatchedPresetId(preset.id);
    setNewDispatchedPresetForm({
      name: preset.name,
      gstin: preset.gstin || '',
      city: preset.city || '',
      mobile: preset.mobile || '',
      state: preset.state || 'GUJARAT',
      address: preset.address || ''
    });
  };

  const handleResetDispatchedPresets = () => {
    setDispatchedPresets(DEFAULT_DISPATCHED_PARTY_PRESETS);
    setEditingDispatchedPresetId(null);
    setNewDispatchedPresetForm({ name: '', gstin: '', city: '', mobile: '', state: 'GUJARAT', address: '' });
  };

  // Structured Consignee Quick List Presets
  const [consigneeListPresets, setConsigneeListPresets] = useState<ConsigneeQuickPreset[]>(() => {
    const saved = localStorage.getItem('nt_preset_consignee_list_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return DEFAULT_CONSIGNEE_QUICK_PRESETS;
  });

  const [showConsigneeManageModal, setShowConsigneeManageModal] = useState(false);
  const [editingConsigneePresetId, setEditingConsigneePresetId] = useState<string | null>(null);
  const [newConsigneePresetForm, setNewConsigneePresetForm] = useState<{
    name: string;
    gstin: string;
    city: string;
    mobile: string;
    state: string;
    address: string;
  }>({
    name: '',
    gstin: '',
    city: '',
    mobile: '',
    state: 'GUJARAT',
    address: ''
  });

  useEffect(() => {
    localStorage.setItem('nt_preset_consignee_list_v2', JSON.stringify(consigneeListPresets));
  }, [consigneeListPresets]);

  const handleApplyConsigneePreset = (preset: ConsigneeQuickPreset) => {
    setConsigneeName(preset.name);
    setConsigneeGSTIN(preset.gstin || '');
    setConsigneeCity(preset.city || '');
    setConsigneeMobile(preset.mobile || '');
    setConsigneeState(preset.state || 'GUJARAT');
    setConsigneeAddress(preset.address || '');
  };

  const handleSaveConsigneePreset = () => {
    const trimmedName = newConsigneePresetForm.name.trim();
    if (!trimmedName) return;

    const gstinVal = newConsigneePresetForm.gstin.trim().toUpperCase();
    const cityVal = newConsigneePresetForm.city.trim();
    const mobileVal = newConsigneePresetForm.mobile.trim();
    const stateVal = newConsigneePresetForm.state.trim() || 'GUJARAT';
    const addressVal = newConsigneePresetForm.address.trim();

    if (editingConsigneePresetId) {
      setConsigneeListPresets(prev => prev.map(item => {
        if (item.id === editingConsigneePresetId) {
          return {
            ...item,
            name: trimmedName,
            gstin: gstinVal,
            city: cityVal,
            mobile: mobileVal,
            state: stateVal,
            address: addressVal
          };
        }
        return item;
      }));

      // Keep active consignee form synchronized
      if (consigneeName === trimmedName || consigneeName === '') {
        setConsigneeName(trimmedName);
        setConsigneeGSTIN(gstinVal);
        setConsigneeCity(cityVal);
        setConsigneeMobile(mobileVal);
        setConsigneeState(stateVal);
        setConsigneeAddress(addressVal);
      }

      setEditingConsigneePresetId(null);
    } else {
      const newPreset: ConsigneeQuickPreset = {
        id: `cge-preset-${Date.now()}`,
        name: trimmedName,
        gstin: gstinVal,
        city: cityVal,
        mobile: mobileVal,
        state: stateVal,
        address: addressVal
      };
      setConsigneeListPresets(prev => [newPreset, ...prev.filter(p => p.name.toLowerCase() !== trimmedName.toLowerCase())]);
    }

    setNewConsigneePresetForm({
      name: '',
      gstin: '',
      city: '',
      mobile: '',
      state: 'GUJARAT',
      address: ''
    });
  };

  const handleDeleteConsigneePreset = (id: string) => {
    setConsigneeListPresets(prev => prev.filter(p => p.id !== id));
    if (editingConsigneePresetId === id) {
      setEditingConsigneePresetId(null);
      setNewConsigneePresetForm({ name: '', gstin: '', city: '', mobile: '', state: 'GUJARAT', address: '' });
    }
  };

  const handleStartEditConsigneePreset = (preset: ConsigneeQuickPreset) => {
    setEditingConsigneePresetId(preset.id);
    setNewConsigneePresetForm({
      name: preset.name,
      gstin: preset.gstin || '',
      city: preset.city || '',
      mobile: preset.mobile || '',
      state: preset.state || 'GUJARAT',
      address: preset.address || ''
    });
  };

  const handleResetConsigneePresets = () => {
    setConsigneeListPresets(DEFAULT_CONSIGNEE_QUICK_PRESETS);
    setEditingConsigneePresetId(null);
    setNewConsigneePresetForm({ name: '', gstin: '', city: '', mobile: '', state: 'GUJARAT', address: '' });
  };

  // Structured Ship To (Delivery Site) Quick List Presets
  const [shipToListPresets, setShipToListPresets] = useState<ShipToQuickPreset[]>(() => {
    const saved = localStorage.getItem('nt_preset_shipto_list_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return DEFAULT_SHIP_TO_QUICK_PRESETS;
  });

  const [showShipToManageModal, setShowShipToManageModal] = useState(false);
  const [editingShipToPresetId, setEditingShipToPresetId] = useState<string | null>(null);
  const [newShipToPresetForm, setNewShipToPresetForm] = useState<{
    name: string;
    gstin: string;
    city: string;
    mobile: string;
    state: string;
    address: string;
  }>({
    name: '',
    gstin: '',
    city: '',
    mobile: '',
    state: 'GUJARAT',
    address: ''
  });

  useEffect(() => {
    localStorage.setItem('nt_preset_shipto_list_v2', JSON.stringify(shipToListPresets));
  }, [shipToListPresets]);

  const handleApplyShipToPreset = (preset: ShipToQuickPreset) => {
    setShipToName(preset.name);
    setShipToGSTIN(preset.gstin || '');
    setShipToCity(preset.city || '');
    setShipToMobile(preset.mobile || '');
    setShipToState(preset.state || 'GUJARAT');
    setShipToAddress(preset.address || '');
  };

  const handleSaveShipToPreset = () => {
    const trimmedName = newShipToPresetForm.name.trim();
    if (!trimmedName) return;

    const gstinVal = newShipToPresetForm.gstin.trim().toUpperCase();
    const cityVal = newShipToPresetForm.city.trim();
    const mobileVal = newShipToPresetForm.mobile.trim();
    const stateVal = newShipToPresetForm.state.trim() || 'GUJARAT';
    const addressVal = newShipToPresetForm.address.trim();

    if (editingShipToPresetId) {
      setShipToListPresets(prev => prev.map(item => {
        if (item.id === editingShipToPresetId) {
          return {
            ...item,
            name: trimmedName,
            gstin: gstinVal,
            city: cityVal,
            mobile: mobileVal,
            state: stateVal,
            address: addressVal
          };
        }
        return item;
      }));

      // Keep active shipTo form synchronized
      if (shipToName === trimmedName || shipToName === '') {
        setShipToName(trimmedName);
        setShipToGSTIN(gstinVal);
        setShipToCity(cityVal);
        setShipToMobile(mobileVal);
        setShipToState(stateVal);
        setShipToAddress(addressVal);
      }

      setEditingShipToPresetId(null);
    } else {
      const newPreset: ShipToQuickPreset = {
        id: `st-preset-${Date.now()}`,
        name: trimmedName,
        gstin: gstinVal,
        city: cityVal,
        mobile: mobileVal,
        state: stateVal,
        address: addressVal
      };
      setShipToListPresets(prev => [newPreset, ...prev.filter(p => p.name.toLowerCase() !== trimmedName.toLowerCase())]);
    }

    setNewShipToPresetForm({
      name: '',
      gstin: '',
      city: '',
      mobile: '',
      state: 'GUJARAT',
      address: ''
    });
  };

  const handleDeleteShipToPreset = (id: string) => {
    setShipToListPresets(prev => prev.filter(p => p.id !== id));
    if (editingShipToPresetId === id) {
      setEditingShipToPresetId(null);
      setNewShipToPresetForm({ name: '', gstin: '', city: '', mobile: '', state: 'GUJARAT', address: '' });
    }
  };

  const handleStartEditShipToPreset = (preset: ShipToQuickPreset) => {
    setEditingShipToPresetId(preset.id);
    setNewShipToPresetForm({
      name: preset.name,
      gstin: preset.gstin || '',
      city: preset.city || '',
      mobile: preset.mobile || '',
      state: preset.state || 'GUJARAT',
      address: preset.address || ''
    });
  };

  const handleResetShipToPresets = () => {
    setShipToListPresets(DEFAULT_SHIP_TO_QUICK_PRESETS);
    setEditingShipToPresetId(null);
    setNewShipToPresetForm({ name: '', gstin: '', city: '', mobile: '', state: 'GUJARAT', address: '' });
  };

  // Modal for managing dropdown options
  type PresetCategory = 'consignor' | 'consignee' | 'shipto' | 'dispatched' | 'origin' | 'destination' | 'material' | 'description';
  const [activeManageCategory, setActiveManageCategory] = useState<PresetCategory | null>(null);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [editingOption, setEditingOption] = useState<{ oldVal: string; newVal: string } | null>(null);

  // Save presets to localStorage
  useEffect(() => {
    localStorage.setItem('nt_preset_origin_cities', JSON.stringify(originCities));
  }, [originCities]);

  useEffect(() => {
    localStorage.setItem('nt_preset_dest_cities', JSON.stringify(destCities));
  }, [destCities]);

  useEffect(() => {
    localStorage.setItem('nt_preset_materials', JSON.stringify(materials));
  }, [materials]);

  useEffect(() => {
    localStorage.setItem('nt_preset_descriptions', JSON.stringify(descriptions));
  }, [descriptions]);

  useEffect(() => {
    localStorage.setItem('nt_preset_consignees', JSON.stringify(consigneePresets));
  }, [consigneePresets]);

  useEffect(() => {
    localStorage.setItem('nt_preset_consignors', JSON.stringify(consignorPresets));
  }, [consignorPresets]);

  useEffect(() => {
    localStorage.setItem('nt_preset_shipto', JSON.stringify(shipToPresets));
  }, [shipToPresets]);

  useEffect(() => {
    localStorage.setItem('nt_preset_dispatched_party', JSON.stringify(dispatchedPartyPresets));
  }, [dispatchedPartyPresets]);

  // Add / Delete / Edit option handlers
  const handleAddOption = (category: PresetCategory, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (category === 'origin') {
      if (!originCities.includes(trimmed)) setOriginCities([trimmed, ...originCities]);
      setOrigin(trimmed);
    } else if (category === 'destination') {
      if (!destCities.includes(trimmed)) setDestCities([trimmed, ...destCities]);
      setDestination(trimmed);
    } else if (category === 'material') {
      if (!materials.includes(trimmed)) setMaterials([trimmed, ...materials]);
      setMaterialType(trimmed);
    } else if (category === 'description') {
      if (!descriptions.includes(trimmed)) setDescriptions([trimmed, ...descriptions]);
    } else if (category === 'consignee') {
      if (!consigneePresets.includes(trimmed)) setConsigneePresets([trimmed, ...consigneePresets]);
      setConsigneeName(trimmed);
    } else if (category === 'consignor') {
      if (!consignorPresets.includes(trimmed)) setConsignorPresets([trimmed, ...consignorPresets]);
      setConsignorName(trimmed);
    } else if (category === 'shipto') {
      if (!shipToPresets.includes(trimmed)) setShipToPresets([trimmed, ...shipToPresets]);
      setShipToName(trimmed);
    } else if (category === 'dispatched') {
      if (!dispatchedPartyPresets.includes(trimmed)) setDispatchedPartyPresets([trimmed, ...dispatchedPartyPresets]);
      setDispatchedPartyName(trimmed);
    }

    setNewOptionInput('');
  };

  const handleDeleteOption = (category: PresetCategory, optionToDelete: string) => {
    if (category === 'origin') setOriginCities(originCities.filter(item => item !== optionToDelete));
    else if (category === 'destination') setDestCities(destCities.filter(item => item !== optionToDelete));
    else if (category === 'material') setMaterials(materials.filter(item => item !== optionToDelete));
    else if (category === 'description') setDescriptions(descriptions.filter(item => item !== optionToDelete));
    else if (category === 'consignee') setConsigneePresets(consigneePresets.filter(item => item !== optionToDelete));
    else if (category === 'consignor') setConsignorPresets(consignorPresets.filter(item => item !== optionToDelete));
    else if (category === 'shipto') setShipToPresets(shipToPresets.filter(item => item !== optionToDelete));
    else if (category === 'dispatched') setDispatchedPartyPresets(dispatchedPartyPresets.filter(item => item !== optionToDelete));
  };

  const handleEditOptionSubmit = (category: PresetCategory, oldVal: string, newVal: string) => {
    const trimmed = newVal.trim();
    if (!trimmed || trimmed === oldVal) {
      setEditingOption(null);
      return;
    }

    const updateList = (list: string[]) => list.map(item => item === oldVal ? trimmed : item);

    if (category === 'origin') setOriginCities(updateList);
    else if (category === 'destination') setDestCities(updateList);
    else if (category === 'material') setMaterials(updateList);
    else if (category === 'description') setDescriptions(updateList);
    else if (category === 'consignee') setConsigneePresets(updateList);
    else if (category === 'consignor') setConsignorPresets(updateList);
    else if (category === 'shipto') setShipToPresets(updateList);
    else if (category === 'dispatched') setDispatchedPartyPresets(updateList);

    if (category === 'consignee' && consigneeName === oldVal) setConsigneeName(trimmed);
    if (category === 'consignor' && consignorName === oldVal) setConsignorName(trimmed);
    if (category === 'shipto' && shipToName === oldVal) setShipToName(trimmed);
    if (category === 'dispatched' && dispatchedPartyName === oldVal) setDispatchedPartyName(trimmed);
    if (category === 'origin' && origin === oldVal) setOrigin(trimmed);
    if (category === 'destination' && destination === oldVal) setDestination(trimmed);
    if (category === 'material' && materialType === oldVal) setMaterialType(trimmed);

    setEditingOption(null);
  };

  const handleResetDefaults = (category: PresetCategory) => {
    if (category === 'origin') setOriginCities(DEFAULT_CITIES);
    if (category === 'destination') setDestCities(DEFAULT_CITIES);
    if (category === 'material') setMaterials(DEFAULT_MATERIALS);
    if (category === 'description') setDescriptions(DEFAULT_DESCRIPTIONS);
    if (category === 'consignee') setConsigneePresets(DEFAULT_CONSIGNEES);
    if (category === 'consignor') setConsignorPresets(DEFAULT_CONSIGNORS);
    if (category === 'shipto') setShipToPresets(DEFAULT_SHIP_TO);
    if (category === 'dispatched') setDispatchedPartyPresets(DEFAULT_DISPATCHED_PARTY);
  };

  // Full party creation & modification modal state
  const [showCreatePartyModal, setShowCreatePartyModal] = useState(false);
  const [partyModalMode, setPartyModalMode] = useState<'add' | 'edit' | 'list'>('add');
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [partyModalSearch, setPartyModalSearch] = useState('');
  const [partyTargetSection, setPartyTargetSection] = useState<'consignor' | 'consignee' | 'shipto' | 'dispatched'>('consignee');
  const [newPartyForm, setNewPartyForm] = useState({
    name: '',
    partyUser: '',
    gstin: '',
    state: 'GUJARAT',
    stateCode: '24',
    city: '',
    address: '',
    phone: '',
    partyType: 'both' as 'consignor' | 'consignee' | 'both'
  });

  const getSectionValues = (section: 'consignor' | 'consignee' | 'shipto' | 'dispatched') => {
    if (section === 'consignee') {
      return {
        name: consigneeName || '',
        partyUser: consigneePartyUser || '',
        gstin: consigneeGSTIN || '',
        state: consigneeState || 'GUJARAT',
        stateCode: consigneeState === 'GUJARAT' ? '24' : consigneeState === 'MAHARASHTRA' ? '27' : '24',
        city: '',
        address: consigneeAddress || '',
        phone: '',
        partyType: 'consignee' as const
      };
    } else if (section === 'shipto') {
      return {
        name: shipToName || '',
        partyUser: shipToPartyUser || '',
        gstin: shipToGSTIN || '',
        state: shipToState || 'GUJARAT',
        stateCode: shipToState === 'GUJARAT' ? '24' : shipToState === 'MAHARASHTRA' ? '27' : '24',
        city: '',
        address: shipToAddress || '',
        phone: '',
        partyType: 'consignee' as const
      };
    } else if (section === 'dispatched') {
      return {
        name: dispatchedPartyName || '',
        partyUser: dispatchedPartyPartyUser || '',
        gstin: dispatchedPartyGSTIN || '',
        state: dispatchedPartyState || 'GUJARAT',
        stateCode: dispatchedPartyState === 'GUJARAT' ? '24' : dispatchedPartyState === 'MAHARASHTRA' ? '27' : '24',
        city: '',
        address: dispatchedPartyAddress || '',
        phone: '',
        partyType: 'consignor' as const
      };
    } else {
      return {
        name: consignorName || '',
        partyUser: '',
        gstin: consignorGSTIN || '',
        state: consignorState || 'GUJARAT',
        stateCode: consignorStateCode || '24',
        city: '',
        address: consignorAddress || '',
        phone: '',
        partyType: 'consignor' as const
      };
    }
  };

  const openAddPartyModal = (section: 'consignor' | 'consignee' | 'shipto' | 'dispatched') => {
    setPartyTargetSection(section);
    setEditingPartyId(null);
    setPartyModalMode('add');
    setPartyModalSearch('');
    setNewPartyForm(getSectionValues(section));
    setShowCreatePartyModal(true);
  };

  const openEditPartyModal = (section: 'consignor' | 'consignee' | 'shipto' | 'dispatched', specificPartyId?: string) => {
    setPartyTargetSection(section);
    setPartyModalSearch('');
    let targetParty: Party | undefined;

    if (specificPartyId) {
      targetParty = parties.find(p => p.id === specificPartyId);
    } else {
      // Try to find by matching typed name
      const curVals = getSectionValues(section);
      if (curVals.name.trim()) {
        targetParty = parties.find(p => p.name.toLowerCase().trim() === curVals.name.toLowerCase().trim());
      }
    }

    if (targetParty) {
      setEditingPartyId(targetParty.id);
      setPartyModalMode('edit');
      setNewPartyForm({
        name: targetParty.name || '',
        partyUser: targetParty.partyUser || '',
        gstin: targetParty.gstin || '',
        state: targetParty.state || 'GUJARAT',
        stateCode: targetParty.stateCode || '24',
        city: targetParty.city || '',
        address: targetParty.address || '',
        phone: targetParty.phone || '',
        partyType: (targetParty.partyType as any) || 'both'
      });
    } else {
      // If no match, check if there are parties available
      if (parties.length > 0) {
        const first = parties[0];
        setEditingPartyId(first.id);
        setPartyModalMode('edit');
        setNewPartyForm({
          name: first.name,
          partyUser: first.partyUser || '',
          gstin: first.gstin || '',
          state: first.state || 'GUJARAT',
          stateCode: first.stateCode || '24',
          city: first.city || '',
          address: first.address || '',
          phone: first.phone || '',
          partyType: (first.partyType as any) || 'both'
        });
      } else {
        setEditingPartyId(null);
        setPartyModalMode('add');
        setNewPartyForm(getSectionValues(section));
      }
    }

    setShowCreatePartyModal(true);
  };

  const openManagePartyModal = (section: 'consignor' | 'consignee' | 'shipto' | 'dispatched') => {
    setPartyTargetSection(section);
    setPartyModalMode('list');
    setPartyModalSearch('');
    setShowCreatePartyModal(true);
  };

  const handleDeletePartyProfile = async (section: 'consignor' | 'consignee' | 'shipto' | 'dispatched', specificPartyId?: string) => {
    let partyToDelete: Party | undefined;

    if (specificPartyId) {
      partyToDelete = parties.find(p => p.id === specificPartyId);
    } else {
      const curVals = getSectionValues(section);
      if (curVals.name.trim()) {
        partyToDelete = parties.find(p => p.name.toLowerCase().trim() === curVals.name.toLowerCase().trim());
      }
    }

    if (partyToDelete) {
      if (window.confirm(`Are you sure you want to delete "${partyToDelete.name}" permanently from party profiles?`)) {
        await deleteParty(partyToDelete.id);
        
        // If current section was using this party, clear fields
        if (section === 'consignee' && consigneeName.toLowerCase().trim() === partyToDelete.name.toLowerCase().trim()) {
          setConsigneeName('');
          setConsigneeGSTIN('');
          setConsigneeAddress('');
        } else if (section === 'consignor' && consignorName.toLowerCase().trim() === partyToDelete.name.toLowerCase().trim()) {
          setConsignorName('');
          setConsignorGSTIN('');
          setConsignorAddress('');
        } else if (section === 'shipto' && shipToName.toLowerCase().trim() === partyToDelete.name.toLowerCase().trim()) {
          setShipToName('');
          setShipToGSTIN('');
          setShipToAddress('');
        } else if (section === 'dispatched' && dispatchedPartyName.toLowerCase().trim() === partyToDelete.name.toLowerCase().trim()) {
          setDispatchedPartyName('');
          setDispatchedPartyGSTIN('');
          setDispatchedPartyAddress('');
        }

        // If inside modal and was editing this party, switch to add mode
        if (editingPartyId === partyToDelete.id) {
          setEditingPartyId(null);
          setPartyModalMode('add');
          setNewPartyForm(getSectionValues(section));
        }
      }
    } else {
      // If no party matched, open the party manager list so user can choose which one to delete
      openManagePartyModal(section);
    }
  };

  const handleSelectPartyToEditInModal = (partyId: string) => {
    const p = parties.find(item => item.id === partyId);
    if (!p) return;
    setEditingPartyId(p.id);
    setNewPartyForm({
      name: p.name,
      partyUser: p.partyUser || '',
      gstin: p.gstin || '',
      state: p.state || 'GUJARAT',
      stateCode: p.stateCode || '24',
      city: p.city || '',
      address: p.address || '',
      phone: p.phone || '',
      partyType: (p.partyType as any) || 'both'
    });
  };

  const handleSaveNewPartySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPartyForm.name.trim()) {
      alert('Please enter Party / Receiver Name.');
      return;
    }

    const fullAddr = newPartyForm.address ? (newPartyForm.city ? `${newPartyForm.address.trim()}, ${newPartyForm.city.trim()}` : newPartyForm.address.trim()) : newPartyForm.city.trim();

    if (partyModalMode === 'edit' && editingPartyId) {
      const existing = parties.find(p => p.id === editingPartyId);
      const updatedParty: Party = {
        ...(existing || {}),
        id: editingPartyId,
        name: newPartyForm.name.trim(),
        partyUser: newPartyForm.partyUser.trim(),
        gstin: newPartyForm.gstin.trim().toUpperCase(),
        address: newPartyForm.address.trim(),
        city: newPartyForm.city.trim(),
        state: newPartyForm.state.trim() || 'GUJARAT',
        stateCode: newPartyForm.stateCode.trim() || '24',
        phone: newPartyForm.phone.trim(),
        partyType: newPartyForm.partyType,
        accountCategory: existing?.accountCategory || 'party',
        openingBalance: existing?.openingBalance || 0,
        currentBalance: existing?.currentBalance || 0,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveParty(updatedParty);

      if (partyTargetSection === 'consignee') {
        setConsigneeName(updatedParty.name);
        setConsigneePartyUser(updatedParty.partyUser || '');
        setConsigneeGSTIN(updatedParty.gstin);
        setConsigneeState(updatedParty.state);
        setConsigneeAddress(fullAddr);
      } else if (partyTargetSection === 'shipto') {
        setShipToName(updatedParty.name);
        setShipToPartyUser(updatedParty.partyUser || '');
        setShipToGSTIN(updatedParty.gstin);
        setShipToState(updatedParty.state);
        setShipToAddress(fullAddr);
      } else if (partyTargetSection === 'dispatched') {
        setDispatchedPartyName(updatedParty.name);
        setDispatchedPartyPartyUser(updatedParty.partyUser || '');
        setDispatchedPartyGSTIN(updatedParty.gstin);
        setDispatchedPartyState(updatedParty.state);
        setDispatchedPartyAddress(fullAddr);
      } else if (partyTargetSection === 'consignor') {
        setSelectedPartyId(updatedParty.id);
        setConsignorName(updatedParty.name);
        setConsignorGSTIN(updatedParty.gstin);
        setConsignorState(updatedParty.state);
        setConsignorStateCode(updatedParty.stateCode);
        setConsignorAddress(fullAddr);
      }
    } else {
      // Add new party
      const newParty: Party = {
        id: `pty-${Date.now()}`,
        name: newPartyForm.name.trim(),
        partyUser: newPartyForm.partyUser.trim(),
        gstin: newPartyForm.gstin.trim().toUpperCase(),
        address: newPartyForm.address.trim(),
        city: newPartyForm.city.trim(),
        state: newPartyForm.state.trim() || 'GUJARAT',
        stateCode: newPartyForm.stateCode.trim() || '24',
        phone: newPartyForm.phone.trim(),
        partyType: newPartyForm.partyType,
        accountCategory: 'party',
        openingBalance: 0,
        currentBalance: 0,
        createdAt: new Date().toISOString()
      };

      if (onAddParty) {
        onAddParty(newParty);
      } else {
        await saveParty(newParty);
      }

      if (partyTargetSection === 'consignee') {
        setConsigneeName(newParty.name);
        setConsigneePartyUser(newParty.partyUser || '');
        setConsigneeGSTIN(newParty.gstin);
        setConsigneeCity(newParty.city || '');
        setConsigneeMobile(newParty.phone || '');
        setConsigneeState(newParty.state);
        setConsigneeAddress(fullAddr);
      } else if (partyTargetSection === 'shipto') {
        setShipToName(newParty.name);
        setShipToPartyUser(newParty.partyUser || '');
        setShipToGSTIN(newParty.gstin);
        setShipToCity(newParty.city || '');
        setShipToMobile(newParty.phone || '');
        setShipToState(newParty.state);
        setShipToAddress(fullAddr);
      } else if (partyTargetSection === 'dispatched') {
        setDispatchedPartyName(newParty.name);
        setDispatchedPartyPartyUser(newParty.partyUser || '');
        setDispatchedPartyGSTIN(newParty.gstin);
        setDispatchedPartyCity(newParty.city || '');
        setDispatchedPartyMobile(newParty.phone || '');
        setDispatchedPartyState(newParty.state);
        setDispatchedPartyAddress(fullAddr);
      } else if (partyTargetSection === 'consignor') {
        setSelectedPartyId(newParty.id);
        setConsignorName(newParty.name);
        setConsignorPartyUser(newParty.partyUser || '');
        setConsignorGSTIN(newParty.gstin);
        setConsignorCity(newParty.city || '');
        setConsignorMobile(newParty.phone || '');
        setConsignorState(newParty.state);
        setConsignorStateCode(newParty.stateCode);
        setConsignorAddress(newParty.address || fullAddr);
      }
    }

    setShowCreatePartyModal(false);
  };

  // Handle party auto-fill
  const handleSelectParty = (partyId: string) => {
    if (partyId === 'manage_options') {
      setActiveManageCategory('consignor');
      return;
    }
    setSelectedPartyId(partyId);
    const party = parties.find(p => p.id === partyId);
    if (party) {
      setConsignorName(party.name);
      setConsignorPartyUser(party.partyUser || '');
      setConsignorGSTIN(party.gstin);
      setConsignorCity(party.city || '');
      setConsignorMobile(party.phone || '');
      setConsignorAddress(party.address || '');
      setConsignorState(party.state || 'GUJARAT');
      setConsignorStateCode(party.stateCode || '24');

      // Auto check if inter-state or intra-state
      if (party.state && party.state.toLowerCase() !== 'gujarat') {
        setTaxType('inter_state');
      } else {
        setTaxType('intra_state');
      }
    } else if (partyId === 'cash_customer') {
      setConsignorName('Cash Customer');
      setConsignorPartyUser('');
      setConsignorGSTIN('');
      setConsignorCity('Gujarat');
      setConsignorMobile('');
      setConsignorAddress('Local Market, Gujarat');
      setConsignorState('GUJARAT');
      setConsignorStateCode('24');
    }
  };

  // Auto-match typed text with saved party
  const tryMatchAndFillConsignee = (nameVal: string) => {
    setConsigneeName(nameVal);
    if (!nameVal.trim()) return;

    // Check Consignee Quick List Presets first
    const presetMatched = consigneeListPresets.find(p => p.name.toLowerCase().trim() === nameVal.toLowerCase().trim());
    if (presetMatched) {
      setConsigneeGSTIN(presetMatched.gstin || '');
      setConsigneeCity(presetMatched.city || '');
      setConsigneeMobile(presetMatched.mobile || '');
      setConsigneeAddress(presetMatched.address || '');
      setConsigneeState(presetMatched.state || 'GUJARAT');
      return;
    }

    const matched = parties.find(p => p.name.toLowerCase().trim() === nameVal.toLowerCase().trim());
    if (matched) {
      if (matched.partyUser) setConsigneePartyUser(matched.partyUser);
      setConsigneeGSTIN(matched.gstin || '');
      setConsigneeCity(matched.city || '');
      setConsigneeMobile(matched.phone || '');
      setConsigneeAddress(matched.address || '');
      setConsigneeState(matched.state || 'GUJARAT');
    }
  };

  const tryMatchAndFillShipTo = (nameVal: string) => {
    setShipToName(nameVal);
    if (!nameVal.trim()) return;

    // Check Ship To Quick List Presets first
    const presetMatched = shipToListPresets.find(p => p.name.toLowerCase().trim() === nameVal.toLowerCase().trim());
    if (presetMatched) {
      setShipToGSTIN(presetMatched.gstin || '');
      setShipToCity(presetMatched.city || '');
      setShipToMobile(presetMatched.mobile || '');
      setShipToAddress(presetMatched.address || '');
      setShipToState(presetMatched.state || 'GUJARAT');
      return;
    }

    const matched = parties.find(p => p.name.toLowerCase().trim() === nameVal.toLowerCase().trim());
    if (matched) {
      if (matched.partyUser) setShipToPartyUser(matched.partyUser);
      setShipToGSTIN(matched.gstin || '');
      setShipToCity(matched.city || '');
      setShipToMobile(matched.phone || '');
      setShipToAddress(matched.address || '');
      setShipToState(matched.state || 'GUJARAT');
    }
  };

  // Handle consignee party auto-fill
  const handleSelectConsigneeParty = (partyId: string) => {
    if (partyId === 'manage_options') {
      setActiveManageCategory('consignee');
      return;
    }
    const party = parties.find(p => p.id === partyId);
    if (party) {
      setConsigneeName(party.name);
      setConsigneePartyUser(party.partyUser || '');
      setConsigneeGSTIN(party.gstin || '');
      setConsigneeCity(party.city || '');
      setConsigneeMobile(party.phone || '');
      setConsigneeAddress(party.address || '');
      setConsigneeState(party.state || 'GUJARAT');
    } else if (partyId === 'site_engineer') {
      setConsigneeName('Site Engineer / Plant Incharge');
      setConsigneePartyUser('Site Engineer');
      setConsigneeGSTIN('');
      setConsigneeCity('');
      setConsigneeMobile('');
      setConsigneeAddress('Unloading Project Site');
      setConsigneeState('GUJARAT');
    } else if (partyId === 'warehouse') {
      setConsigneeName('Destination Warehouse / Stockyard');
      setConsigneePartyUser('Warehouse Manager');
      setConsigneeGSTIN('');
      setConsigneeCity('');
      setConsigneeMobile('');
      setConsigneeAddress('Logistics Park, Destination City');
      setConsigneeState('GUJARAT');
    } else if (partyId.startsWith('preset-')) {
      const presetVal = partyId.replace('preset-', '');
      setConsigneeName(presetVal);
      const matched = parties.find(p => p.name.toLowerCase() === presetVal.toLowerCase());
      if (matched) {
        setConsigneePartyUser(matched.partyUser || '');
        setConsigneeGSTIN(matched.gstin || '');
        setConsigneeCity(matched.city || '');
        setConsigneeMobile(matched.phone || '');
        setConsigneeAddress(matched.address || '');
        setConsigneeState(matched.state || 'GUJARAT');
      }
    }
  };

  // Handle Ship To auto-fill
  const handleCopyConsigneeToShipTo = () => {
    setShipToName(consigneeName || 'Same as Consignee');
    setShipToPartyUser(consigneePartyUser);
    setShipToGSTIN(consigneeGSTIN);
    setShipToCity(consigneeCity);
    setShipToMobile(consigneeMobile);
    setShipToAddress(consigneeAddress);
    setShipToState(consigneeState);
  };

  const handleSelectShipToParty = (value: string) => {
    if (value === 'manage_options') {
      openManagePartyModal('shipto');
      return;
    }
    if (value === 'same_as_consignee') {
      handleCopyConsigneeToShipTo();
      return;
    }
    const party = parties.find(p => p.id === value);
    if (party) {
      setShipToName(party.name);
      setShipToPartyUser(party.partyUser || '');
      setShipToGSTIN(party.gstin || '');
      setShipToCity(party.city || '');
      setShipToMobile(party.phone || '');
      setShipToAddress(party.address || '');
      setShipToState(party.state || 'GUJARAT');
    } else if (value.startsWith('preset-')) {
      const presetVal = value.replace('preset-', '');
      setShipToName(presetVal);
      if (presetVal === 'Same as Consignee Address') {
        handleCopyConsigneeToShipTo();
      } else {
        const matched = parties.find(p => p.name.toLowerCase() === presetVal.toLowerCase());
        if (matched) {
          setShipToPartyUser(matched.partyUser || '');
          setShipToGSTIN(matched.gstin || '');
          setShipToCity(matched.city || '');
          setShipToMobile(matched.phone || '');
          setShipToAddress(matched.address || '');
          setShipToState(matched.state || 'GUJARAT');
        }
      }
    }
  };

  // Handle Dispatched Party auto-fill
  const tryMatchAndFillDispatchedParty = (nameVal: string) => {
    setDispatchedPartyName(nameVal);
    if (!nameVal.trim()) return;

    // Check Dispatched Quick List Presets first
    const presetMatched = dispatchedPresets.find(p => p.name.toLowerCase().trim() === nameVal.toLowerCase().trim());
    if (presetMatched) {
      setDispatchedPartyGSTIN(presetMatched.gstin || '');
      setDispatchedPartyCity(presetMatched.city || '');
      setDispatchedPartyMobile(presetMatched.mobile || '');
      setDispatchedPartyAddress(presetMatched.address || '');
      setDispatchedPartyState(presetMatched.state || 'GUJARAT');
      return;
    }

    const matched = parties.find(p => p.name.toLowerCase().trim() === nameVal.toLowerCase().trim());
    if (matched) {
      if (matched.partyUser) setDispatchedPartyPartyUser(matched.partyUser);
      setDispatchedPartyGSTIN(matched.gstin || '');
      setDispatchedPartyCity(matched.city || '');
      setDispatchedPartyMobile(matched.phone || '');
      setDispatchedPartyAddress(matched.address || '');
      setDispatchedPartyState(matched.state || 'GUJARAT');
    }
  };

  const handleCopyConsignorToDispatchedParty = () => {
    setDispatchedPartyName(consignorName || 'Same as Consignor');
    setDispatchedPartyPartyUser('');
    setDispatchedPartyGSTIN(consignorGSTIN);
    setDispatchedPartyAddress(consignorAddress);
    setDispatchedPartyState(consignorState);
    const matched = parties.find(p => p.name.toLowerCase().trim() === (consignorName || '').toLowerCase().trim());
    if (matched) {
      setDispatchedPartyCity(matched.city || '');
      setDispatchedPartyMobile(matched.phone || '');
    }
  };

  const handleSelectDispatchedParty = (value: string) => {
    if (value === 'manage_options') {
      setActiveManageCategory('dispatched');
      return;
    }
    if (value === 'same_as_consignor') {
      handleCopyConsignorToDispatchedParty();
      return;
    }
    const party = parties.find(p => p.id === value);
    if (party) {
      setDispatchedPartyName(party.name);
      setDispatchedPartyPartyUser(party.partyUser || '');
      setDispatchedPartyGSTIN(party.gstin || '');
      setDispatchedPartyCity(party.city || '');
      setDispatchedPartyMobile(party.phone || '');
      setDispatchedPartyAddress(party.address ? (party.city ? `${party.address}, ${party.city}` : party.address) : party.city || '');
      setDispatchedPartyState(party.state || 'GUJARAT');
    } else if (value.startsWith('preset-')) {
      const presetVal = value.replace('preset-', '');
      setDispatchedPartyName(presetVal);
      if (presetVal === 'Same as Consignor Address') {
        handleCopyConsignorToDispatchedParty();
      } else {
        const matched = parties.find(p => p.name.toLowerCase() === presetVal.toLowerCase());
        if (matched) {
          setDispatchedPartyPartyUser(matched.partyUser || '');
          setDispatchedPartyGSTIN(matched.gstin || '');
          setDispatchedPartyCity(matched.city || '');
          setDispatchedPartyMobile(matched.phone || '');
          setDispatchedPartyAddress(matched.address ? (matched.city ? `${matched.address}, ${matched.city}` : matched.address) : matched.city || '');
          setDispatchedPartyState(matched.state || 'GUJARAT');
        }
      }
    }
  };

  // Handle vehicle auto-fill
  const handleSelectVehicle = (vehId: string) => {
    setSelectedVehicleId(vehId);
    const veh = vehicles.find(v => v.id === vehId);
    if (veh) {
      setVehicleNumber(veh.vehicleNumber);
      setDriverName(veh.driverName);
      setDriverPhone(veh.driverPhone);
    }
  };

  // Items manipulation
  const addItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}`,
        description: 'Additional Transport / Extra Trip Charges',
        packagesCount: 1,
        weightTons: 1,
        ratePerTon: 1000,
        quantity: 1,
        unit: 'Trips',
        amount: 1000
      }
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const numVal = value === '' ? 0 : Number(value);
        const updated = { ...item, [field]: value };

        if (field === 'quantity') {
          const qty = numVal;
          const rate = Number(item.ratePerTon) || 0;
          updated.quantity = qty;
          if (item.unit === 'Tons') {
            updated.weightTons = qty;
          }
          updated.amount = qty * rate;
        } else if (field === 'ratePerTon') {
          const rate = numVal;
          const qty = Number(item.quantity) || 1;
          updated.ratePerTon = rate;
          updated.amount = qty * rate;
        } else if (field === 'amount') {
          const amt = numVal;
          const qty = Number(item.quantity) || 1;
          updated.amount = amt;
          updated.ratePerTon = qty > 0 ? Number((amt / qty).toFixed(2)) : amt;
        } else if (field === 'weightTons') {
          const w = numVal;
          updated.weightTons = w;
          if (item.unit === 'Tons') {
            updated.quantity = w;
            updated.amount = w * (Number(item.ratePerTon) || 0);
          }
        }
        return updated;
      }
      return item;
    }));
  };

  // Computations
  const grossFreight = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const subTotal = grossFreight + Number(loadingCharges) + Number(unloadingCharges) + Number(detentionCharges) + Number(otherCharges);

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let totalTax = 0;

  if (invoiceType === 'tax_invoice' && taxMechanism === 'forward_charge') {
    if (taxType === 'intra_state') {
      cgstRate = taxSlab / 2;
      sgstRate = taxSlab / 2;
      cgstAmount = (subTotal * cgstRate) / 100;
      sgstAmount = (subTotal * sgstRate) / 100;
      totalTax = cgstAmount + sgstAmount;
    } else {
      igstRate = taxSlab;
      igstAmount = (subTotal * igstRate) / 100;
      totalTax = igstAmount;
    }
  } else if (invoiceType === 'tax_invoice' && taxMechanism === 'rcm') {
    // Under RCM, 5% tax rate applies to recipient, but isn't added to invoice grand total
    totalTax = (subTotal * 5) / 100;
  }

  const rawGrandTotal = invoiceType === 'tax_invoice' && taxMechanism === 'forward_charge' 
    ? subTotal + totalTax 
    : subTotal;

  const grandTotal = rawGrandTotal + Number(roundOff || 0);

  const handleAutoRoundOff = () => {
    const rounded = Math.round(rawGrandTotal);
    const diff = Math.round((rounded - rawGrandTotal) * 100) / 100;
    setRoundOff(diff);
  };

  // TDS Calculation (u/s 194C)
  let calculatedTdsAmount = 0;
  if (tdsApplicable) {
    if (tdsDeducteeType === 'individual') {
      calculatedTdsAmount = Math.round((subTotal * 1) / 100);
    } else if (tdsDeducteeType === 'company') {
      calculatedTdsAmount = Math.round((subTotal * 2) / 100);
    } else if (tdsDeducteeType === 'custom') {
      if (tdsRate > 0) {
        calculatedTdsAmount = Math.round((subTotal * tdsRate) / 100);
      } else {
        calculatedTdsAmount = Number(customTdsAmount) || 0;
      }
    }
  }

  const totalDeductions = Number(advancePaid) + Number(fuelDeduction) + Number(calculatedTdsAmount) + Number(kasarDeduction);
  const netPayable = Math.max(0, grandTotal - totalDeductions);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const existingPayments = initialInvoice?.payments || [];
    let initialPaymentList = [...existingPayments];

    // If advance paid is greater than 0 and no payment recorded yet, record advance payment
    if (advancePaid > 0 && initialPaymentList.length === 0) {
      initialPaymentList.push({
        id: `pay-init-${Date.now()}`,
        date: lrDate,
        amount: Number(advancePaid),
        mode: 'bank_neft',
        referenceNo: 'ADVANCE-ENTRY',
        notes: 'Advance recorded during LR creation'
      });
    }

    const totalPaidCalculated = initialPaymentList.reduce((acc, p) => acc + p.amount, 0);
    const balanceDueCalculated = Math.max(0, netPayable - totalPaidCalculated);

    let paymentStatus: Invoice['paymentStatus'] = 'unpaid';
    if (balanceDueCalculated === 0) {
      paymentStatus = 'paid';
    } else if (totalPaidCalculated > 0) {
      paymentStatus = 'partial';
    }

    const sanitizedItems = items.map(item => ({
      id: item.id || `item-${Date.now()}`,
      description: item.description || 'Freight Charges',
      packagesCount: Number(item.packagesCount) || 0,
      weightTons: Number(item.weightTons) || 0,
      ratePerTon: Number(item.ratePerTon) || 0,
      quantity: Number(item.quantity) || 1,
      unit: item.unit || 'Tons',
      amount: Number(item.amount) || 0
    }));

    const sanitizedPayments = initialPaymentList.map(p => ({
      id: p.id || `pay-${Date.now()}`,
      date: p.date || lrDate,
      amount: Number(p.amount) || 0,
      mode: p.mode || 'bank_neft',
      referenceNo: p.referenceNo || '',
      recordedBy: p.recordedBy || '',
      notes: p.notes || ''
    }));

    const fallbackInvoiceNum = calculateNextSeriesInvoiceNumber('PR', invoiceDate || todayStr, invoices);

    const invoiceToSave: Invoice = {
      id: initialInvoice?.id || `inv-${Date.now()}`,
      invoiceNumber: invoiceNumber || fallbackInvoiceNum,
      salesBillNumber: salesBillNumber || '',
      salesBillDate: salesBillDate || '',
      purchaseBillNumber: purchaseBillNumber || '',
      purchaseDate: purchaseDate || '',
      lrNumber: lrNumber || autoLRNum,
      lrDate: lrDate || todayStr,
      invoiceDate: invoiceDate || todayStr,
      dueDate: dueDate || todayStr,
      invoiceType: invoiceType || 'normal_bill',
      partyId: selectedPartyId || '',
      consignorName: consignorName || 'Cash Customer',
      consignorPartyUser: consignorPartyUser || '',
      consignorGSTIN: consignorGSTIN || '',
      consignorCity: consignorCity || '',
      consignorMobile: consignorMobile || '',
      consignorAddress: consignorAddress || '',
      consignorState: consignorState || 'GUJARAT',
      consignorStateCode: consignorStateCode || '24',
      consigneeName: consigneeName || 'Destination Party',
      consigneePartyUser: consigneePartyUser || '',
      consigneeGSTIN: consigneeGSTIN || '',
      consigneeCity: consigneeCity || '',
      consigneeMobile: consigneeMobile || '',
      consigneeAddress: consigneeAddress || '',
      consigneeState: consigneeState || 'Maharashtra',
      shipToName: shipToName || '',
      shipToPartyUser: shipToPartyUser || '',
      shipToGSTIN: shipToGSTIN || '',
      shipToCity: shipToCity || '',
      shipToMobile: shipToMobile || '',
      shipToAddress: shipToAddress || '',
      shipToState: shipToState || '',
      dispatchedPartyName: dispatchedPartyName || '',
      dispatchedPartyPartyUser: dispatchedPartyPartyUser || '',
      dispatchedPartyGSTIN: dispatchedPartyGSTIN || '',
      dispatchedPartyCity: dispatchedPartyCity || '',
      dispatchedPartyMobile: dispatchedPartyMobile || '',
      dispatchedPartyAddress: dispatchedPartyAddress || '',
      dispatchedPartyState: dispatchedPartyState || '',
      origin: origin || 'Pune, MH',
      destination: destination || 'Mumbai, MH',
      vehicleNumber: vehicleNumber || 'MH-12-PQ-9876',
      driverName: driverName || 'Driver',
      driverPhone: driverPhone || '',
      materialType: materialType || 'General Freight',
      items: sanitizedItems,
      grossFreight: Number(grossFreight) || 0,
      loadingCharges: Number(loadingCharges) || 0,
      unloadingCharges: Number(unloadingCharges) || 0,
      detentionCharges: Number(detentionCharges) || 0,
      otherCharges: Number(otherCharges) || 0,
      subTotal: Number(subTotal) || 0,
      taxSlab: taxSlab ?? 5,
      taxType: taxType || 'intra_state',
      taxMechanism: invoiceType === 'normal_bill' ? 'exempt' : (taxMechanism || 'rcm'),
      cgstRate: Number(cgstRate) || 0,
      sgstRate: Number(sgstRate) || 0,
      igstRate: Number(igstRate) || 0,
      cgstAmount: Number(cgstAmount) || 0,
      sgstAmount: Number(sgstAmount) || 0,
      igstAmount: Number(igstAmount) || 0,
      totalTax: Number(totalTax) || 0,
      roundOff: Number(roundOff) || 0,
      grandTotal: Number(grandTotal) || 0,
      advancePaid: Number(advancePaid) || 0,
      fuelDeduction: Number(fuelDeduction) || 0,
      kasarDeduction: Number(kasarDeduction) || 0,
      otherDeductions: 0,
      tdsApplicable,
      tdsDeducteeType,
      tdsRate: tdsDeducteeType === 'individual' ? 1 : tdsDeducteeType === 'company' ? 2 : Number(tdsRate) || 0,
      tdsAmount: Number(calculatedTdsAmount) || 0,
      netPayable: Number(netPayable) || 0,
      amountPaid: Number(totalPaidCalculated) || 0,
      balanceDue: Number(balanceDueCalculated) || 0,
      paymentStatus: paymentStatus || 'unpaid',
      payments: sanitizedPayments,
      notes: notes || '',
      terms: initialInvoice?.terms || '',
      createdAt: initialInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(invoiceToSave);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-6">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs">
        <div>
          <button
            onClick={onCancel}
            className="flex items-center space-x-1 text-xs text-blue-700 hover:underline font-bold mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Invoices</span>
          </button>
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            {initialInvoice ? 'Edit Transport Invoice' : 'Create New Transport Invoice'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate GST Tax Invoices or Normal Non-Tax Freight Memos with automated tax slabs and RCM support.
          </p>
        </div>

        {/* Invoice Type Switcher Pills */}
        <div className="bg-slate-100 p-1 rounded border border-slate-200 flex items-center space-x-1">
          <button
            type="button"
            onClick={() => {
              setInvoiceType('tax_invoice');
              if (taxSlab === 0) setTaxSlab(5);
            }}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              invoiceType === 'tax_invoice'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            GST TAX INVOICE
          </button>
          <button
            type="button"
            onClick={() => {
              setInvoiceType('normal_bill');
              setTaxSlab(0);
              setTaxMechanism('exempt');
            }}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              invoiceType === 'normal_bill'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            NORMAL BILL (NO TAX)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Section 1: Basic Identifiers */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-blue-700" />
              <span>1. Invoice Identifiers & Bill Series Number</span>
            </h3>
            <div className="flex items-center space-x-2 text-[11px]">
              <span className="text-slate-500 font-semibold">Auto Month:</span>
              <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-mono font-extrabold text-blue-800">
                {getMonthAbbreviation(invoiceDate)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 text-xs">
            {/* Bill Series Dropdown */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-slate-600 font-bold">
                  Bill Series *
                </label>
                <button
                  type="button"
                  onClick={handleOpenAddSeriesModal}
                  className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200 transition-colors flex items-center space-x-0.5 cursor-pointer"
                  title="Add or manage custom bill series"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Add / Manage</span>
                </button>
              </div>
              <select
                value={selectedSeries}
                onChange={e => {
                  if (e.target.value === '__add_new__') {
                    handleOpenAddSeriesModal();
                  } else {
                    handleSeriesChange(e.target.value);
                  }
                }}
                className="w-full bg-blue-50/50 border border-blue-300 rounded px-2 py-1.5 text-blue-900 font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {billSeriesList.map(opt => {
                  const previewNo = calculateNextSeriesInvoiceNumber(opt.prefix, invoiceDate, invoices, initialInvoice?.id);
                  return (
                    <option key={opt.id} value={opt.prefix}>
                      {opt.prefix} ({previewNo}) {opt.label && opt.label !== `${opt.prefix} Series` ? `- ${opt.label}` : ''}
                    </option>
                  );
                })}
                <option value="custom">Custom / Manual</option>
                <option value="__add_new__" className="text-blue-700 font-bold bg-blue-50">
                  + Add New Bill Series...
                </option>
              </select>
            </div>

            {/* Invoice Number */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-slate-600 font-bold">Invoice Number *</label>
                <button
                  type="button"
                  onClick={handleRefreshNextNumber}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-300 transition-colors flex items-center space-x-0.5 cursor-pointer"
                  title="Recalculate next series number for this month"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Next</span>
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. PR/AUG/1"
                value={invoiceNumber}
                onChange={e => {
                  const val = e.target.value;
                  setInvoiceNumber(val);
                  const clean = val.trim().toUpperCase();
                  const matched = billSeriesList.find(o => clean.startsWith(`${o.prefix}/`));
                  if (matched) {
                    setSelectedSeries(matched.prefix);
                  } else {
                    setSelectedSeries('custom');
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Invoice Date */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">Invoice Date *</label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={e => handleInvoiceDateChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Sales Bill No. */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">Sales Bill No.</label>
              <input
                type="text"
                placeholder="e.g. SB-2026-001"
                value={salesBillNumber}
                onChange={e => setSalesBillNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Sales Date */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-slate-600 font-bold">Sales Date</label>
                <button
                  type="button"
                  onClick={() => setSalesBillDate(invoiceDate)}
                  className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200 transition-colors flex items-center space-x-0.5 cursor-pointer"
                  title="Copy Invoice Date to Sales Date"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>Copy Date</span>
                </button>
              </div>
              <input
                type="date"
                value={salesBillDate}
                onChange={e => setSalesBillDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Purchase Bill No. */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">Purchase Bill No.</label>
              <input
                type="text"
                placeholder="e.g. PB-2026-001"
                value={purchaseBillNumber}
                onChange={e => setPurchaseBillNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-slate-600 font-bold">Purchase Date</label>
                <button
                  type="button"
                  onClick={() => setPurchaseDate(invoiceDate)}
                  className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200 transition-colors flex items-center space-x-0.5 cursor-pointer"
                  title="Copy Invoice Date to Purchase Date"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>Copy Date</span>
                </button>
              </div>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Consignor, Dispatched Party, Consignee & Ship To */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 shadow-xs">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <Truck className="w-4 h-4 text-blue-700" />
              <span>2. Billing Party (Consignor), Dispatched Party, Recipient (Consignee) & Ship To</span>
            </h3>

            {/* Quick Party Auto-fill Dropdown */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-500 hidden sm:inline font-bold">Quick Select Party:</span>
              <select
                value={selectedPartyId}
                onChange={e => handleSelectParty(e.target.value)}
                className="bg-white border border-slate-300 text-blue-700 rounded px-2 py-1 font-bold focus:outline-none"
              >
                <option value="">-- Choose Party --</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.city})</option>
                ))}
                <option value="cash_customer">Cash Customer / Walk-in</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            
            {/* Consignor Column */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
                  <span className="font-bold text-slate-800 uppercase tracking-wide">
                    CONSIGNOR (SENDER / BILL-TO)
                  </span>
                  {consignorName && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartyId('');
                        setConsignorName('');
                        setConsignorPartyUser('');
                        setConsignorGSTIN('');
                        setConsignorCity('');
                        setConsignorMobile('');
                        setConsignorAddress('');
                        setConsignorState('GUJARAT');
                        setConsignorStateCode('24');
                      }}
                      className="text-slate-400 hover:text-red-600 font-bold text-[10px] cursor-pointer"
                      title="Clear fields"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                
                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Party Name * (Type or Select)</label>
                  <input
                    type="text"
                    required
                    list="consignor-datalist"
                    placeholder="e.g. Shree Cement Ltd"
                    value={consignorName}
                    onChange={e => {
                      const val = e.target.value;
                      setConsignorName(val);
                      const matched = parties.find(p => p.name.toLowerCase().trim() === val.toLowerCase().trim());
                      if (matched) {
                        if (matched.partyUser) setConsignorPartyUser(matched.partyUser);
                        setConsignorGSTIN(matched.gstin || '');
                        setConsignorCity(matched.city || '');
                        setConsignorMobile(matched.phone || '');
                        setConsignorAddress(matched.address || '');
                        setConsignorState(matched.state || 'GUJARAT');
                        setConsignorStateCode(matched.stateCode || '24');
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                  />
                  <datalist id="consignor-datalist">
                    {parties.map(p => (
                      <option key={p.id} value={p.name}>{p.city} - GST: {p.gstin}</option>
                    ))}
                    {consignorPresets.map(cp => (
                      <option key={`dl-cp-${cp}`} value={cp} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Party User / Sender Contact</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Bhai / Dispatch Incharge"
                    value={consignorPartyUser}
                    onChange={e => setConsignorPartyUser(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="24AABCS1234F1Z8"
                    value={consignorGSTIN}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      setConsignorGSTIN(val);
                      if (val.length >= 2 && /^\d\d$/.test(val.slice(0, 2))) {
                        const code = val.slice(0, 2);
                        setConsignorStateCode(code);
                        if (code === '24') setConsignorState('GUJARAT');
                        else if (code === '27') setConsignorState('MAHARASHTRA');
                      }
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">City</label>
                    <input
                      type="text"
                      placeholder="Billing City"
                      value={consignorCity}
                      onChange={e => setConsignorCity(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">State</label>
                    <input
                      type="text"
                      placeholder="e.g. GUJARAT"
                      value={consignorState}
                      onChange={e => setConsignorState(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={consignorMobile}
                    onChange={e => setConsignorMobile(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-slate-600 font-semibold mb-0.5">Address</label>
                    <textarea
                      rows={2}
                      placeholder="Registered Billing Address"
                      value={consignorAddress}
                      onChange={e => setConsignorAddress(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">State Code</label>
                    <input
                      type="text"
                      placeholder="24"
                      value={consignorStateCode}
                      onChange={e => setConsignorStateCode(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Dispatched Party (Shipped From / Loading Site) Column */}
            <div className="bg-amber-50/40 p-3 rounded-lg border-2 border-amber-300/90 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="border-b border-amber-200 pb-1.5 flex justify-between items-center">
                  <span className="font-bold text-amber-900 uppercase tracking-wide">
                    DISPATCHED PARTY (SHIPPED FROM)
                  </span>
                  {dispatchedPartyName && (
                    <button
                      type="button"
                      onClick={() => {
                        setDispatchedPartyName('');
                        setDispatchedPartyPartyUser('');
                        setDispatchedPartyGSTIN('');
                        setDispatchedPartyCity('');
                        setDispatchedPartyMobile('');
                        setDispatchedPartyAddress('');
                        setDispatchedPartyState('');
                      }}
                      className="text-slate-400 hover:text-red-600 font-bold text-[10px] cursor-pointer"
                      title="Clear fields"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Quick List Action Toolbar */}
                <div className="flex items-center gap-1 w-full">
                  <select
                    className="flex-1 min-w-0 text-[11px] bg-white hover:bg-slate-50 border border-blue-400 text-blue-700 rounded px-2 py-1 font-bold focus:outline-none cursor-pointer truncate shadow-2xs"
                    onChange={e => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const found = dispatchedPresets.find(p => p.id === selectedId);
                      if (found) {
                        handleApplyDispatchedPreset(found);
                      }
                    }}
                    value=""
                  >
                    <option value="">Quick List...</option>
                    {dispatchedPresets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.city ? ` (${p.city})` : ''}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowDispatchedManageModal(true)}
                    className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded border border-blue-300 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                    title="Manage Dispatched Party Quick List options"
                  >
                    + Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyConsignorToDispatchedParty}
                    className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-1.5 py-1 rounded border border-amber-300 transition-colors flex items-center space-x-0.5 whitespace-nowrap cursor-pointer shrink-0"
                    title="Copy Consignor details into Dispatched Party"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copy</span>
                  </button>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Dispatched Party / Loading Site</label>
                  <input
                    type="text"
                    list="dispatched-datalist"
                    placeholder="e.g. Shree Cement Loading Yard"
                    value={dispatchedPartyName}
                    onChange={e => tryMatchAndFillDispatchedParty(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                  />
                  <datalist id="dispatched-datalist">
                    <option value="Same as Consignor Address" />
                    {dispatchedPresets.map(dp => (
                      <option key={`dl-dp-${dp.id}`} value={dp.name} />
                    ))}
                    {parties.map(p => (
                      <option key={`dp-dl-${p.id}`} value={p.name}>{p.city} - GST: {p.gstin}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Dispatch GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="24AAACG9876E1Z2"
                    value={dispatchedPartyGSTIN}
                    onChange={e => setDispatchedPartyGSTIN(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">City</label>
                    <input
                      type="text"
                      placeholder="Loading City"
                      value={dispatchedPartyCity}
                      onChange={e => setDispatchedPartyCity(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">State</label>
                    <input
                      type="text"
                      placeholder="e.g. GUJARAT"
                      value={dispatchedPartyState}
                      onChange={e => setDispatchedPartyState(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={dispatchedPartyMobile}
                    onChange={e => setDispatchedPartyMobile(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Loading / Factory Address</label>
                  <textarea
                    rows={2}
                    placeholder="Factory Address / Gate No."
                    value={dispatchedPartyAddress}
                    onChange={e => setDispatchedPartyAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Consignee Column */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
                  <span className="font-bold text-slate-800 uppercase tracking-wide">
                    CONSIGNEE (RECEIVER AT DESTINATION)
                  </span>
                  {consigneeName && (
                    <button
                      type="button"
                      onClick={() => {
                        setConsigneeName('');
                        setConsigneePartyUser('');
                        setConsigneeGSTIN('');
                        setConsigneeCity('');
                        setConsigneeMobile('');
                        setConsigneeAddress('');
                        setConsigneeState('GUJARAT');
                      }}
                      className="text-slate-400 hover:text-red-600 font-bold text-[10px] cursor-pointer"
                      title="Clear Consignee fields"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Quick List Action Toolbar */}
                <div className="flex items-center gap-1 w-full">
                  <select
                    className="flex-1 min-w-0 text-[11px] bg-white hover:bg-slate-50 border border-blue-400 text-blue-700 rounded px-2 py-1 font-bold focus:outline-none cursor-pointer truncate shadow-2xs"
                    onChange={e => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const found = consigneeListPresets.find(p => p.id === selectedId);
                      if (found) {
                        handleApplyConsigneePreset(found);
                      }
                    }}
                    value=""
                  >
                    <option value="">Quick List...</option>
                    {consigneeListPresets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.city ? ` (${p.city})` : ''}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowConsigneeManageModal(true)}
                    className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded border border-blue-300 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                    title="Manage Consignee Quick List options"
                  >
                    + Edit
                  </button>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Receiver Name * (Type or Select)</label>
                  <input
                    type="text"
                    required
                    list="consignee-datalist"
                    placeholder="e.g. Gujarat Apex Logistics"
                    value={consigneeName}
                    onChange={e => tryMatchAndFillConsignee(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                  />
                  <datalist id="consignee-datalist">
                    {consigneeListPresets.map(cp => (
                      <option key={`dl-cge-list-${cp.id}`} value={cp.name} />
                    ))}
                    {parties.map(p => (
                      <option key={p.id} value={p.name}>{p.city} - GST: {p.gstin}</option>
                    ))}
                    {consigneePresets.map(cp => (
                      <option key={`dl-cge-${cp}`} value={cp} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Consignee GSTIN</label>
                  <input
                    type="text"
                    placeholder="24AAACG9876E1Z2"
                    value={consigneeGSTIN}
                    onChange={e => setConsigneeGSTIN(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">City</label>
                    <input
                      type="text"
                      placeholder="Receiver City"
                      value={consigneeCity}
                      onChange={e => setConsigneeCity(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">State</label>
                    <input
                      type="text"
                      placeholder="e.g. GUJARAT"
                      value={consigneeState}
                      onChange={e => setConsigneeState(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={consigneeMobile}
                    onChange={e => setConsigneeMobile(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Delivery Address</label>
                  <textarea
                    rows={2}
                    placeholder="Full Delivery Address at Destination"
                    value={consigneeAddress}
                    onChange={e => setConsigneeAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Ship To Column */}
            <div className="bg-slate-50 p-3 rounded-lg border border-blue-200/90 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
                  <span className="font-bold text-blue-900 uppercase tracking-wide">
                    SHIP TO (DELIVERY SITE)
                  </span>
                  {shipToName && (
                    <button
                      type="button"
                      onClick={() => {
                        setShipToName('');
                        setShipToPartyUser('');
                        setShipToGSTIN('');
                        setShipToCity('');
                        setShipToMobile('');
                        setShipToAddress('');
                        setShipToState('GUJARAT');
                      }}
                      className="text-slate-400 hover:text-red-600 font-bold text-[10px] cursor-pointer"
                      title="Clear Ship To fields"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Quick List Action Toolbar */}
                <div className="flex items-center gap-1 w-full">
                  <select
                    className="flex-1 min-w-0 text-[11px] bg-white hover:bg-slate-50 border border-blue-400 text-blue-700 rounded px-2 py-1 font-bold focus:outline-none cursor-pointer truncate shadow-2xs"
                    onChange={e => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const found = shipToListPresets.find(p => p.id === selectedId);
                      if (found) {
                        handleApplyShipToPreset(found);
                      }
                    }}
                    value=""
                  >
                    <option value="">Quick List...</option>
                    {shipToListPresets.map(p => (
                      <option key={p.id} value={p.id}>{p.name}{p.city ? ` (${p.city})` : ''}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowShipToManageModal(true)}
                    className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded border border-blue-300 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                    title="Manage Ship To Quick List options"
                  >
                    + Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyConsigneeToShipTo}
                    className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-1.5 py-1 rounded border border-emerald-300 transition-colors flex items-center space-x-0.5 whitespace-nowrap cursor-pointer shrink-0"
                    title="Copy Consignee details into Ship To"
                  >
                    <Copy className="w-2.5 h-2.5" />
                    <span>Copy</span>
                  </button>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Ship To Name / Site (Type or Select)</label>
                  <input
                    type="text"
                    list="shipto-datalist"
                    placeholder="e.g. Site 1 - Industrial Estate"
                    value={shipToName}
                    onChange={e => tryMatchAndFillShipTo(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                  />
                  <datalist id="shipto-datalist">
                    <option value="Same as Consignee Address" />
                    {shipToListPresets.map(st => (
                      <option key={`dl-st-list-${st.id}`} value={st.name} />
                    ))}
                    {parties.map(p => (
                      <option key={`st-dl-${p.id}`} value={p.name}>{p.city} - GST: {p.gstin}</option>
                    ))}
                    {shipToPresets.map(st => (
                      <option key={`dl-st-${st}`} value={st} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Ship To GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="24AAACG9876E1Z2"
                    value={shipToGSTIN}
                    onChange={e => setShipToGSTIN(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">City</label>
                    <input
                      type="text"
                      placeholder="Site City"
                      value={shipToCity}
                      onChange={e => setShipToCity(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-0.5">State</label>
                    <input
                      type="text"
                      placeholder="e.g. Maharashtra / Gujarat"
                      value={shipToState}
                      onChange={e => setShipToState(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={shipToMobile}
                    onChange={e => setShipToMobile(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-0.5">Delivery Site / Unloading Address</label>
                  <textarea
                    rows={2}
                    placeholder="Site Address / Warehouse Gate No."
                    value={shipToAddress}
                    onChange={e => setShipToAddress(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Section 3: Route & Vehicle details */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 shadow-xs">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <Truck className="w-4 h-4 text-blue-700" />
              <span>3. Route, Vehicle & Driver Information</span>
            </h3>

            {vehicles.length > 0 && (
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-500 hidden sm:inline font-bold">Select Fleet Vehicle:</span>
                <select
                  value={selectedVehicleId}
                  onChange={e => handleSelectVehicle(e.target.value)}
                  className="bg-white border border-slate-300 text-blue-700 rounded px-2 py-1 font-bold focus:outline-none"
                >
                  <option value="">-- Choose Truck --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.driverName})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1 gap-1">
                <label className="block text-slate-500 font-bold whitespace-nowrap">Origin City *</label>
                <div className="flex items-center space-x-1 shrink-0">
                  <select
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-blue-700 rounded px-1.5 py-0.5 font-bold focus:outline-none cursor-pointer"
                    onChange={e => {
                      if (e.target.value) setOrigin(e.target.value);
                    }}
                    value=""
                  >
                    <option value="">Quick List...</option>
                    {originCities.map(c => (
                      <option key={`orig-${c}`} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setActiveManageCategory('origin')}
                    className="text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-200 transition-colors whitespace-nowrap"
                    title="Add or delete origin cities"
                  >
                    +Edit
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                list="origin-cities-list"
                placeholder="e.g. Pune, MH"
                value={origin}
                onChange={e => setOrigin(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <datalist id="origin-cities-list">
                {originCities.map(c => (
                  <option key={`dl-orig-${c}`} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 gap-1">
                <label className="block text-slate-500 font-bold whitespace-nowrap">Destination City *</label>
                <div className="flex items-center space-x-1 shrink-0">
                  <select
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-blue-700 rounded px-1.5 py-0.5 font-bold focus:outline-none cursor-pointer"
                    onChange={e => {
                      if (e.target.value) setDestination(e.target.value);
                    }}
                    value=""
                  >
                    <option value="">Quick List...</option>
                    {destCities.map(c => (
                      <option key={`dest-${c}`} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setActiveManageCategory('destination')}
                    className="text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-200 transition-colors whitespace-nowrap"
                    title="Add or delete destination cities"
                  >
                    +Edit
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                list="destination-cities-list"
                placeholder="e.g. Ahmedabad, GJ"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <datalist id="destination-cities-list">
                {destCities.map(c => (
                  <option key={`dl-dest-${c}`} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-1">Vehicle No *</label>
              <input
                type="text"
                required
                placeholder="MH-12-PQ-9876"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 font-mono font-bold focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-1">Driver Name</label>
              <input
                type="text"
                placeholder="Ramesh Singh"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-bold mb-1">Driver Phone</label>
              <input
                type="text"
                placeholder="+91 98223..."
                value={driverPhone}
                onChange={e => setDriverPhone(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 gap-1">
                <label className="block text-slate-500 font-bold whitespace-nowrap">Material / Goods</label>
                <div className="flex items-center space-x-1 shrink-0">
                  <select
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-blue-700 rounded px-1.5 py-0.5 font-bold focus:outline-none cursor-pointer"
                    onChange={e => {
                      if (e.target.value) setMaterialType(e.target.value);
                    }}
                    value=""
                  >
                    <option value="">Quick List...</option>
                    {materials.map(m => (
                      <option key={`mat-${m}`} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setActiveManageCategory('material')}
                    className="text-[9px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-200 transition-colors whitespace-nowrap"
                    title="Add or delete materials"
                  >
                    +Edit
                  </button>
                </div>
              </div>
              <input
                type="text"
                list="materials-list"
                placeholder="Cement / Steel"
                value={materialType}
                onChange={e => setMaterialType(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <datalist id="materials-list">
                {materials.map(m => (
                  <option key={`dl-mat-${m}`} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Route Bhada Quick Save to Notes Bar & Auto-Fill Match */}
          {matchingBhadaNote && (
            <div className="mt-3 bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-indigo-500/10 border-2 border-blue-500 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-700 text-white rounded-md shrink-0">
                  <StickyNote className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                    <span>Matching Saved Route Bhada Rate Found in Notes!</span>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                      {matchingBhadaNote.originCity} ➔ {matchingBhadaNote.destinationCity}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Saved Rate Per Ton: <strong className="text-emerald-700 font-mono text-xs">₹{formatINR(matchingBhadaNote.ratePerTon ?? matchingBhadaNote.bhadaAmount)}</strong>
                    {matchingBhadaNote.bhadaAmount && matchingBhadaNote.bhadaAmount !== matchingBhadaNote.ratePerTon ? ` | Bhada: ₹${formatINR(matchingBhadaNote.bhadaAmount)}` : ''}
                    {matchingBhadaNote.vehicleType ? ` | ${matchingBhadaNote.vehicleType}` : ''}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyMatchingBhadaRate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-lg flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>AUTO-FILL RATE (₹{formatINR(matchingBhadaNote.ratePerTon ?? matchingBhadaNote.bhadaAmount)})</span>
              </button>
            </div>
          )}

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-600">Selected Route Bhada:</span>
              <span className="font-mono font-extrabold text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 inline-flex flex-wrap items-center gap-1.5">
                <span>{origin || 'Origin'} ➔ {destination || 'Destination'}</span>
                <span className="text-slate-300">|</span>
                <span className="text-blue-800 font-bold">Rate (₹): ₹{formatINR(items[0]?.ratePerTon || (items[0]?.quantity > 0 ? items[0].amount / items[0].quantity : grossFreight))}{items[0]?.unit ? `/${items[0].unit}` : ''}</span>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {savedBhadaToast && (
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-300 font-bold px-2.5 py-1 rounded text-xs flex items-center space-x-1 animate-pulse">
                  <Check className="w-3.5 h-3.5" />
                  <span>Route Bhada Saved in Notes!</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleQuickSaveRouteBhadaToNotes}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1 rounded flex items-center space-x-1.5 transition-all shadow-2xs active:scale-95"
              >
                <StickyNote className="w-3.5 h-3.5 text-blue-200" />
                <span>SAVE BHADA RATE IN NOTES</span>
              </button>
            </div>
          </div>

        </div>

        {/* Section 4: Freight Line Items */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 shadow-xs">
          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-blue-700" />
              <span>4. Freight Charges & Line Items</span>
            </h3>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveManageCategory('description')}
                className="text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded font-bold transition-colors"
                title="Manage description preset options"
              >
                + Manage Descriptions
              </button>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center space-x-1 text-xs bg-blue-600 text-white hover:bg-blue-700 px-2.5 py-1 rounded font-bold transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line Item</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] bg-slate-50">
                  <th className="p-2">
                    <div className="flex justify-between items-center">
                      <span>Description (Type or Select)</span>
                      <button
                        type="button"
                        onClick={() => setActiveManageCategory('description')}
                        className="text-[9px] text-blue-700 hover:underline font-bold"
                      >
                        +Add/Delete Options
                      </button>
                    </div>
                  </th>
                  <th className="p-2 w-20">Unit</th>
                  <th className="p-2 w-24">Qty / Weight</th>
                  <th className="p-2 w-28">Rate (₹)</th>
                  <th className="p-2 w-32 text-right">Amount (₹)</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="p-2 pr-2">
                      <div className="flex items-center space-x-1">
                        <input
                          type="text"
                          list="description-list"
                          value={item.description}
                          onChange={e => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
                          placeholder="Line item description..."
                        />
                        <select
                          className="text-[10px] bg-slate-100 border border-slate-300 rounded px-1 py-1 text-blue-700 font-bold focus:outline-none max-w-[100px]"
                          onChange={e => {
                            if (e.target.value) updateItem(item.id, 'description', e.target.value);
                          }}
                          value=""
                        >
                          <option value="">Select...</option>
                          {descriptions.map(d => (
                            <option key={`desc-opt-${d}`} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="p-2 pr-2">
                      <select
                        value={item.unit}
                        onChange={e => updateItem(item.id, 'unit', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-blue-700 font-bold focus:outline-none"
                      >
                        <option value="Tons">Tons</option>
                        <option value="Trips">Trips</option>
                        <option value="Packages">Pkgs</option>
                        <option value="Kg">Kg</option>
                        <option value="Fixed">Fixed</option>
                      </select>
                    </td>
                    <td className="p-2 pr-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-mono font-bold focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-2 pr-2">
                      <div className="relative">
                        <span className="absolute left-1.5 top-1 text-slate-400 font-bold text-[10px]">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.ratePerTon !== undefined && item.ratePerTon !== null ? item.ratePerTon : ''}
                          onChange={e => updateItem(item.id, 'ratePerTon', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded pl-4 pr-1.5 py-1 text-slate-800 font-mono font-bold focus:border-blue-500 focus:outline-none text-right"
                          placeholder="Rate"
                        />
                      </div>
                    </td>
                    <td className="p-2 pr-2">
                      <div className="relative">
                        <span className="absolute left-1.5 top-1 text-blue-700 font-extrabold text-[10px]">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.amount !== undefined && item.amount !== null ? item.amount : ''}
                          onChange={e => updateItem(item.id, 'amount', e.target.value)}
                          className="w-full bg-blue-50/50 font-mono font-extrabold text-blue-950 border border-blue-300 rounded pl-4 pr-1.5 py-1 focus:bg-white focus:border-blue-600 focus:outline-none text-right shadow-2xs"
                          placeholder="Amount"
                        />
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1}
                        className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="description-list">
              {descriptions.map(d => (
                <option key={`dl-desc-${d}`} value={d} />
              ))}
            </datalist>
          </div>

          {/* Sub Charges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 mt-3 border-t border-slate-100 text-xs">
            <div>
              <label className="block text-slate-500 mb-0.5">Loading Charges (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={loadingCharges}
                onChange={e => setLoadingCharges(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-0.5">Unloading Charges (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={unloadingCharges}
                onChange={e => setUnloadingCharges(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-0.5">Detention / Stacking (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={detentionCharges}
                onChange={e => setDetentionCharges(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-0.5">Other Charges (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={otherCharges}
                onChange={e => setOtherCharges(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

        </div>

        {/* Section 5: Tax Slabs & GST Options */}
        {invoiceType === 'tax_invoice' && (
          <div className="bg-white border border-blue-200 rounded-lg p-4 text-slate-800 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center space-x-2 border-b border-blue-100 pb-2">
              <Calculator className="w-4 h-4 text-blue-700" />
              <span>5. GST Tax Slabs & Charge Mechanism</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              
              {/* Tax Slab selector */}
              <div>
                <label className="block text-slate-500 font-bold mb-1">Tax Slab (%) *</label>
                <div className="grid grid-cols-5 gap-1">
                  {[0, 5, 12, 18, 28].map(slab => (
                    <button
                      key={slab}
                      type="button"
                      onClick={() => setTaxSlab(slab as TaxSlab)}
                      className={`py-1.5 rounded text-xs font-bold transition-all border ${
                        taxSlab === slab
                          ? 'bg-blue-700 border-blue-700 text-white shadow-xs'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {slab}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Tax Mechanism */}
              <div>
                <label className="block text-slate-500 font-bold mb-1">GST Payment Mechanism *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTaxMechanism('rcm')}
                    className={`p-2 rounded text-left border transition-all ${
                      taxMechanism === 'rcm'
                        ? 'bg-blue-50 border-blue-600 text-blue-800'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="font-bold text-[11px] uppercase">RCM (Reverse Charge)</div>
                    <div className="text-[9px] text-slate-500 leading-tight">Recipient pays GST directly</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaxMechanism('forward_charge')}
                    className={`p-2 rounded text-left border transition-all ${
                      taxMechanism === 'forward_charge'
                        ? 'bg-blue-50 border-blue-600 text-blue-800'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="font-bold text-[11px] uppercase">Forward Charge</div>
                    <div className="text-[9px] text-slate-500 leading-tight">Billed on invoice by GTA</div>
                  </button>
                </div>
              </div>

              {/* Tax Type (Intra vs Inter state) */}
              <div>
                <label className="block text-slate-500 font-bold mb-1">Supply Type *</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTaxType('intra_state')}
                    className={`p-2 rounded text-left border transition-all ${
                      taxType === 'intra_state'
                        ? 'bg-blue-50 border-blue-600 text-blue-800'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="font-bold text-[11px] uppercase">Intra-State</div>
                    <div className="text-[9px] text-slate-500">CGST + SGST</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTaxType('inter_state')}
                    className={`p-2 rounded text-left border transition-all ${
                      taxType === 'inter_state'
                        ? 'bg-blue-50 border-blue-600 text-blue-800'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    <div className="font-bold text-[11px] uppercase">Inter-State</div>
                    <div className="text-[9px] text-slate-500">IGST</div>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Section 6: Advance, Fuel & TDS Deductions & Grand Calculation */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 shadow-xs grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
              6. Advances, Fuel & TDS Deductions (u/s 194C)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-0.5 font-medium">Advance Amount Received (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={advancePaid}
                  onChange={e => setAdvancePaid(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-0.5 font-medium">Fuel Slip Deduction (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={fuelDeduction}
                  onChange={e => setFuelDeduction(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-0.5 font-medium">Kasar / Lump-Sum Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 500"
                  value={kasarDeduction || ''}
                  onChange={e => setKasarDeduction(Number(e.target.value))}
                  className="w-full bg-emerald-50/80 border border-emerald-300 rounded px-2.5 py-1.5 text-emerald-950 font-bold focus:bg-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <label className="block text-slate-500 font-medium">Round Off (₹)</label>
                  <button
                    type="button"
                    onClick={handleAutoRoundOff}
                    className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded transition-colors"
                    title="Auto round off to nearest Rupee"
                  >
                    Auto Round
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. -0.40 or 0.60"
                  value={roundOff === 0 ? '' : roundOff}
                  onChange={e => setRoundOff(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* TDS Deduction (Section 194C) Interactive Card */}
            <div className="bg-purple-50/90 border border-purple-200 rounded-lg p-3 space-y-2.5 text-xs transition-all">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 font-bold text-purple-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={tdsApplicable}
                    onChange={e => setTdsApplicable(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-purple-300 focus:ring-purple-500"
                  />
                  <span>Deduct TDS (Income Tax Section 194C)</span>
                </label>
                {tdsApplicable && (
                  <span className="text-[11px] font-mono font-black bg-purple-700 text-white px-2 py-0.5 rounded shadow-2xs">
                    TDS: - ₹{formatINR(calculatedTdsAmount)}
                  </span>
                )}
              </div>

              {tdsApplicable && (
                <div className="pt-2 border-t border-purple-200/80 space-y-2.5 animate-in fade-in duration-150">
                  <div className="text-[11px] font-bold text-purple-900">
                    Select Deductee Category / Rate:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Individual / HUF Option (1%) */}
                    <button
                      type="button"
                      onClick={() => {
                        setTdsDeducteeType('individual');
                        setTdsRate(1);
                      }}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        tdsDeducteeType === 'individual'
                          ? 'bg-purple-700 text-white border-purple-800 shadow-sm ring-2 ring-purple-400'
                          : 'bg-white text-slate-800 border-purple-200 hover:bg-purple-100/60'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-extrabold uppercase text-[11px] tracking-wide">INDIVIDUAL / HUF</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          tdsDeducteeType === 'individual' ? 'bg-purple-900 text-white' : 'bg-purple-100 text-purple-900'
                        }`}>
                          1% TDS
                        </span>
                      </div>
                      <span className={`text-[10px] mt-1 font-medium ${tdsDeducteeType === 'individual' ? 'text-purple-100' : 'text-slate-500'}`}>
                        Proprietorship / Individual Contractor
                      </span>
                    </button>

                    {/* Company / Firm Option (2%) */}
                    <button
                      type="button"
                      onClick={() => {
                        setTdsDeducteeType('company');
                        setTdsRate(2);
                      }}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        tdsDeducteeType === 'company'
                          ? 'bg-purple-700 text-white border-purple-800 shadow-sm ring-2 ring-purple-400'
                          : 'bg-white text-slate-800 border-purple-200 hover:bg-purple-100/60'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-extrabold uppercase text-[11px] tracking-wide">COMPANY / FIRM</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          tdsDeducteeType === 'company' ? 'bg-purple-900 text-white' : 'bg-purple-100 text-purple-900'
                        }`}>
                          2% TDS
                        </span>
                      </div>
                      <span className={`text-[10px] mt-1 font-medium ${tdsDeducteeType === 'company' ? 'text-purple-100' : 'text-slate-500'}`}>
                        Partnership / Corporate / Pvt Ltd
                      </span>
                    </button>

                    {/* Custom Rate Option */}
                    <button
                      type="button"
                      onClick={() => setTdsDeducteeType('custom')}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        tdsDeducteeType === 'custom'
                          ? 'bg-purple-700 text-white border-purple-800 shadow-sm ring-2 ring-purple-400'
                          : 'bg-white text-slate-800 border-purple-200 hover:bg-purple-100/60'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-extrabold uppercase text-[11px] tracking-wide">CUSTOM RATE</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          tdsDeducteeType === 'custom' ? 'bg-purple-900 text-white' : 'bg-purple-100 text-purple-900'
                        }`}>
                          {tdsRate}% Custom
                        </span>
                      </div>
                      <span className={`text-[10px] mt-1 font-medium ${tdsDeducteeType === 'custom' ? 'text-purple-100' : 'text-slate-500'}`}>
                        Manual % or Direct Rupee Amount
                      </span>
                    </button>
                  </div>

                  {tdsDeducteeType === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 bg-white p-2 rounded border border-purple-200">
                      <div>
                        <label className="block text-[10px] text-purple-950 font-bold mb-0.5">Custom TDS Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="20"
                          value={tdsRate}
                          onChange={e => setTdsRate(Number(e.target.value))}
                          className="w-full bg-slate-50 border border-purple-300 rounded px-2.5 py-1 text-slate-800 font-bold focus:bg-white focus:border-purple-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-purple-950 font-bold mb-0.5">Or Fixed TDS Amount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={customTdsAmount || ''}
                          onChange={e => {
                            setCustomTdsAmount(Number(e.target.value));
                            setTdsRate(0);
                          }}
                          placeholder="e.g. 1500"
                          className="w-full bg-slate-50 border border-purple-300 rounded px-2.5 py-1 text-slate-800 font-bold focus:bg-white focus:border-purple-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-purple-950 font-semibold bg-purple-100/80 p-2 rounded flex justify-between items-center">
                    <span>
                      TDS Applicable Base Freight: <strong className="font-mono text-purple-900 font-extrabold">₹{formatINR(subTotal)}</strong>
                    </span>
                    <span>
                      Deduction Amount: <strong className="font-mono text-purple-950 font-black text-xs">₹{formatINR(calculatedTdsAmount)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-500 text-xs mb-0.5 font-bold">Special Notes / Instructions</label>
              <textarea
                rows={2}
                placeholder="e.g. POD to be submitted within 7 days for full clearance"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Right Live Calculation Summary Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between text-xs space-y-2 text-white shadow-xs">
            <div className="space-y-1 border-b border-slate-800 pb-2.5">
              <div className="text-slate-400 flex justify-between">
                <span>Gross Freight:</span>
                <span className="font-semibold text-white">₹{formatINR(grossFreight)}</span>
              </div>
              <div className="text-slate-400 flex justify-between">
                <span>Total Other Charges:</span>
                <span className="font-semibold text-white">
                  ₹{formatINR(loadingCharges + unloadingCharges + detentionCharges + otherCharges)}
                </span>
              </div>
              <div className="text-slate-200 font-bold flex justify-between pt-1">
                <span>Sub Total:</span>
                <span>₹{formatINR(subTotal)}</span>
              </div>

              {invoiceType === 'tax_invoice' && taxMechanism === 'forward_charge' && (
                <div className="text-amber-400 flex justify-between pt-1 font-semibold">
                  <span>GST Tax ({taxSlab}%):</span>
                  <span>+ ₹{formatINR(totalTax)}</span>
                </div>
              )}

              {invoiceType === 'tax_invoice' && taxMechanism === 'rcm' && (
                <div className="text-blue-300 flex justify-between text-[10px] font-semibold pt-1">
                  <span>RCM Tax (5% paid by Recipient):</span>
                  <span>(₹{formatINR(totalTax)})</span>
                </div>
              )}

              {roundOff !== 0 && (
                <div className="text-emerald-400 flex justify-between pt-1 font-semibold text-[11px]">
                  <span>Round Off:</span>
                  <span>{roundOff > 0 ? '+' : ''}₹{formatINR(roundOff)}</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-bold text-xs text-white">
                <span>GRAND TOTAL:</span>
                <span className="text-amber-400 font-mono">₹{formatINR(grandTotal)}</span>
              </div>

              {advancePaid > 0 && (
                <div className="flex justify-between text-red-300 font-medium text-[10px]">
                  <span>Less: Advance Amount:</span>
                  <span>- ₹{formatINR(advancePaid)}</span>
                </div>
              )}

              {fuelDeduction > 0 && (
                <div className="flex justify-between text-amber-300 font-medium text-[10px]">
                  <span>Less: Fuel Slip Deduction:</span>
                  <span>- ₹{formatINR(fuelDeduction)}</span>
                </div>
              )}

              {kasarDeduction > 0 && (
                <div className="flex justify-between text-emerald-300 font-semibold text-[10px] bg-emerald-950/60 p-1 rounded border border-emerald-800/60">
                  <span>Less: Kasar / Lump-Sum Discount:</span>
                  <span className="font-mono font-bold">- ₹{formatINR(kasarDeduction)}</span>
                </div>
              )}

              {tdsApplicable && calculatedTdsAmount > 0 && (
                <div className="flex justify-between text-purple-300 font-semibold text-[10px] bg-purple-950/60 p-1 rounded border border-purple-800/60">
                  <span>Less: TDS ({tdsDeducteeType === 'individual' ? '1% Individual' : tdsDeducteeType === 'company' ? '2% Company' : `${tdsRate}%`}):</span>
                  <span className="font-mono font-bold">- ₹{formatINR(calculatedTdsAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-red-400 font-bold text-[10px] pt-1">
                <span>Total Advances/Deductions:</span>
                <span>- ₹{formatINR(totalDeductions)}</span>
              </div>

              <div className="bg-blue-800 border border-blue-700 p-2 rounded flex justify-between items-center text-white font-black text-xs mt-1">
                <span>NET BALANCE:</span>
                <span className="font-mono text-sm">₹{formatINR(netPayable)}</span>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-2 flex space-x-2">
              <button
                type="button"
                onClick={onCancel}
                className="w-1/3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-2/3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition-all shadow-xs flex items-center justify-center space-x-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>SAVE INVOICE</span>
              </button>
            </div>

          </div>

        </div>

        {/* Modal for Managing Dropdown Options (Consignor, Consignee, Ship To, Origin, Destination, Material, Description) */}
        {activeManageCategory && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wide">
                    Manage {
                      activeManageCategory === 'consignor' ? 'Consignor (Sender)' :
                      activeManageCategory === 'dispatched' ? 'Dispatched Party (Loading Site)' :
                      activeManageCategory === 'consignee' ? 'Consignee (Receiver)' :
                      activeManageCategory === 'shipto' ? 'Ship To (Delivery Site)' :
                      activeManageCategory === 'origin' ? 'Origin Cities' :
                      activeManageCategory === 'destination' ? 'Destination Cities' :
                      activeManageCategory === 'material' ? 'Material / Goods Types' :
                      'Description Presets'
                    } Options
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setActiveManageCategory(null); setNewOptionInput(''); setEditingOption(null); }}
                  className="text-slate-400 hover:text-white p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4 text-xs">
                {/* Add new option form */}
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-bold">Add New Dropdown Option</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newOptionInput}
                      onChange={e => setNewOptionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOption(activeManageCategory, newOptionInput);
                        }
                      }}
                      placeholder={`Type new ${activeManageCategory} option...`}
                      className="flex-1 bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddOption(activeManageCategory, newOptionInput)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded flex items-center space-x-1 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Existing options list */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-500 font-bold">
                    <span>Preset Options ({(
                      activeManageCategory === 'consignor' ? consignorPresets :
                      activeManageCategory === 'dispatched' ? dispatchedPartyPresets :
                      activeManageCategory === 'consignee' ? consigneePresets :
                      activeManageCategory === 'shipto' ? shipToPresets :
                      activeManageCategory === 'origin' ? originCities :
                      activeManageCategory === 'destination' ? destCities :
                      activeManageCategory === 'material' ? materials :
                      descriptions
                    ).length})</span>
                    <button
                      type="button"
                      onClick={() => handleResetDefaults(activeManageCategory)}
                      className="text-blue-600 hover:underline text-[11px]"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-slate-50">
                    {(
                      activeManageCategory === 'consignor' ? consignorPresets :
                      activeManageCategory === 'dispatched' ? dispatchedPartyPresets :
                      activeManageCategory === 'consignee' ? consigneePresets :
                      activeManageCategory === 'shipto' ? shipToPresets :
                      activeManageCategory === 'origin' ? originCities :
                      activeManageCategory === 'destination' ? destCities :
                      activeManageCategory === 'material' ? materials :
                      descriptions
                    ).length === 0 ? (
                      <p className="p-3 text-slate-400 text-center italic">No options present. Add one above!</p>
                    ) : (
                      (
                        activeManageCategory === 'consignor' ? consignorPresets :
                        activeManageCategory === 'dispatched' ? dispatchedPartyPresets :
                        activeManageCategory === 'consignee' ? consigneePresets :
                        activeManageCategory === 'shipto' ? shipToPresets :
                        activeManageCategory === 'origin' ? originCities :
                        activeManageCategory === 'destination' ? destCities :
                        activeManageCategory === 'material' ? materials :
                        descriptions
                      ).map(opt => (
                        <div key={opt} className="p-2 flex justify-between items-center bg-white hover:bg-slate-50 gap-2">
                          {editingOption && editingOption.oldVal === opt ? (
                            <div className="flex-1 flex items-center space-x-1">
                              <input
                                type="text"
                                value={editingOption.newVal}
                                onChange={e => setEditingOption({ ...editingOption, newVal: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleEditOptionSubmit(activeManageCategory, opt, editingOption.newVal);
                                  } else if (e.key === 'Escape') {
                                    setEditingOption(null);
                                  }
                                }}
                                autoFocus
                                className="flex-1 bg-white border border-blue-500 rounded px-2 py-1 text-slate-900 font-medium focus:outline-none text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleEditOptionSubmit(activeManageCategory, opt, editingOption.newVal)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded transition-colors"
                                title="Save modification"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingOption(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 rounded transition-colors"
                                title="Cancel edit"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="font-medium text-slate-800 truncate flex-1">{opt}</span>
                              <div className="flex items-center space-x-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setEditingOption({ oldVal: opt, newVal: opt })}
                                  className="text-slate-400 hover:text-blue-600 p-1 transition-colors"
                                  title="Modify / Edit option"
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

        {/* Modal for Managing Dispatched Party Quick List Presets (Exact match to Image 1) */}
        {showDispatchedManageModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              {/* Header with Dark bar and Gear icon */}
              <div className="bg-slate-900 text-white p-3.5 px-4 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    MANAGE DISPATCHED SITES / QUICK LIST
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDispatchedManageModal(false);
                    setEditingDispatchedPresetId(null);
                    setNewDispatchedPresetForm({ name: '', gstin: '', city: '', mobile: '', state: 'GUJARAT', address: '' });
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Form to Add / Edit Dropdown Option */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">
                    {editingDispatchedPresetId ? 'Edit Dropdown Option' : 'Add New Dropdown Option'}
                  </h4>

                  <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        1. Dispatched Party / Loading Site *
                      </label>
                      <input
                        type="text"
                        placeholder="Type new loading site / factory name..."
                        value={newDispatchedPresetForm.name}
                        onChange={e => setNewDispatchedPresetForm({ ...newDispatchedPresetForm, name: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          2. Dispatch GSTIN (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 24AAACG9876E1Z2"
                          value={newDispatchedPresetForm.gstin}
                          onChange={e => setNewDispatchedPresetForm({ ...newDispatchedPresetForm, gstin: e.target.value.toUpperCase() })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          3. Dispatch State
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. GUJARAT / MAHARASHTRA"
                          value={newDispatchedPresetForm.state}
                          onChange={e => setNewDispatchedPresetForm({ ...newDispatchedPresetForm, state: e.target.value.toUpperCase() })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          4. City
                        </label>
                        <input
                          type="text"
                          placeholder="Loading City"
                          value={newDispatchedPresetForm.city}
                          onChange={e => setNewDispatchedPresetForm({ ...newDispatchedPresetForm, city: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          5. Mobile Number (Optional)
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. +91 98765 43210"
                          value={newDispatchedPresetForm.mobile}
                          onChange={e => setNewDispatchedPresetForm({ ...newDispatchedPresetForm, mobile: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        6. Loading / Factory Address
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Plot No. 45, MIDC Phase II, Gate 2, Pune"
                        value={newDispatchedPresetForm.address}
                        onChange={e => setNewDispatchedPresetForm({ ...newDispatchedPresetForm, address: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                      />
                    </div>

                    <div className="flex justify-end items-center space-x-2 pt-1">
                      {editingDispatchedPresetId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDispatchedPresetId(null);
                            setNewDispatchedPresetForm({ name: '', gstin: '', city: '', mobile: '', state: 'GUJARAT', address: '' });
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded transition-colors text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveDispatchedPreset}
                        disabled={!newDispatchedPresetForm.name.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded flex items-center space-x-1 transition-colors text-xs cursor-pointer shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{editingDispatchedPresetId ? 'Update Option' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preset Options list */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-600 font-bold">
                    <span>Preset Options ({dispatchedPresets.length})</span>
                    <button
                      type="button"
                      onClick={handleResetDispatchedPresets}
                      className="text-blue-600 hover:underline text-[11px] font-semibold cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-slate-50">
                    {dispatchedPresets.length === 0 ? (
                      <p className="p-4 text-slate-400 text-center italic">No options present. Add one above!</p>
                    ) : (
                      dispatchedPresets.map(preset => (
                        <div key={preset.id} className="p-2.5 flex justify-between items-start bg-white hover:bg-slate-50 gap-2 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">{preset.name}</div>
                            <div className="text-[10.5px] text-slate-500 flex flex-wrap gap-x-2 mt-0.5">
                              {preset.gstin && <span className="font-mono text-blue-700 font-bold">GST: {preset.gstin}</span>}
                              {preset.city && <span className="text-slate-700 font-medium">City: {preset.city}</span>}
                              {preset.state && <span>State: {preset.state}</span>}
                              {preset.mobile && <span className="text-emerald-700">Mob: {preset.mobile}</span>}
                            </div>
                            {preset.address && (
                              <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">{preset.address}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-1 shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditDispatchedPreset(preset)}
                              className="text-slate-400 hover:text-blue-600 p-1 transition-colors cursor-pointer"
                              title="Edit preset"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDispatchedPreset(preset.id)}
                              className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                              title="Delete preset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleApplyDispatchedPreset(preset);
                                setShowDispatchedManageModal(false);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded flex items-center space-x-1 text-[10px] cursor-pointer shadow-2xs"
                              title="Use this loading site"
                            >
                              <Check className="w-3 h-3" />
                              <span>Use</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer with Done button */}
              <div className="bg-slate-50 border-t border-slate-200 p-3 px-4 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowDispatchedManageModal(false);
                    setEditingDispatchedPresetId(null);
                    setNewDispatchedPresetForm({ name: '', gstin: '', city: '', state: 'GUJARAT', mobile: '', address: '' });
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-1.5 rounded text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for Managing Consignee Quick List Presets (Matching image layout) */}
        {showConsigneeManageModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              {/* Header with Dark bar and Gear icon */}
              <div className="bg-slate-900 text-white p-3.5 px-4 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    MANAGE CONSIGNEES / RECEIVERS QUICK LIST
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowConsigneeManageModal(false);
                    setEditingConsigneePresetId(null);
                    setNewConsigneePresetForm({ name: '', gstin: '', city: '', state: 'GUJARAT', mobile: '', address: '' });
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Form to Add / Edit Dropdown Option */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">
                    {editingConsigneePresetId ? 'Edit Dropdown Option' : 'Add New Dropdown Option'}
                  </h4>

                  <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        1. Consignee Party / Receiver Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Type new receiver / consignee party name..."
                        value={newConsigneePresetForm.name}
                        onChange={e => setNewConsigneePresetForm({ ...newConsigneePresetForm, name: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          2. Consignee GSTIN (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 24AAACG9876E1Z2"
                          value={newConsigneePresetForm.gstin}
                          onChange={e => setNewConsigneePresetForm({ ...newConsigneePresetForm, gstin: e.target.value.toUpperCase() })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          3. Consignee State / Destination State
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. GUJARAT / MAHARASHTRA"
                          value={newConsigneePresetForm.state}
                          onChange={e => setNewConsigneePresetForm({ ...newConsigneePresetForm, state: e.target.value.toUpperCase() })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          4. City
                        </label>
                        <input
                          type="text"
                          placeholder="Receiver City"
                          value={newConsigneePresetForm.city}
                          onChange={e => setNewConsigneePresetForm({ ...newConsigneePresetForm, city: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          5. Mobile Number (Optional)
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. +91 98765 43210"
                          value={newConsigneePresetForm.mobile}
                          onChange={e => setNewConsigneePresetForm({ ...newConsigneePresetForm, mobile: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        6. Delivery / Receiver Address
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Plot No. 55, Ring Road Logistics Park, Surat"
                        value={newConsigneePresetForm.address}
                        onChange={e => setNewConsigneePresetForm({ ...newConsigneePresetForm, address: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                      />
                    </div>

                    <div className="flex justify-end items-center space-x-2 pt-1">
                      {editingConsigneePresetId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingConsigneePresetId(null);
                            setNewConsigneePresetForm({ name: '', gstin: '', city: '', state: 'GUJARAT', mobile: '', address: '' });
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded transition-colors text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveConsigneePreset}
                        disabled={!newConsigneePresetForm.name.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded flex items-center space-x-1 transition-colors text-xs cursor-pointer shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{editingConsigneePresetId ? 'Update Option' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preset Options list */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-600 font-bold">
                    <span>Preset Options ({consigneeListPresets.length})</span>
                    <button
                      type="button"
                      onClick={handleResetConsigneePresets}
                      className="text-blue-600 hover:underline text-[11px] font-semibold cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-slate-50">
                    {consigneeListPresets.length === 0 ? (
                      <p className="p-4 text-slate-400 text-center italic">No options present. Add one above!</p>
                    ) : (
                      consigneeListPresets.map(preset => (
                        <div key={preset.id} className="p-2.5 flex justify-between items-start bg-white hover:bg-slate-50 gap-2 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">{preset.name}</div>
                            <div className="text-[10.5px] text-slate-500 flex flex-wrap gap-x-2 mt-0.5">
                              {preset.gstin && <span className="font-mono text-blue-700 font-bold">GST: {preset.gstin}</span>}
                              {preset.city && <span className="text-slate-700 font-medium">City: {preset.city}</span>}
                              {preset.state && <span>State: {preset.state}</span>}
                              {preset.mobile && <span className="text-emerald-700">Mob: {preset.mobile}</span>}
                            </div>
                            {preset.address && (
                              <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">{preset.address}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-1 shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditConsigneePreset(preset)}
                              className="text-slate-400 hover:text-blue-600 p-1 transition-colors cursor-pointer"
                              title="Edit preset"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteConsigneePreset(preset.id)}
                              className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                              title="Delete preset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleApplyConsigneePreset(preset);
                                setShowConsigneeManageModal(false);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded flex items-center space-x-1 text-[10px] cursor-pointer shadow-2xs"
                              title="Use this receiver"
                            >
                              <Check className="w-3 h-3" />
                              <span>Use</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer with Done button */}
              <div className="bg-slate-50 border-t border-slate-200 p-3 px-4 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowConsigneeManageModal(false);
                    setEditingConsigneePresetId(null);
                    setNewConsigneePresetForm({ name: '', gstin: '', city: '', state: 'GUJARAT', mobile: '', address: '' });
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-1.5 rounded text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for Managing Ship To (Delivery Site) Quick List Presets */}
        {showShipToManageModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              {/* Header with Dark bar and Gear icon */}
              <div className="bg-slate-900 text-white p-3.5 px-4 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    MANAGE SHIP TO / DELIVERY SITES QUICK LIST
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowShipToManageModal(false);
                    setEditingShipToPresetId(null);
                    setNewShipToPresetForm({ name: '', gstin: '', city: '', state: 'GUJARAT', mobile: '', address: '' });
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Form to Add / Edit Dropdown Option */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">
                    {editingShipToPresetId ? 'Edit Dropdown Option' : 'Add New Dropdown Option'}
                  </h4>

                  <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        1. Ship To / Delivery Site Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Type new delivery site / project name..."
                        value={newShipToPresetForm.name}
                        onChange={e => setNewShipToPresetForm({ ...newShipToPresetForm, name: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          2. Ship To GSTIN (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 24AAACG9876E1Z2"
                          value={newShipToPresetForm.gstin}
                          onChange={e => setNewShipToPresetForm({ ...newShipToPresetForm, gstin: e.target.value.toUpperCase() })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 font-mono focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          3. Delivery / Destination State
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. GUJARAT / MAHARASHTRA"
                          value={newShipToPresetForm.state}
                          onChange={e => setNewShipToPresetForm({ ...newShipToPresetForm, state: e.target.value.toUpperCase() })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          4. City
                        </label>
                        <input
                          type="text"
                          placeholder="Site City"
                          value={newShipToPresetForm.city}
                          onChange={e => setNewShipToPresetForm({ ...newShipToPresetForm, city: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          5. Mobile Number (Optional)
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. +91 98765 43210"
                          value={newShipToPresetForm.mobile}
                          onChange={e => setNewShipToPresetForm({ ...newShipToPresetForm, mobile: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        6. Delivery Site / Unloading Address
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Plot No. 88, Near Toll Plaza, Industrial Area, Pune"
                        value={newShipToPresetForm.address}
                        onChange={e => setNewShipToPresetForm({ ...newShipToPresetForm, address: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                      />
                    </div>

                    <div className="flex justify-end items-center space-x-2 pt-1">
                      {editingShipToPresetId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShipToPresetId(null);
                            setNewShipToPresetForm({ name: '', gstin: '', city: '', state: 'GUJARAT', mobile: '', address: '' });
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded transition-colors text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveShipToPreset}
                        disabled={!newShipToPresetForm.name.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded flex items-center space-x-1 transition-colors text-xs cursor-pointer shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{editingShipToPresetId ? 'Update Option' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preset Options list */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-600 font-bold">
                    <span>Preset Options ({shipToListPresets.length})</span>
                    <button
                      type="button"
                      onClick={handleResetShipToPresets}
                      className="text-blue-600 hover:underline text-[11px] font-semibold cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-slate-50">
                    {shipToListPresets.length === 0 ? (
                      <p className="p-4 text-slate-400 text-center italic">No options present. Add one above!</p>
                    ) : (
                      shipToListPresets.map(preset => (
                        <div key={preset.id} className="p-2.5 flex justify-between items-start bg-white hover:bg-slate-50 gap-2 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">{preset.name}</div>
                            <div className="text-[10.5px] text-slate-500 flex flex-wrap gap-x-2 mt-0.5">
                              {preset.gstin && <span className="font-mono text-blue-700 font-bold">GST: {preset.gstin}</span>}
                              {preset.city && <span className="text-slate-700 font-medium">City: {preset.city}</span>}
                              {preset.state && <span>State: {preset.state}</span>}
                              {preset.mobile && <span className="text-emerald-700">Mob: {preset.mobile}</span>}
                            </div>
                            {preset.address && (
                              <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">{preset.address}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-1 shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditShipToPreset(preset)}
                              className="text-slate-400 hover:text-blue-600 p-1 transition-colors cursor-pointer"
                              title="Edit preset"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteShipToPreset(preset.id)}
                              className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                              title="Delete preset"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleApplyShipToPreset(preset);
                                setShowShipToManageModal(false);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded flex items-center space-x-1 text-[10px] cursor-pointer shadow-2xs"
                              title="Use this site"
                            >
                              <Check className="w-3 h-3" />
                              <span>Use</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer with Done button */}
              <div className="bg-slate-50 border-t border-slate-200 p-3 px-4 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowShipToManageModal(false);
                    setEditingShipToPresetId(null);
                    setNewShipToPresetForm({ name: '', gstin: '', city: '', state: 'GUJARAT', mobile: '', address: '' });
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-1.5 rounded text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for Managing Bill Series */}
        {showBillSeriesModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              {/* Header with Dark bar */}
              <div className="bg-slate-900 text-white p-3.5 px-4 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    MANAGE BILL SERIES & PREFIXES
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowBillSeriesModal(false);
                    setEditingSeriesId(null);
                    setSeriesForm({ prefix: '', label: '', description: '' });
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4 text-xs overflow-y-auto flex-1">
                {/* Add / Edit Series Form */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2">
                    {editingSeriesId ? 'Edit Bill Series' : 'Add New Bill Series'}
                  </h4>

                  <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          1. Series Prefix Code *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. NT, EXP, RAJ, SHREE, GST"
                          value={seriesForm.prefix}
                          onChange={e => setSeriesForm({ ...seriesForm, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono font-bold uppercase focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          2. Series Name / Label (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Express Cargo Series"
                          value={seriesForm.label}
                          onChange={e => setSeriesForm({ ...seriesForm, label: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                        3. Description / Purpose (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Used for Surat-Mumbai heavy container freight"
                        value={seriesForm.description}
                        onChange={e => setSeriesForm({ ...seriesForm, description: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:border-blue-500 focus:outline-none text-xs"
                      />
                    </div>

                    {seriesForm.prefix.trim() && (
                      <div className="bg-blue-50/70 border border-blue-200 rounded p-2 text-[11px] text-blue-900 flex items-center justify-between">
                        <span className="font-semibold">Format Pattern:</span>
                        <span className="font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {seriesForm.prefix.trim().toUpperCase()}/{getMonthAbbreviation(invoiceDate)}/1
                        </span>
                      </div>
                    )}

                    <div className="flex justify-end items-center space-x-2 pt-1">
                      {editingSeriesId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSeriesId(null);
                            setSeriesForm({ prefix: '', label: '', description: '' });
                          }}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded transition-colors text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveBillSeries}
                        disabled={!seriesForm.prefix.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-1.5 rounded flex items-center space-x-1 transition-colors text-xs cursor-pointer shadow-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{editingSeriesId ? 'Update Series' : 'Add Bill Series'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* List of Available Series */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-slate-600 font-bold">
                    <span>Available Series ({billSeriesList.length})</span>
                    <button
                      type="button"
                      onClick={handleResetBillSeries}
                      className="text-blue-600 hover:underline text-[11px] font-semibold cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100 bg-slate-50">
                    {billSeriesList.map(series => {
                      const nextSample = calculateNextSeriesInvoiceNumber(series.prefix, invoiceDate, invoices, initialInvoice?.id);
                      const matchingCount = invoices.filter(inv => inv.invoiceNumber && inv.invoiceNumber.startsWith(`${series.prefix}/`)).length;
                      const isCurrentlySelected = selectedSeries === series.prefix;

                      return (
                        <div key={series.id} className="p-2.5 flex justify-between items-start bg-white hover:bg-slate-50 gap-2 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                                {series.prefix}
                              </span>
                              <span className="font-bold text-slate-900 text-xs truncate">
                                {series.label || `${series.prefix} Series`}
                              </span>
                              {isCurrentlySelected && (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded border border-emerald-300">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-500 flex flex-wrap items-center gap-x-2.5 mt-1 font-mono">
                              <span>Next: <strong className="text-slate-800">{nextSample}</strong></span>
                              <span className="text-slate-400">•</span>
                              <span>Invoices: <strong className="text-slate-700">{matchingCount}</strong></span>
                            </div>
                            {series.description && (
                              <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">{series.description}</p>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleStartEditBillSeries(series)}
                              className="text-slate-400 hover:text-blue-600 p-1 transition-colors cursor-pointer"
                              title="Edit series"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBillSeries(series.id)}
                              className="text-slate-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                              title="Delete series"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyBillSeries(series.prefix)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded flex items-center space-x-1 text-[10px] cursor-pointer shadow-2xs"
                              title="Select and use this bill series"
                            >
                              <Check className="w-3 h-3" />
                              <span>Use</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 p-3 px-4 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowBillSeriesModal(false);
                    setEditingSeriesId(null);
                    setSeriesForm({ prefix: '', label: '', description: '' });
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-1.5 rounded text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </form>
    </div>
  );
};
