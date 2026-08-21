import React, { useState, useEffect } from 'react';
import { Invoice, InvoiceItem, Party, CompanySettings, TaxSlab, TaxType, TaxMechanism, PaymentMode, formatINR, INDIAN_STATES } from '../types';
import { 
  X, Plus, FileText, CheckCircle2, Building2, Calendar, Truck, ArrowUpRight, ArrowDownLeft, 
  Calculator, Percent, ShieldCheck, Tag, Info, Receipt, RotateCcw
} from 'lucide-react';

export const getFinancialYearCode = (dateStr?: string): string => {
  let d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) {
    d = new Date();
  }
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan (1), 1 = Feb (2), 2 = Mar (3), 3 = Apr (4)...
  
  let startYear = year;
  let endYear = year + 1;
  
  // April 1 to March 31 is the Indian Financial Year
  // Months Jan, Feb, Mar (indices 0, 1, 2) belong to previous calendar start year
  if (month < 3) {
    startYear = year - 1;
    endYear = year;
  }
  
  const startYY = (startYear % 100).toString().padStart(2, '0');
  const endYY = (endYear % 100).toString().padStart(2, '0');
  return `${startYY}${endYY}`;
};

export const calculateNextTaxBillNumber = (
  type: 'income' | 'expense',
  dateStr: string,
  allInvoices: Invoice[] = []
): string => {
  const prefix = type === 'income' ? 'INC' : 'EXP';
  const fy = getFinancialYearCode(dateStr);
  
  // Pattern matches INC/2627/1, EXP/2627/1, INC-2627-1, etc.
  const regex = new RegExp(`^${prefix}[\\/\\-]${fy}[\\/\\-](\\d+)$`, 'i');
  
  let maxSeq = 0;
  for (const inv of allInvoices) {
    const num = (inv.invoiceNumber || '').trim();
    const match = num.match(regex);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > maxSeq) {
        maxSeq = val;
      }
    }
  }
  
  return `${prefix}/${fy}/${maxSeq + 1}`;
};

interface PartyTaxBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  parties: Party[];
  invoices?: Invoice[];
  initialPartyId?: string;
  initialBillType?: 'income' | 'expense';
  settings?: CompanySettings;
  onSaveInvoice: (invoice: Invoice) => void;
}

