import React, { useState, useMemo } from 'react';
import { Invoice, Party, PaymentRecord, UserRole, formatINR } from '../types';
import { 
  Tag, Search, Calendar, Filter, ArrowDownLeft, FileText, Printer, Building2, 
  Wallet, CheckCircle2, TrendingDown, ArrowUpRight, ChevronRight, Eye
} from 'lucide-react';
import { DirectPartyPaymentModal } from './DirectPartyPaymentModal';

interface KasarLedgerViewProps {
  userRole: UserRole;
  parties: Party[];
  invoices: Invoice[];
  onNavigate: (tab: string) => void;
  onAddPayment: (invoice: Invoice, payment: PaymentRecord) => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export interface KasarEntry {
  id: string;
  date: string;
  partyName: string;
  partyId?: string;
  sourceType: 'bill_kasar' | 'payment_kasar';
  sourceLabel: string;
  invoiceNumber?: string;
  lrNumber?: string;
  referenceNo?: string;
  kasarAmount: number;
  billGrandTotal?: number;
  paymentAmount?: number;
  vehicleNumber?: string;
  paymentMode?: string;
  notes?: string;
  invoiceObj?: Invoice;
}

export const KasarLedgerView: React.FC<KasarLedgerViewProps> = ({
  userRole,
  parties,
  invoices,
  onNavigate,
  onAddPayment,
  onEditInvoice
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>('all');
  const [selectedSourceType, setSelectedSourceType] = useState<'all' | 'bill_kasar' | 'payment_kasar'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeViewMode, setActiveViewMode] = useState<'detailed' | 'party_summary'>('detailed');
  const [showDirectPaymentModal, setShowDirectPaymentModal] = useState(false);

  // Compile all Kasar entries across invoices (bill kasar) & payment records (payment kasar)
  const allKasarEntries = useMemo(() => {
    const entries: KasarEntry[] = [];

    invoices.forEach((inv) => {
      const partyName = inv.consignorName || 'Unknown Party';

      // 1. Check if invoice itself has Kasar Deduction (Bill Kasar)
      if (inv.kasarDeduction && inv.kasarDeduction > 0) {
        entries.push({
          id: `bill-kasar-${inv.id}`,
          date: inv.invoiceDate,
          partyName,
          partyId: inv.partyId,
          sourceType: 'bill_kasar',
          sourceLabel: 'Bill / Invoice Kasar',
          invoiceNumber: inv.invoiceNumber,
          lrNumber: inv.lrNumber,
          referenceNo: inv.invoiceNumber,
          kasarAmount: Number(inv.kasarDeduction),
          billGrandTotal: Number(inv.grandTotal),
          vehicleNumber: inv.vehicleNumber,
          notes: inv.notes ? `Bill Discount: ${inv.notes}` : 'Lump-sum discount deducted on invoice',
          invoiceObj: inv
        });
      }

      // 2. Check if any payments against this invoice have Kasar Amount (Payment Kasar)
      if (inv.payments && inv.payments.length > 0) {
        inv.payments.forEach((p) => {
          if (p.kasarAmount && p.kasarAmount > 0) {
            entries.push({
              id: `pay-kasar-${p.id || Date.now()}`,
              date: p.date,
              partyName,
              partyId: inv.partyId,
              sourceType: 'payment_kasar',
              sourceLabel: 'Payment (Jama) Kasar',
              invoiceNumber: inv.invoiceNumber,
              lrNumber: inv.lrNumber,
              referenceNo: p.referenceNo || 'Jama Receipt',
              kasarAmount: Number(p.kasarAmount),
              paymentAmount: Number(p.amount),
              paymentMode: p.mode ? p.mode.toUpperCase() : 'NEFT/CASH',
              vehicleNumber: inv.vehicleNumber,
              notes: p.notes || 'Settlement kasar concession given during payment receipt',
              invoiceObj: inv
            });
          }
        });
      }
    });

    // Sort newest to oldest
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return allKasarEntries.filter((entry) => {
      // Party filter
      if (selectedPartyFilter !== 'all') {
        const pObj = parties.find(p => p.id === selectedPartyFilter);
        const pName = pObj ? pObj.name.toLowerCase().trim() : selectedPartyFilter.toLowerCase().trim();
        if (!entry.partyName.toLowerCase().includes(pName)) {
          return false;
        }
      }

      // Source type filter
      if (selectedSourceType !== 'all' && entry.sourceType !== selectedSourceType) {
        return false;
      }

      // Date range filter
      if (startDate && entry.date < startDate) return false;
      if (endDate && entry.date > endDate) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchParty = entry.partyName.toLowerCase().includes(q);
        const matchInv = entry.invoiceNumber?.toLowerCase().includes(q);
        const matchLR = entry.lrNumber?.toLowerCase().includes(q);
        const matchRef = entry.referenceNo?.toLowerCase().includes(q);
        const matchNotes = entry.notes?.toLowerCase().includes(q);
        const matchVeh = entry.vehicleNumber?.toLowerCase().includes(q);
        if (!matchParty && !matchInv && !matchLR && !matchRef && !matchNotes && !matchVeh) {
          return false;
        }
      }

      return true;
    });
  }, [allKasarEntries, selectedPartyFilter, selectedSourceType, startDate, endDate, searchQuery, parties]);

