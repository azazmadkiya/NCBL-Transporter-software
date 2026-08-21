import React, { useState, useMemo } from 'react';
import { Invoice, PaymentRecord, PaymentMode, Party, CompanySettings, formatINR } from '../types';
import { CreditCard, CheckCircle2, Search, Edit, Trash2, Wallet, Calendar, Filter, X, User, ArrowDownLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { DirectPartyPaymentModal } from './DirectPartyPaymentModal';

import { UserRole } from '../types';

interface PaymentTrackerProps {
  userRole?: UserRole;
  invoices: Invoice[];
  parties: Party[];
  settings?: CompanySettings;
  onAddPayment: (invoice: Invoice, payment: PaymentRecord) => void;
  onUpdatePayment?: (invoice: Invoice, payment: PaymentRecord) => void;
  onDeletePayment?: (invoice: Invoice, paymentId: string, skipConfirm?: boolean) => void;
  onOpenPaymentOptions?: (invoice: Invoice) => void;
}

export const PaymentTracker: React.FC<PaymentTrackerProps> = ({
  userRole = 'admin',
  invoices,
  parties,
  settings,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onOpenPaymentOptions
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [selectedParty, setSelectedParty] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [voucherPage, setVoucherPage] = useState(1);
  const [voucherPageSize, setVoucherPageSize] = useState<number>(25);

  // Extract unique Billing Party (Consignor) options from parties and invoices
  const partyOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...parties.map(p => p.name),
        ...invoices.map(inv => inv.consignorName).filter(Boolean)
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [parties, invoices]);
  const [showDirectPaymentModal, setShowDirectPaymentModal] = useState(false);

  // Edit payment modal state
  const [editingPayment, setEditingPayment] = useState<{ invoice: Invoice; payment: PaymentRecord } | null>(null);

  // Payment Form state
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payKasar, setPayKasar] = useState<number | ''>('');
  const [payMode, setPayMode] = useState<PaymentMode>('bank_neft');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  // Date Presets Helper
  const setThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    setStartDate(firstDay);
    setEndDate(today);
  };

  const setLastMonth = () => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    setStartDate(firstDayLastMonth);
    setEndDate(lastDayLastMonth);
  };

  const setFinancialYear = () => {
    const now = new Date();
    const currMonth = now.getMonth(); // 0-indexed
    const startYear = currMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    setStartDate(`${startYear}-04-01`);
    setEndDate(now.toISOString().split('T')[0]);
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  // Calculations & Filtering
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (filterStatus !== 'all' && inv.paymentStatus !== filterStatus) return false;
      if (selectedParty && inv.consignorName !== selectedParty) return false;
      if (startDate && inv.invoiceDate < startDate) return false;
      if (endDate && inv.invoiceDate > endDate) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(term) ||
          (inv.salesBillNumber && inv.salesBillNumber.toLowerCase().includes(term)) ||
          inv.lrNumber.toLowerCase().includes(term) ||
          inv.consignorName.toLowerCase().includes(term) ||
          inv.vehicleNumber.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [invoices, filterStatus, selectedParty, startDate, endDate, searchTerm]);

  // Extract all payment records across all invoices for the Vouchers list
  const allPaymentVouchers = useMemo(() => {
    const vouchers: { invoice: Invoice; payment: PaymentRecord }[] = [];
    invoices.forEach(inv => {
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach(pay => {
          vouchers.push({ invoice: inv, payment: pay });
        });
      }
    });
    // Sort newest payment date first
    vouchers.sort((a, b) => new Date(b.payment.date).getTime() - new Date(a.payment.date).getTime());
    return vouchers;
  }, [invoices]);

  // Filter Vouchers by Date Range, Party & Search
  const filteredPaymentVouchers = useMemo(() => {
    return allPaymentVouchers.filter(item => {
      if (selectedParty && item.invoice.consignorName !== selectedParty) return false;
      if (startDate && item.payment.date < startDate) return false;
      if (endDate && item.payment.date > endDate) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.invoice.invoiceNumber.toLowerCase().includes(term) ||
          (item.invoice.salesBillNumber && item.invoice.salesBillNumber.toLowerCase().includes(term)) ||
          item.invoice.consignorName.toLowerCase().includes(term) ||
          (item.payment.referenceNo && item.payment.referenceNo.toLowerCase().includes(term)) ||
          item.payment.mode.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [allPaymentVouchers, selectedParty, startDate, endDate, searchTerm]);

  // Selected Vouchers State & Calculation
  const [selectedVoucherKeys, setSelectedVoucherKeys] = useState<Set<string>>(new Set());

  const getVoucherKey = (item: { invoice: Invoice; payment: PaymentRecord }) => `${item.invoice.id}_${item.payment.id}`;

  const isAllVouchersSelected = filteredPaymentVouchers.length > 0 && filteredPaymentVouchers.every(item => selectedVoucherKeys.has(getVoucherKey(item)));

  const handleSelectAllVouchers = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const keys = new Set(filteredPaymentVouchers.map(getVoucherKey));
      setSelectedVoucherKeys(keys);
    } else {
      setSelectedVoucherKeys(new Set());
    }
  };

  const toggleVoucherKey = (key: string) => {
    setSelectedVoucherKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearVoucherSelection = () => {
    setSelectedVoucherKeys(new Set());
  };

  const selectedVouchersList = useMemo(() => {
    return filteredPaymentVouchers.filter(item => selectedVoucherKeys.has(getVoucherKey(item)));
  }, [filteredPaymentVouchers, selectedVoucherKeys]);

  const selectedVouchersAmount = useMemo(() => {
    return selectedVouchersList.reduce((sum, item) => sum + (item.payment.amount || 0), 0);
  }, [selectedVouchersList]);

  const selectedVouchersKasar = useMemo(() => {
    return selectedVouchersList.reduce((sum, item) => sum + (item.payment.kasarAmount || 0), 0);
  }, [selectedVouchersList]);

  const selectedVouchersTotal = selectedVouchersAmount + selectedVouchersKasar;

  const handleDeleteSelectedVouchers = async () => {
    if (!onDeletePayment || selectedVouchersList.length === 0) return;

    const count = selectedVouchersList.length;
    if (window.confirm(`Are you sure you want to delete ${count} selected payment voucher(s)?`)) {
      for (const item of selectedVouchersList) {
        await onDeletePayment(item.invoice, item.payment.id, true);
      }
      clearVoucherSelection();
    }
  };

  const totalFilteredVouchersAmount = useMemo(() => {
    return filteredPaymentVouchers.reduce((sum, item) => sum + (item.payment.amount || 0), 0);
  }, [filteredPaymentVouchers]);

  const totalFilteredVouchersKasar = useMemo(() => {
    return filteredPaymentVouchers.reduce((sum, item) => sum + (item.payment.kasarAmount || 0), 0);
  }, [filteredPaymentVouchers]);

  const totalOutstanding = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + inv.balanceDue, 0);
  }, [filteredInvoices]);

  const totalCollected = useMemo(() => {
    return filteredInvoices.reduce((acc, inv) => acc + inv.amountPaid, 0);
  }, [filteredInvoices]);

  // Voucher pagination
  const totalVoucherPages = voucherPageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredPaymentVouchers.length / voucherPageSize));
  const paginatedVouchers = useMemo(() => {
    if (voucherPageSize === 0) return filteredPaymentVouchers;
    const start = (voucherPage - 1) * voucherPageSize;
    return filteredPaymentVouchers.slice(start, start + voucherPageSize);
  }, [filteredPaymentVouchers, voucherPage, voucherPageSize]);

  const openPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPayAmount(inv.balanceDue);
    setPayKasar('');
    setPayRef('');
    setPayNotes('');
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || (!payAmount && !payKasar)) return;

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      date: payDate,
      amount: Number(payAmount) || 0,
      kasarAmount: Number(payKasar) > 0 ? Number(payKasar) : undefined,
      mode: payMode,
      referenceNo: payRef || undefined,
      notes: payNotes || undefined
    };

    onAddPayment(selectedInvoice, newPayment);
    setSelectedInvoice(null);
  };

  const openEditPaymentModal = (item: { invoice: Invoice; payment: PaymentRecord }) => {
    setEditingPayment(item);
    setPayDate(item.payment.date);
    setPayAmount(item.payment.amount);
    setPayKasar(item.payment.kasarAmount || '');
    setPayMode(item.payment.mode);
    setPayRef(item.payment.referenceNo || '');
    setPayNotes(item.payment.notes || '');
  };

  const handleUpdatePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || (!payAmount && !payKasar) || !onUpdatePayment) return;

    const updatedPay: PaymentRecord = {
      ...editingPayment.payment,
      date: payDate,
      amount: Number(payAmount) || 0,
      kasarAmount: Number(payKasar) > 0 ? Number(payKasar) : undefined,
      mode: payMode,
      referenceNo: payRef || undefined,
      notes: payNotes || undefined
    };

    onUpdatePayment(editingPayment.invoice, updatedPay);
    setEditingPayment(null);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <CreditCard className="w-4 h-4 text-blue-700" />
            <span>Payments & Outstanding Receivables Tracker</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log collections, partial payment advances, bank NEFT/RTGS references, UPI transactions & cash settlements.
          </p>
        </div>

        {/* Action & Stats Summary */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {['admin', 'accountant'].includes(userRole) && (<button
            type="button"
            onClick={() => setShowDirectPaymentModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg shadow-xs hover:shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Direct Payment (Jama)</span>
          </button>)}

          <div className="bg-slate-50 p-2 rounded border border-slate-200 text-right">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Collected</span>
            <span className="font-mono font-bold text-emerald-700 text-xs">₹{formatINR(totalCollected)}</span>
          </div>

          <div className="bg-blue-50 p-2 rounded border border-blue-200 text-right">
            <span className="text-[10px] text-blue-700 uppercase font-bold block">Pending Collection</span>
            <span className="font-mono font-bold text-blue-900 text-xs">₹{formatINR(totalOutstanding)}</span>
          </div>
        </div>

      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 p-3 rounded-lg text-xs shadow-xs">
        
        {/* Status Filters & Party Filter */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto w-full lg:w-auto">
          <div className="flex items-center space-x-1">
            <span className="text-slate-500 font-bold mr-1 hidden sm:inline text-xs">Status:</span>
            {(['all', 'unpaid', 'partial', 'paid'] as const).map(status => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`px-2.5 py-1 rounded font-bold uppercase transition-all border text-[11px] cursor-pointer ${
                  filterStatus === status
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Billing Party (Consignor) Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded border border-slate-200">
            <User className="w-3.5 h-3.5 text-blue-700 ml-0.5" />
            <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">Party:</span>
            <select
              value={selectedParty}
              onChange={e => setSelectedParty(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-semibold focus:border-blue-500 focus:outline-none max-w-[180px] truncate cursor-pointer"
            >
              <option value="">All Billing Parties ({partyOptions.length})</option>
              {partyOptions.map(pName => (
                <option key={pName} value={pName}>{pName}</option>
              ))}
            </select>
            {selectedParty && (
              <button
                type="button"
                onClick={() => setSelectedParty('')}
                className="text-red-600 hover:text-red-800 p-0.5 rounded cursor-pointer"
                title="Clear Party Filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Date Filter & Presets */}
        <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
          <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-blue-700 ml-1" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-[10px] font-bold text-slate-500 uppercase">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={clearDateFilter}
                className="text-red-600 hover:text-red-800 p-0.5 rounded cursor-pointer"
                title="Clear Date Filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1 text-[10px]">
            <button
              type="button"
              onClick={setThisMonth}
              className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 font-bold rounded text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={setLastMonth}
              className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 font-bold rounded text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={setFinancialYear}
              className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 font-bold rounded text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              This FY
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={clearDateFilter}
                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded border border-red-200 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Search invoice / party / truck..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded pl-8 pr-2.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

      </div>

      {/* Invoices Payment Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                <th className="p-2.5">Invoice No</th>
                <th className="p-2.5">Billing Party (Consignor)</th>
                <th className="p-2.5">Invoice Date</th>
                <th className="p-2.5 text-right">Net Bill (₹)</th>
                <th className="p-2.5 text-right">Paid (₹)</th>
                <th className="p-2.5 text-right font-mono">Balance Due (₹)</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No matching invoice bills found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5">
                      <div className="font-mono font-bold text-blue-700">{inv.invoiceNumber}</div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-900">{inv.consignorName}</div>
                      <div className="text-[10px] text-slate-500">{inv.origin} ➔ {inv.destination} ({inv.vehicleNumber})</div>
                    </td>
                    <td className="p-2.5 font-mono text-slate-600">{inv.invoiceDate}</td>
                    <td className="p-2.5 text-right font-bold font-mono text-slate-900">
                      ₹{formatINR(inv.netPayable)}
                    </td>
                    <td className="p-2.5 text-right font-bold font-mono text-emerald-700">
                      ₹{formatINR(inv.amountPaid)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-blue-900">
                      ₹{formatINR(inv.balanceDue)}
                    </td>

                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        inv.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                        inv.paymentStatus === 'partial' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {inv.balanceDue > 0 ? (
                          ['admin', 'accountant'].includes(userRole) && <button
                            onClick={() => openPaymentModal(inv)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded text-xs transition-all shadow-xs"
                          >
                            + Record
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-bold flex items-center justify-end space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 inline" />
                            <span>Settled</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recorded Payment Vouchers Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-xs">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-2">
          <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
            <CreditCard className="w-3.5 h-3.5 text-blue-700" />
            <span>Recorded Payment Vouchers & Receipts ({filteredPaymentVouchers.length})</span>
          </h3>

          {/* Selection & Voucher Total Summary Display */}
          <div className="flex items-center space-x-2 text-xs">
            {selectedVouchersList.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1 rounded-lg shadow-2xs">
                <span className="font-bold text-[11px] text-blue-800">
                  Selected: <span className="underline">{selectedVouchersList.length}</span> Voucher{selectedVouchersList.length > 1 ? 's' : ''}
                </span>
                <span className="text-blue-300">|</span>
                <span className="font-mono font-bold text-emerald-700">
                  Amt: ₹{formatINR(selectedVouchersAmount)}
                </span>
                {selectedVouchersKasar > 0 && (
                  <>
                    <span className="text-blue-300">|</span>
                    <span className="font-mono font-bold text-purple-800">
                      Kasar: ₹{formatINR(selectedVouchersKasar)}
                    </span>
                  </>
                )}
                <span className="text-blue-300">|</span>
                <span className="font-mono font-black text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200">
                  Total: ₹{formatINR(selectedVouchersTotal)}
                </span>

                {['admin', 'accountant'].includes(userRole) && onDeletePayment && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedVouchers}
                    className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-xs transition-colors shadow-2xs cursor-pointer ml-1"
                    title="Delete Selected Vouchers"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedVouchersList.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearVoucherSelection}
                  className="text-slate-500 hover:text-red-700 font-bold ml-1 hover:bg-red-50 p-1 rounded cursor-pointer transition-colors"
                  title="Clear Selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-[11px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded">
                <span className="font-semibold text-slate-500 uppercase mr-1">Voucher Total:</span>
                <span className="font-bold text-emerald-700 mr-2">₹{formatINR(totalFilteredVouchersAmount)}</span>
                {totalFilteredVouchersKasar > 0 && (
                  <span className="font-bold text-purple-800 mr-2">(Kasar: ₹{formatINR(totalFilteredVouchersKasar)})</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
              <tr>
                <th className="p-2.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllVouchersSelected}
                    onChange={handleSelectAllVouchers}
                    title={isAllVouchersSelected ? "Deselect All Vouchers" : "Select All Vouchers"}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Invoice #</th>
                <th className="p-2.5">Party Name</th>
                <th className="p-2.5">Payment Mode</th>
                <th className="p-2.5">Reference / UTR</th>
                <th className="p-2.5 text-right font-mono">Amount (₹)</th>
                <th className="p-2.5 text-right font-mono text-purple-900">Kasar (₹)</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedVouchers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400">
                    No matching payment vouchers found for the selected period/filter.
                  </td>
                </tr>
              ) : (
                paginatedVouchers.map((item, idx) => {
                  const key = getVoucherKey(item);
                  const isSelected = selectedVoucherKeys.has(key);
                  return (
                    <tr key={key || idx} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/60' : ''}`}>
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleVoucherKey(key)}
                          className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">{item.payment.date}</td>
                      <td className="p-2.5 font-mono font-bold text-blue-700">{item.invoice.invoiceNumber}</td>
                      <td className="p-2.5 font-bold text-slate-900">{item.invoice.consignorName}</td>
                      <td className="p-2.5 uppercase font-bold text-[10px] text-slate-600">
                        {item.payment.mode.replace('_', ' ')}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600">{item.payment.referenceNo || '—'}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                        ₹{formatINR(item.payment.amount)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-purple-800">
                        {item.payment.kasarAmount ? `₹${formatINR(item.payment.kasarAmount)}` : '—'}
                      </td>

                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {['admin', 'accountant'].includes(userRole) && (<>
                          <button
                            onClick={() => openEditPaymentModal(item)}
                            title="Edit Payment Voucher"
                            className="p-1 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {onDeletePayment && (
                            <button
                              onClick={() => onDeletePayment(item.invoice, item.payment.id)}
                              title="Delete Payment Voucher"
                              className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          </>)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredPaymentVouchers.length > 0 && (
              <tfoot className="bg-slate-100 border-t border-slate-300 font-bold text-slate-800 text-[11px]">
                <tr>
                  <td colSpan={6} className="p-2.5 text-right uppercase tracking-wider text-slate-600">
                    {selectedVouchersList.length > 0 
                      ? `Selected Vouchers Total (${selectedVouchersList.length}):`
                      : `Total Vouchers Sum (${filteredPaymentVouchers.length}):`
                    }
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-emerald-700">
                    ₹{formatINR(selectedVouchersList.length > 0 ? selectedVouchersAmount : totalFilteredVouchersAmount)}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-purple-900">
                    ₹{formatINR(selectedVouchersList.length > 0 ? selectedVouchersKasar : totalFilteredVouchersKasar)}
                  </td>
                  <td className="p-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Voucher Pagination Controls */}
        {filteredPaymentVouchers.length > 25 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <span>Show</span>
              <select
                value={voucherPageSize}
                onChange={e => {
                  setVoucherPageSize(Number(e.target.value));
                  setVoucherPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-bold focus:outline-none"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={0}>Show All ({filteredPaymentVouchers.length})</option>
              </select>
              <span>of {filteredPaymentVouchers.length} vouchers</span>
            </div>

            {voucherPageSize > 0 && totalVoucherPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  disabled={voucherPage === 1}
                  onClick={() => setVoucherPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50 flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="px-2 font-bold text-slate-800">
                  Page {voucherPage} of {totalVoucherPages}
                </span>
                <button
                  disabled={voucherPage === totalVoucherPages}
                  onClick={() => setVoucherPage(p => Math.min(totalVoucherPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50 flex items-center space-x-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Edit Payment Voucher */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl space-y-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-blue-700" />
              <span>Modify Payment Voucher</span>
            </h3>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs space-y-1">
              <div className="text-slate-500">Invoice: <span className="text-blue-700 font-mono font-bold">{editingPayment.invoice.invoiceNumber}</span></div>
              <div className="text-slate-900 font-bold">{editingPayment.invoice.consignorName}</div>
            </div>

            <form onSubmit={handleUpdatePaymentSubmit} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-bold mb-0.5">Amount Received (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono font-bold text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-purple-900 font-bold mb-0.5">Kasar / Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 500"
                    value={payKasar}
                    onChange={e => setPayKasar(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-purple-50/80 border border-purple-300 rounded p-1.5 text-purple-950 font-mono font-bold text-sm focus:bg-white focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>


              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Payment Mode *</label>
                <select
                  value={payMode}
                  onChange={e => setPayMode(e.target.value as PaymentMode)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-blue-700 font-bold focus:outline-none"
                >
                  <option value="bank_neft">Bank Transfer / NEFT / RTGS</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">UTR / Reference / Cheque No</label>
                <input
                  type="text"
                  placeholder="e.g. NEFT987654321"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Updated POD clearance"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs"
                >
                  Update Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Payment */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl space-y-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-blue-700" />
              <span>Record Payment Collection</span>
            </h3>

            <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs space-y-1">
              <div className="text-slate-500">Invoice: <span className="text-blue-700 font-mono font-bold">{selectedInvoice.invoiceNumber}</span></div>
              <div className="text-slate-900 font-bold">{selectedInvoice.consignorName}</div>
              <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200">
                <span>Total Net Bill: ₹{formatINR(selectedInvoice.netPayable)}</span>
                <span className="text-blue-700 font-bold">Balance Due: ₹{formatINR(selectedInvoice.balanceDue)}</span>
              </div>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-bold mb-0.5">Amount Received (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    max={selectedInvoice.balanceDue}
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono font-bold text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-purple-900 font-bold mb-0.5">Kasar / Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 500"
                    value={payKasar}
                    onChange={e => setPayKasar(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-purple-50/80 border border-purple-300 rounded p-1.5 text-purple-950 font-mono font-bold text-sm focus:bg-white focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>


              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Payment Mode *</label>
                <select
                  value={payMode}
                  onChange={e => setPayMode(e.target.value as PaymentMode)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-blue-700 font-bold focus:outline-none"
                >
                  <option value="bank_neft">Bank Transfer / NEFT / RTGS</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">UTR / Reference / Cheque No</label>
                <input
                  type="text"
                  placeholder="e.g. NEFT987654321"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Cleared after POD receipt"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Party Payment Modal */}
      <DirectPartyPaymentModal
        isOpen={showDirectPaymentModal}
        onClose={() => setShowDirectPaymentModal(false)}
        parties={parties}
        invoices={invoices}
        onAddPayment={onAddPayment}
      />

    </div>
  );
};