export const PartyTaxBillModal: React.FC<PartyTaxBillModalProps> = ({
  isOpen,
  onClose,
  parties,
  invoices = [],
  initialPartyId,
  initialBillType = 'income',
  settings,
  onSaveInvoice
}) => {
  const [billCategory, setBillCategory] = useState<'income' | 'expense'>(initialBillType);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  
  // Bill Identifiers
  const [billNumber, setBillNumber] = useState<string>('');
  const [billDate, setBillDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lrNumber, setLrNumber] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [origin, setOrigin] = useState<string>('Pune');
  const [destination, setDestination] = useState<string>('');

  // Particulars / Items
  const [itemDescription, setItemDescription] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('Freight Charges');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('Fixed');
  const [ratePerUnit, setRatePerUnit] = useState<number>(0);
  const [taxableAmount, setTaxableAmount] = useState<number>(0);
  const [isManualTaxable, setIsManualTaxable] = useState<boolean>(false);

  // Additional Charges
  const [loadingCharges, setLoadingCharges] = useState<number>(0);
  const [unloadingCharges, setUnloadingCharges] = useState<number>(0);
  const [detentionCharges, setDetentionCharges] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);

  // Tax Settings
  const [taxSlab, setTaxSlab] = useState<TaxSlab>(18);
  const [taxMechanism, setTaxMechanism] = useState<TaxMechanism>('forward_charge');
  const [taxType, setTaxType] = useState<TaxType>('intra_state');

  // Ledger Impact for Expense Bill
  const [ledgerImpact, setLedgerImpact] = useState<'credit' | 'debit'>('credit');

  // TDS Settings (Section 194C)
  const [tdsApplicable, setTdsApplicable] = useState<boolean>(false);
  const [tdsRate, setTdsRate] = useState<number>(2);

  // Immediate Payment / Advance Settlement
  const [hasImmediatePayment, setHasImmediatePayment] = useState<boolean>(false);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('bank_neft');
  const [paymentRef, setPaymentRef] = useState<string>('');

  // Remarks / Notes
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Common quick templates
  const incomeTemplates = [
    'Freight & Transport Service Charges',
    'Transportation & Logistics Handling',
    'Consignment Delivery Charges',
    'Crane & Forklift Lifting Charges',
    'Warehousing & Storage Handling',
    'Material Supply & Transit'
  ];

  const expenseTemplates = [
    'Unloading & Labour Charges',
    'Loading & Handling Charges',
    'Detention & Demurrage Charges',
    'Local Cartage & Transhipment',
    'Toll & Green Tax Expenses',
    'Brokerage & Commission Charges',
    'Maintenance & Mechanical Services',
    'Third-Party Freight Expense'
  ];

  // Sync state when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      const defaultPartyId = initialPartyId || (parties.length > 0 ? parties[0].id : '');
      const billType: 'income' | 'expense' = initialBillType === 'expense' ? 'expense' : 'income';
      const todayStr = new Date().toISOString().split('T')[0];
      
      setSelectedPartyId(defaultPartyId);
      setBillCategory(billType);

      const targetParty = parties.find(p => p.id === defaultPartyId) || parties[0];
      setBillNumber(calculateNextTaxBillNumber(billType, todayStr, invoices));
      setBillDate(todayStr);
      setDueDate(todayStr);
      setLrNumber('');
      setVehicleNumber('');
      setOrigin('Pune');
      setDestination(targetParty?.city || '');

      if (billType === 'income') {
        setItemDescription('Freight & Transport Service Charges');
        setExpenseCategory('Freight Charges');
        setTaxSlab(18);
        setLedgerImpact('debit');
      } else {
        setItemDescription('Unloading & Labour Charges');
        setExpenseCategory('Unloading Charges');
        setTaxSlab(18);
        setLedgerImpact('credit');
      }

      setQuantity(1);
      setUnit('Fixed');
      setRatePerUnit(5000);
      setTaxableAmount(5000);
      setIsManualTaxable(false);
      setLoadingCharges(0);
      setUnloadingCharges(0);
      setDetentionCharges(0);
      setOtherCharges(0);
      setTaxMechanism('forward_charge');
      setTdsApplicable(false);
      setTdsRate(2);
      setHasImmediatePayment(false);
      setPaidAmount(0);
      setPaymentRef('');
      setNotes('');
      setSuccessMessage('');

      // Determine Tax Type (Intra vs Inter state)
      const companyStateCode = settings?.stateCode || '27';
      const partyStateCode = targetParty?.stateCode || '27';
      if (companyStateCode && partyStateCode && companyStateCode !== partyStateCode) {
        setTaxType('inter_state');
      } else {
        setTaxType('intra_state');
      }
    }
  }, [isOpen, initialPartyId, initialBillType, parties, settings, invoices]);

  // When party changes, update tax type & bill number if needed
  const handlePartyChange = (pId: string) => {
    setSelectedPartyId(pId);
    const targetParty = parties.find(p => p.id === pId);
    if (targetParty) {
      if (!destination) setDestination(targetParty.city || '');
      const companyStateCode = settings?.stateCode || '27';
      const partyStateCode = targetParty.stateCode || '27';
      setTaxType(partyStateCode && companyStateCode !== partyStateCode ? 'inter_state' : 'intra_state');
    }
  };

  // Switch Bill Category (Income vs Expense)
  const handleCategorySwitch = (newCat: 'income' | 'expense') => {
    setBillCategory(newCat);
    setBillNumber(calculateNextTaxBillNumber(newCat, billDate, invoices));
    if (newCat === 'income') {
      setItemDescription('Freight & Transport Service Charges');
      setExpenseCategory('Freight Charges');
      setLedgerImpact('debit');
    } else {
      setItemDescription('Unloading & Labour Charges');
      setExpenseCategory('Unloading Charges');
      setLedgerImpact('credit');
    }
  };

  // Date change handler to auto-update FY if needed
  const handleBillDateChange = (newDate: string) => {
    setBillDate(newDate);
    const prevFy = getFinancialYearCode(billDate);
    const newFy = getFinancialYearCode(newDate);
    // If financial year changed, auto-recalculate sequence
    if (prevFy !== newFy || !billNumber.trim()) {
      setBillNumber(calculateNextTaxBillNumber(billCategory, newDate, invoices));
    }
  };

  // Calculate Base Taxable Subtotal
  useEffect(() => {
    if (!isManualTaxable) {
      const calculated = (Number(quantity) || 0) * (Number(ratePerUnit) || 0);
      setTaxableAmount(calculated);
    }
  }, [quantity, ratePerUnit, isManualTaxable]);

  const selectedParty = parties.find(p => p.id === selectedPartyId) || parties[0];

  // Tax calculations
  const subTotal = (Number(taxableAmount) || 0) + 
    (Number(loadingCharges) || 0) + 
    (Number(unloadingCharges) || 0) + 
    (Number(detentionCharges) || 0) + 
    (Number(otherCharges) || 0);

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;

  if (taxMechanism === 'forward_charge' && taxSlab > 0) {
    if (taxType === 'intra_state') {
      cgstRate = taxSlab / 2;
      sgstRate = taxSlab / 2;
    } else {
      igstRate = taxSlab;
    }
  }

  const cgstAmount = Math.round((subTotal * cgstRate) / 100 * 100) / 100;
  const sgstAmount = Math.round((subTotal * sgstRate) / 100 * 100) / 100;
  const igstAmount = Math.round((subTotal * igstRate) / 100 * 100) / 100;
  const totalTax = cgstAmount + sgstAmount + igstAmount;

  const rawGrandTotal = subTotal + totalTax;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;

  // TDS Calculation
  const tdsAmount = tdsApplicable ? Math.round((subTotal * (Number(tdsRate) || 0)) / 100) : 0;
  const netPayable = grandTotal - tdsAmount;

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) {
      alert('Please select a party account.');
      return;
    }
    if (!billNumber.trim()) {
      alert('Please enter a valid Bill Number.');
      return;
    }
    if (subTotal <= 0) {
      alert('Please enter a valid taxable amount.');
      return;
    }

    setIsSubmitting(true);

    const items: InvoiceItem[] = [
      {
        id: `item-${Date.now()}`,
        description: itemDescription.trim() || (billCategory === 'income' ? 'Freight & Transport Service' : 'Transport Expense'),
        quantity: Number(quantity) || 1,
        unit: unit || 'Fixed',
        ratePerTon: Number(ratePerUnit) || 0,
        amount: Number(taxableAmount) || 0
      }
    ];

    const initialPayments = [];
    let initialAmountPaid = 0;
    if (hasImmediatePayment && paidAmount > 0) {
      initialAmountPaid = Math.min(paidAmount, netPayable);
      initialPayments.push({
        id: `pay-${Date.now()}`,
        date: billDate,
        amount: initialAmountPaid,
        mode: paymentMode,
        referenceNo: paymentRef.trim() || (billCategory === 'income' ? 'ADVANCE-RECD' : 'PAID-DIRECT'),
        notes: `Immediate payment recorded with ${billCategory === 'income' ? 'Income Bill' : 'Expense Bill'}`
      });
    }

    const balanceDue = netPayable - initialAmountPaid;
    const paymentStatus = balanceDue <= 0 ? 'paid' : initialAmountPaid > 0 ? 'partial' : 'unpaid';

    const newBillInvoice: Invoice = {
      id: `bill-${billCategory}-${Date.now()}`,
      invoiceNumber: billNumber.trim(),
      lrNumber: lrNumber.trim() || `LR-${billNumber.trim().replace(/[^A-Z0-9]/gi, '')}`,
      lrDate: billDate,
      invoiceDate: billDate,
      dueDate: dueDate || billDate,
      invoiceType: 'tax_invoice',
      billCategory: billCategory,
      expenseCategory: billCategory === 'expense' ? expenseCategory : undefined,
      ledgerImpact: billCategory === 'expense' ? ledgerImpact : 'debit',

      // Party Data
      partyId: selectedParty.id,
      consignorName: selectedParty.name,
      consignorGSTIN: selectedParty.gstin || '',
      consignorAddress: selectedParty.address || '',
      consignorState: selectedParty.state || 'Maharashtra',
      consignorStateCode: selectedParty.stateCode || '27',

      // Consignee (Receiver / Destination)
      consigneeName: selectedParty.name,
      consigneeGSTIN: selectedParty.gstin || '',
      consigneeAddress: selectedParty.address || '',
      consigneeState: selectedParty.state || 'Maharashtra',

      // Dispatched / Destination Info
      origin: origin || 'Pune',
      destination: destination || selectedParty.city || 'Local Site',
      vehicleNumber: vehicleNumber.trim() || 'Direct/Logistics',
      driverName: '',
      driverPhone: '',
      materialType: itemDescription || (billCategory === 'income' ? 'Transport Goods' : 'Expense Service'),

      // Line items & Breakdown
      items,
      grossFreight: Number(taxableAmount) || 0,
      loadingCharges: Number(loadingCharges) || 0,
      unloadingCharges: Number(unloadingCharges) || 0,
      detentionCharges: Number(detentionCharges) || 0,
      otherCharges: Number(otherCharges) || 0,
      subTotal,

      // Tax Calculations
      taxSlab,
      taxType,
      taxMechanism,
      cgstRate,
      sgstRate,
      igstRate,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      roundOff,
      grandTotal,

      // Deductions & TDS
      advancePaid: 0,
      fuelDeduction: 0,
      otherDeductions: 0,
      kasarDeduction: 0,
      tdsApplicable,
      tdsRate: tdsApplicable ? Number(tdsRate) : 0,
      tdsAmount,
      netPayable,

      // Payment Status
      amountPaid: initialAmountPaid,
      balanceDue,
      paymentStatus,
      payments: initialPayments,

      notes: notes.trim() || `${billCategory === 'income' ? 'Income Tax Bill' : 'Expense Tax Bill'} added directly in Party Ledger`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveInvoice(newBillInvoice);
    setSuccessMessage(`${billCategory === 'income' ? 'Income Bill (Tax)' : 'Expense Bill (Tax)'} successfully added to ${selectedParty.name}'s Ledger!`);

    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
    }, 900);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl text-slate-800 shadow-2xl my-6 max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg ${billCategory === 'income' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center space-x-2">
                <span>Party Ledger: Add Tax Bill</span>
                <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-extrabold ${
                  billCategory === 'income' ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
                }`}>
                  {billCategory === 'income' ? '📈 Income (Tax)' : '📉 Expense (Tax)'}
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Record GST compliant Income or Expense Tax Bills directly linked to Party Account ledger.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scroll Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          
          {/* Bill Nature Toggle (Income vs Expense) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Select Bill Nature / Transaction Type:</span>
              <span className="text-[10px] text-slate-500 font-normal">Only in Party Ledger Accounts</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2.5">
              {/* Income Bill Button */}
              <button
                type="button"
                onClick={() => handleCategorySwitch('income')}
                className={`flex items-start space-x-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                  billCategory === 'income'
                    ? 'bg-emerald-50/80 border-emerald-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`p-2 rounded shrink-0 ${billCategory === 'income' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-bold text-xs flex items-center space-x-1.5 ${billCategory === 'income' ? 'text-emerald-900' : 'text-slate-800'}`}>
                    <span>📈 Income Bill (Tax)</span>
                    {billCategory === 'income' && <span className="bg-emerald-600 text-white text-[9px] px-1 rounded">ACTIVE</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Freight / Transport Services rendered. <strong className="text-emerald-700">Debits Party</strong> (Increases receivable).
                  </div>
                </div>
              </button>

              {/* Expense Bill Button */}
              <button
                type="button"
                onClick={() => handleCategorySwitch('expense')}
                className={`flex items-start space-x-2.5 p-3 rounded-lg border-2 text-left transition-all ${
                  billCategory === 'expense'
                    ? 'bg-amber-50/80 border-amber-600 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`p-2 rounded shrink-0 ${billCategory === 'expense' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <div className={`font-bold text-xs flex items-center space-x-1.5 ${billCategory === 'expense' ? 'text-amber-900' : 'text-slate-800'}`}>
                    <span>📉 Expense Bill (Tax)</span>
                    {billCategory === 'expense' && <span className="bg-amber-600 text-white text-[9px] px-1 rounded">ACTIVE</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Unloading, Handling, Demurrage or Cost bill. <strong className="text-amber-700">Credits Party</strong> (Payable).
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Party & General Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Party Selector */}
            <div className="md:col-span-1 space-y-1">
              <label className="block text-slate-700 font-bold">Party Account *</label>
              <select
                value={selectedPartyId}
                onChange={e => handlePartyChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
              >
                {parties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.city ? `(${p.city})` : ''}
                  </option>
                ))}
              </select>
              {selectedParty && (
                <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200 font-mono">
                  GST: <span className="text-slate-800 font-bold">{selectedParty.gstin || 'UNREGISTERED'}</span> | State: {selectedParty.state || 'MH'} ({selectedParty.stateCode || '27'})
                </div>
              )}
            </div>

            {/* Bill Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-slate-700 font-bold text-xs">
                  Bill / Invoice Number *
                </label>
                <button
                  type="button"
                  onClick={() => setBillNumber(calculateNextTaxBillNumber(billCategory, billDate, invoices))}
                  className="text-[10.5px] text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1"
                  title="Auto calculate next sequential number for current Financial Year"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Auto FY ({getFinancialYearCode(billDate)})</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={billNumber}
                  onChange={e => setBillNumber(e.target.value.toUpperCase())}
                  placeholder={billCategory === 'income' ? `INC/${getFinancialYearCode(billDate)}/1` : `EXP/${getFinancialYearCode(billDate)}/1`}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-mono font-bold focus:border-blue-500 focus:outline-none pr-8 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setBillNumber(calculateNextTaxBillNumber(billCategory, billDate, invoices))}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Reset to next sequential auto number"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                Auto Series: <strong className="text-slate-800">{billCategory === 'income' ? 'INC' : 'EXP'}/{getFinancialYearCode(billDate)}/1, 2, 3...</strong> (F.Y. {getFinancialYearCode(billDate)})
              </p>
            </div>

            {/* Bill Date */}
            <div className="space-y-1">
              <label className="block text-slate-700 font-bold text-xs">Bill Date *</label>
              <input
                type="date"
                required
                value={billDate}
                onChange={e => handleBillDateChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-semibold focus:border-blue-500 focus:outline-none text-sm"
              />
              <p className="text-[10px] text-slate-500">
                F.Y. Year: <span className="font-mono font-bold text-slate-700">{getFinancialYearCode(billDate)}</span>
              </p>
            </div>
          </div>

          {/* Optional Transport Info & Quick Template Selector */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {billCategory === 'income' ? 'Income Service Particulars' : 'Expense Category & Particulars'}
              </span>
              <span className="text-[10px] text-slate-500">Click a template below to quick-fill:</span>
            </div>

            {/* Quick Templates Chips */}
            <div className="flex flex-wrap gap-1.5">
              {(billCategory === 'income' ? incomeTemplates : expenseTemplates).map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setItemDescription(tpl);
                    if (billCategory === 'expense') setExpenseCategory(tpl);
                  }}
                  className="bg-white hover:bg-blue-50 border border-slate-300 hover:border-blue-400 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
                >
                  + {tpl}
                </button>
              ))}
            </div>

            {/* Particulars Description */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="md:col-span-2 space-y-1">
                <label className="block text-slate-700 font-bold">Service / Description Details *</label>
                <input
                  type="text"
                  required
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  placeholder="e.g. Freight Charges - Pune to Vapi / Unloading Charges"
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-medium focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Vehicle No (Optional)</label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="MH 12 AB 1234"
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Route / LR No optional */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="block text-slate-600 font-semibold text-[11px]">LR / Bilty No (Optional)</label>
                <input
                  type="text"
                  value={lrNumber}
                  onChange={e => setLrNumber(e.target.value)}
                  placeholder="LR-7712"
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-600 font-semibold text-[11px]">Origin (From)</label>
                <input
                  type="text"
                  value={origin}
                  onChange={e => setOrigin(e.target.value)}
                  placeholder="Pune"
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-600 font-semibold text-[11px]">Destination (To)</label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="Destination City"
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Amount & Calculation Breakdown */}
          <div className="border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Calculator className="w-3.5 h-3.5 text-blue-700" />
                <span>Bill Taxable Amount & GST Tax Calculation</span>
              </span>
              
              <button
                type="button"
                onClick={() => setIsManualTaxable(!isManualTaxable)}
                className="text-[10px] text-blue-700 hover:underline font-bold"
              >
                {isManualTaxable ? 'Switch to Qty × Rate' : 'Enter Direct Taxable Amount'}
              </button>
            </div>

            {/* Qty, Unit, Rate or Direct Amount */}
            {!isManualTaxable ? (
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-slate-600 font-bold">Quantity / Units</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-600 font-bold">Unit</label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-bold focus:outline-none"
                  >
                    <option value="Fixed">Fixed Amount</option>
                    <option value="Tons">Tons (MT)</option>
                    <option value="Trips">Trips</option>
                    <option value="Kg">Kg</option>
                    <option value="Pkgs">Packages / Boxes</option>
                    <option value="Hours">Hours</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-600 font-bold">Rate (₹) per Unit</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={ratePerUnit}
                    onChange={e => setRatePerUnit(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-bold focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-slate-700 font-bold">Direct Basic Taxable Value (₹) *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={taxableAmount}
                  onChange={e => setTaxableAmount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-bold text-base focus:outline-none"
                />
              </div>
            )}

            {/* Additional Charges (Optional Accordion/Fields) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold">Loading Charges (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={loadingCharges || ''}
                  placeholder="0"
                  onChange={e => setLoadingCharges(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold">Unloading Charges (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={unloadingCharges || ''}
                  placeholder="0"
                  onChange={e => setUnloadingCharges(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold">Detention Charges (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={detentionCharges || ''}
                  placeholder="0"
                  onChange={e => setDetentionCharges(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold">Other / Extra (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={otherCharges || ''}
                  placeholder="0"
                  onChange={e => setOtherCharges(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            {/* GST Tax Controls */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                
                {/* GST Slab */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold flex items-center space-x-1">
                    <Percent className="w-3.5 h-3.5 text-blue-700" />
                    <span>GST Tax Slab *</span>
                  </label>
                  <select
                    value={taxSlab}
                    onChange={e => setTaxSlab(Number(e.target.value) as TaxSlab)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 font-bold text-slate-800 focus:outline-none"
                  >
                    <option value={0}>0% (Nil / Exempt)</option>
                    <option value={5}>5% (Transport / RCM / Forward)</option>
                    <option value={12}>12% (Standard Goods)</option>
                    <option value={18}>18% (Standard Services / GST)</option>
                    <option value={28}>28% (Luxury / Heavy)</option>
                  </select>
                </div>

                {/* Tax Mechanism */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">Tax Mechanism</label>
                  <select
                    value={taxMechanism}
                    onChange={e => setTaxMechanism(e.target.value as TaxMechanism)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="forward_charge">Forward Charge (Tax in Bill)</option>
                    <option value="rcm">Reverse Charge (RCM - 5%)</option>
                    <option value="exempt">Exempt / Non-Taxable</option>
                  </select>
                </div>

                {/* Tax Type (Intra vs Inter) */}
                <div className="space-y-1">
                  <label className="block text-slate-700 font-bold">Tax Supply Type</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setTaxType('intra_state')}
                      className={`p-1.5 rounded border text-[11px] font-bold text-center ${
                        taxType === 'intra_state'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Intra (CGST+SGST)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxType('inter_state')}
                      className={`p-1.5 rounded border text-[11px] font-bold text-center ${
                        taxType === 'inter_state'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Inter (IGST)
                    </button>
                  </div>
                </div>

              </div>

              {/* Tax Summary Breakdown Card */}
              <div className="bg-white p-3 rounded border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-1">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Taxable Subtotal</div>
                  <div className="text-xs font-bold text-slate-900 font-mono">₹{formatINR(subTotal)}</div>
                </div>
                
                <div className="p-1">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    {taxType === 'intra_state' ? `CGST (${cgstRate}%) + SGST (${sgstRate}%)` : `IGST (${igstRate}%)`}
                  </div>
                  <div className="text-xs font-bold text-blue-700 font-mono">
                    {taxType === 'intra_state' 
                      ? `₹${formatINR(cgstAmount)} + ₹${formatINR(sgstAmount)}`
                      : `₹${formatINR(igstAmount)}`}
                  </div>
                </div>

                <div className="p-1">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Total GST Tax</div>
                  <div className="text-xs font-bold text-emerald-700 font-mono">₹{formatINR(totalTax)}</div>
                </div>

                <div className="p-1 bg-slate-50 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-700 uppercase font-bold">Grand Total (Bill)</div>
                  <div className="text-sm font-black text-slate-900 font-mono">₹{formatINR(grandTotal)}</div>
                </div>
              </div>

            </div>

            {/* TDS (Section 194C) */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 rounded border border-slate-200">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tdsApplicable}
                  onChange={e => setTdsApplicable(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="font-bold text-slate-700">Apply TDS Deduction (Section 194C)</span>
              </label>

              {tdsApplicable && (
                <div className="flex items-center space-x-2">
                  <span className="text-slate-600 font-semibold">TDS Rate:</span>
                  <select
                    value={tdsRate}
                    onChange={e => setTdsRate(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value={1}>1% (Individual / HUF)</option>
                    <option value={2}>2% (Company / Firm)</option>
                    <option value={0.5}>0.5% (Special)</option>
                    <option value={5}>5%</option>
                  </select>
                  <span className="font-mono font-bold text-red-600">
                    - ₹{formatINR(tdsAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* Expense Bill Ledger Impact (Debit vs Credit) */}
            {billCategory === 'expense' && (
              <div className="bg-amber-50/60 p-2.5 rounded border border-amber-200 space-y-1.5">
                <div className="font-bold text-slate-800 text-[11px] flex items-center space-x-1">
                  <Tag className="w-3.5 h-3.5 text-amber-700" />
                  <span>Expense Ledger Posting Impact:</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLedgerImpact('credit')}
                    className={`p-2 rounded border text-left text-xs transition-all ${
                      ledgerImpact === 'credit'
                        ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <div className="font-bold">📉 Credit to Party (Payable) [Default]</div>
                    <div className={`text-[10px] mt-0.5 ${ledgerImpact === 'credit' ? 'text-amber-100' : 'text-slate-500'}`}>
                      Vendor / Party billed us for service; we owe them.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLedgerImpact('debit')}
                    className={`p-2 rounded border text-left text-xs transition-all ${
                      ledgerImpact === 'debit'
                        ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <div className="font-bold">📈 Debit to Party (Charged)</div>
                    <div className={`text-[10px] mt-0.5 ${ledgerImpact === 'debit' ? 'text-amber-100' : 'text-slate-500'}`}>
                      Expense incurred on party behalf; party owes us.
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Immediate Payment Option */}
            <div className="border-t border-slate-200 pt-2 space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasImmediatePayment}
                  onChange={e => {
                    setHasImmediatePayment(e.target.checked);
                    if (e.target.checked && paidAmount === 0) setPaidAmount(netPayable);
                  }}
                  className="rounded text-emerald-600 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="font-bold text-slate-800">
                  {billCategory === 'income' 
                    ? 'Record Advance / Full Payment received against this Income Bill immediately'
                    : 'Record Payment made against this Expense Bill immediately'}
                </span>
              </label>

              {hasImmediatePayment && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-emerald-50/50 p-2.5 rounded border border-emerald-200">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold">Amount (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={paidAmount}
                      onChange={e => setPaidAmount(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold">Payment Mode</label>
                    <select
                      value={paymentMode}
                      onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-semibold focus:outline-none"
                    >
                      <option value="bank_neft">Bank NEFT / RTGS</option>
                      <option value="upi">UPI / QR Code</option>
                      <option value="cash">Cash</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold">Reference / UTR No</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      placeholder="e.g. UTR12345 / Cheque #0012"
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes / Remarks */}
            <div>
              <label className="block text-slate-600 font-bold mb-0.5">Notes / Remarks (Optional)</label>
              <textarea
                rows={1}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Additional details for party ledger..."
                className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
              />
            </div>

          </div>

          {/* Success Message Banner */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMessage}</span>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="text-left">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Net Bill Amount</div>
                <div className="text-base font-black text-slate-900 font-mono">₹{formatINR(netPayable)}</div>
              </div>
              <div className="text-left pl-3 border-l border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Ledger Impact</div>
                <div className={`text-xs font-bold ${billCategory === 'income' || (billCategory === 'expense' && ledgerImpact === 'debit') ? 'text-blue-700' : 'text-amber-700'}`}>
                  {billCategory === 'income' ? 'Debit (Receivable)' : ledgerImpact === 'debit' ? 'Debit (Charged)' : 'Credit (Payable)'}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-all border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2 text-white font-bold rounded-lg transition-all shadow-md flex items-center space-x-1.5 ${
                  billCategory === 'income' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'Saving...' : `Save ${billCategory === 'income' ? 'Income Bill (Tax)' : 'Expense Bill (Tax)'}`}
                </span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