  // Aggregate stats
  const totalKasarAmount = filteredEntries.reduce((sum, e) => sum + e.kasarAmount, 0);
  const billKasarAmount = filteredEntries.filter(e => e.sourceType === 'bill_kasar').reduce((sum, e) => sum + e.kasarAmount, 0);
  const paymentKasarAmount = filteredEntries.filter(e => e.sourceType === 'payment_kasar').reduce((sum, e) => sum + e.kasarAmount, 0);

  const uniqueBenefitedParties = useMemo(() => {
    const set = new Set(filteredEntries.map(e => e.partyName.trim().toLowerCase()));
    return set.size;
  }, [filteredEntries]);

  // Group by Party for Party Summary View
  const partyWiseSummary = useMemo(() => {
    const map = new Map<string, {
      partyName: string;
      partyId?: string;
      billKasar: number;
      paymentKasar: number;
      totalKasar: number;
      count: number;
      lastDate: string;
    }>();

    filteredEntries.forEach((e) => {
      const key = e.partyName.trim();
      const existing = map.get(key);
      if (existing) {
        if (e.sourceType === 'bill_kasar') existing.billKasar += e.kasarAmount;
        if (e.sourceType === 'payment_kasar') existing.paymentKasar += e.kasarAmount;
        existing.totalKasar += e.kasarAmount;
        existing.count += 1;
        if (e.date > existing.lastDate) existing.lastDate = e.date;
      } else {
        map.set(key, {
          partyName: e.partyName,
          partyId: e.partyId,
          billKasar: e.sourceType === 'bill_kasar' ? e.kasarAmount : 0,
          paymentKasar: e.sourceType === 'payment_kasar' ? e.kasarAmount : 0,
          totalKasar: e.kasarAmount,
          count: 1,
          lastDate: e.date
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalKasar - a.totalKasar);
  }, [filteredEntries]);

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header Banner */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20 shrink-0">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Kasar & Lump-Sum Discount Ledger
              </h1>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200 uppercase">
                Discount Register
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Comprehensive record of discounts allowed on bills and payment settlements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {['admin', 'accountant'].includes(userRole) && (
            <button
              onClick={() => setShowDirectPaymentModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>+ Record Payment</span>
            </button>
          )}

          <button
            onClick={handlePrintReport}
            className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
            title="Print or export current kasar statement"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print / Export</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Kasar */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-3.5 sm:p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-100 text-[10px] font-extrabold uppercase tracking-wider">
            <span>Total Kasar / Discount</span>
            <Tag className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono tracking-tight">
            ₹{formatINR(totalKasarAmount)}
          </div>
          <div className="text-[10px] text-amber-100 font-medium">
            Combined Bill & Payment Concessions
          </div>
        </div>

        {/* Bill Kasar */}
        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
            <span>Bill / Invoice Kasar</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-blue-900 tracking-tight">
            ₹{formatINR(billKasarAmount)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            Directly deducted on Invoices
          </div>
        </div>

        {/* Payment Kasar */}
        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
            <span>Payment Kasar</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-emerald-900 tracking-tight">
            ₹{formatINR(paymentKasarAmount)}
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            Settled during payment receipts
          </div>
        </div>

        {/* Benefited Parties */}
        <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
            <span>Parties Benefited</span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-slate-900 tracking-tight">
            {uniqueBenefitedParties} <span className="text-xs text-slate-400 font-normal">Parties</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium">
            {filteredEntries.length} total Kasar transactions
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search Party, Bill No, LR, UTR..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Party Filter */}
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <select
              value={selectedPartyFilter}
              onChange={e => setSelectedPartyFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Parties / Consignors</option>
              {parties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Source Type Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <select
              value={selectedSourceType}
              onChange={e => setSelectedSourceType(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Kasar Sources (Invoices + Payments)</option>
              <option value="bill_kasar">Bill / Invoice Kasar Only</option>
              <option value="payment_kasar">Payment Kasar Only</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center space-x-1.5">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
              title="Start Date"
            />
            <span className="text-slate-400 text-xs font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-semibold focus:bg-white focus:border-blue-500 focus:outline-none"
              title="End Date"
            />
          </div>

        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
          <div className="text-xs font-bold text-slate-500">
            Showing <strong className="text-slate-900">{filteredEntries.length}</strong> Kasar entries
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveViewMode('detailed')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeViewMode === 'detailed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Detailed Log
            </button>
            <button
              onClick={() => setActiveViewMode('party_summary')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                activeViewMode === 'party_summary'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Party-wise Summary
            </button>
          </div>
        </div>

      </div>

      {/* Main Content Table View */}
      {activeViewMode === 'detailed' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider">
                  <th className="p-3">Date</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Kasar Source</th>
                  <th className="p-3">Bill / Ref #</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3 text-right">Kasar / Discount (₹)</th>
                  <th className="p-3">Remarks / Notes</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-medium">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Tag className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs">No Kasar / Lump-Sum Discount entries found matching your criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, idx) => (
                    <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60 hover:bg-slate-100/80 transition-colors'}>
                      {/* Date */}
                      <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {entry.date}
                      </td>

                      {/* Party Name */}
                      <td className="p-3 font-bold text-slate-900">
                        <div>{entry.partyName}</div>
                      </td>

                      {/* Source Type Badge */}
                      <td className="p-3 whitespace-nowrap">
                        {entry.sourceType === 'bill_kasar' ? (
                          <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-blue-200">
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>Bill Deduction</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-emerald-200">
                            <Wallet className="w-3 h-3 text-emerald-600" />
                            <span>Payment Settlement</span>
                          </span>
                        )}
                      </td>

                      {/* Bill / Ref # */}
                      <td className="p-3 font-mono text-slate-800 whitespace-nowrap">
                        {entry.invoiceNumber && (
                          <div className="font-extrabold text-blue-900">{entry.invoiceNumber}</div>
                        )}
                        {entry.lrNumber && (
                          <div className="text-[10px] text-slate-500">LR: {entry.lrNumber}</div>
                        )}
                        {entry.sourceType === 'payment_kasar' && entry.referenceNo && (
                          <div className="text-[10px] text-emerald-700 font-bold">Ref: {entry.referenceNo} ({entry.paymentMode})</div>
                        )}
                      </td>

                      {/* Vehicle */}
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                        {entry.vehicleNumber || '—'}
                      </td>

                      {/* Kasar Amount */}
                      <td className="p-3 text-right font-mono font-black text-amber-700 text-sm whitespace-nowrap bg-amber-50/40">
                        ₹{formatINR(entry.kasarAmount)}
                      </td>

                      {/* Notes / Remarks */}
                      <td className="p-3 text-slate-600 text-xs max-w-xs truncate">
                        {entry.notes || '—'}
                      </td>

                      {/* Action */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => onNavigate('party_ledger')}
                          className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-bold rounded text-[11px] transition-colors inline-flex items-center space-x-1"
                          title="Open Party Ledger"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Ledger</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Party-wise Aggregated Summary View */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-900 text-white font-bold text-xs flex items-center justify-between">
            <span>Party-wise Total Kasar Summary</span>
            <span>{partyWiseSummary.length} Parties</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                  <th className="p-3">Party Name</th>
                  <th className="p-3 text-right">Bill Kasar (₹)</th>
                  <th className="p-3 text-right">Payment Kasar (₹)</th>
                  <th className="p-3 text-right">Total Kasar Concession (₹)</th>
                  <th className="p-3 text-center">Entries Count</th>
                  <th className="p-3 text-center">Last Kasar Date</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {partyWiseSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                      No parties found.
                    </td>
                  </tr>
                ) : (
                  partyWiseSummary.map((pSummary) => (
                    <tr key={pSummary.partyName} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">
                        {pSummary.partyName}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-blue-900">
                        {pSummary.billKasar > 0 ? `₹${formatINR(pSummary.billKasar)}` : '—'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-900">
                        {pSummary.paymentKasar > 0 ? `₹${formatINR(pSummary.paymentKasar)}` : '—'}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-amber-700 text-sm bg-amber-50/40">
                        ₹{formatINR(pSummary.totalKasar)}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-700 font-bold">
                        {pSummary.count}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {pSummary.lastDate}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onNavigate('party_ledger')}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition-colors inline-flex items-center space-x-1"
                        >
                          <span>View Ledger</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
