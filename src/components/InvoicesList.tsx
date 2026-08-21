import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceType, PaymentStatus, UserRole, formatINR, CompanySettings, Party } from '../types';
import { 
  FileText, Search, Printer, Plus, Edit, Trash2, CreditCard, Filter, Eye, CheckCircle2, X,
  Calendar, RotateCcw, Building2, MapPin, FileSpreadsheet, Upload, Download, ChevronLeft, ChevronRight
} from 'lucide-react';

import { ExcelBillingModal } from './ExcelBillingModal';
import { InvoiceRegistryStatementModal } from './InvoiceRegistryStatementModal';

interface InvoicesListProps {
  invoices: Invoice[];
  parties?: Party[];
  settings?: CompanySettings;
  onNewInvoice: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
  onEditInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (invoiceId: string) => void;
  onOpenPaymentModal: (invoice: Invoice) => void;
  onOpenPaymentOptions?: (invoice: Invoice) => void;
  onImportInvoices?: (importedInvoices: Invoice[], mode: 'add' | 'overwrite') => Promise<void>;
  userRole: UserRole;
}

export const InvoicesList: React.FC<InvoicesListProps> = ({
  invoices,
  parties = [],
  settings,
  onNewInvoice,
  onSelectInvoice,
  onEditInvoice,
  onDeleteInvoice,
  onOpenPaymentModal,
  onOpenPaymentOptions,
  onImportInvoices,
  userRole
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [partyFilter, setPartyFilter] = useState('all'); // Billing Party (Consignor)
  const [consigneeFilter, setConsigneeFilter] = useState('all'); // Consignee (Receiver)
  const [dispatchedPartyFilter, setDispatchedPartyFilter] = useState('all');
  const [ledgerPartyFilter, setLedgerPartyFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickDatePreset, setQuickDatePreset] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'tax_invoice' | 'normal_bill' | 'sales' | 'purchase'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');
  const [sortOrder, setSortOrder] = useState<'new_first' | 'old_first'>('new_first');
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const activeSettings: CompanySettings = settings || {
    companyName: 'NCBL Transport',
    tagline: 'Govt. Approved Transport Contractors & Fleet Owners',
    gstin: '24AAACG9876E1Z2',
    pan: 'AAACG9876E',
    phone: '+91 98251 23456',
    alternatePhone: '+91 98250 98765',
    email: 'billing@ncbltransport.com',
    address: 'Plot No. 12, Transport Nagar, Ring Road',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395002',
    bankName: 'HDFC Bank',
    bankAccountNo: '50200012345678',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Ring Road Branch, Surat',
    upiId: '9687709315@upi',
    termsAndConditions: []
  };

  // Include all transport invoices, sales bills, purchase bills & freight bilties in the Registry
  const transportInvoicesList = useMemo(() => {
    return invoices;
  }, [invoices]);

  // Extract unique Billing Parties (Consignors)
  const uniqueConsignors = useMemo(() => {
    const list = transportInvoicesList.map(inv => inv.consignorName?.trim()).filter(Boolean) as string[];
    const fromParties = parties
      .filter(p => p.accountCategory !== 'transporter' && p.partyType !== 'transporter')
      .map(p => p.name.trim());
    return Array.from(new Set([...list, ...fromParties])).filter(Boolean).sort();
  }, [transportInvoicesList, parties]);

  // Extract unique Consignees (Receivers)
  const uniqueConsignees = useMemo(() => {
    const list = transportInvoicesList.map(inv => inv.consigneeName?.trim()).filter(Boolean) as string[];
    const fromParties = parties
      .filter(p => p.partyType === 'consignee' || p.partyType === 'both' || p.partyType === 'shipto')
      .map(p => p.name.trim());
    return Array.from(new Set([...list, ...fromParties])).filter(Boolean).sort();
  }, [transportInvoicesList, parties]);

  // Extract unique dispatched parties (shipped from)
  const uniqueDispatchedParties = useMemo(() => {
    return Array.from(
      new Set(
        transportInvoicesList.map(inv => inv.dispatchedPartyName?.trim()).filter(Boolean) as string[]
      )
    ).sort();
  }, [transportInvoicesList]);

  // Extract only Transporter Party Ledgers for the Ledger Party filter
  const transporterParties = useMemo(() => {
    return parties.filter(p => p.accountCategory === 'transporter' || p.partyType === 'transporter');
  }, [parties]);

  const handleQuickDatePreset = (preset: string) => {
    setQuickDatePreset(preset);
    const today = new Date();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'this_month') {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
      setStartDate(`${year}-${month}-01`);
      setEndDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'last_month') {
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const year = prevMonthDate.getFullYear();
      const month = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, prevMonthDate.getMonth() + 1, 0).getDate();
      setStartDate(`${year}-${month}-01`);
      setEndDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'last_30') {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'this_quarter') {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const startMonth = currentQuarter * 3;
      const year = today.getFullYear();
      const startStr = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, startMonth + 3, 0).getDate();
      const endStr = `${year}-${String(startMonth + 3).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(startStr);
      setEndDate(endStr);
    }
  };

  const isFilterActive = 
    searchTerm !== '' || 
    partyFilter !== 'all' || 
    consigneeFilter !== 'all' ||
    dispatchedPartyFilter !== 'all' || 
    ledgerPartyFilter !== 'all' || 
    startDate !== '' || 
    endDate !== '' || 
    typeFilter !== 'all' || 
    statusFilter !== 'all';

  const handleResetFilters = () => {
    setSearchTerm('');
    setPartyFilter('all');
    setConsigneeFilter('all');
    setDispatchedPartyFilter('all');
    setLedgerPartyFilter('all');
    setStartDate('');
    setEndDate('');
    setQuickDatePreset('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const filteredInvoices = useMemo(() => {
    const list = transportInvoicesList.filter(inv => {
      if (typeFilter === 'tax_invoice' && inv.invoiceType !== 'tax_invoice') return false;
      if (typeFilter === 'normal_bill' && inv.invoiceType !== 'normal_bill') return false;
      if (typeFilter === 'sales' && !(inv.billCategory === 'sales' || inv.salesBillNumber)) return false;
      if (typeFilter === 'purchase' && !(inv.billCategory === 'purchase' || inv.purchaseBillNumber)) return false;

      if (statusFilter !== 'all' && inv.paymentStatus !== statusFilter) return false;
      
      // Billing Party (Consignor) Filter
      if (partyFilter && partyFilter !== 'all') {
        const pTerm = partyFilter.toLowerCase();
        const matchParty = inv.consignorName && inv.consignorName.toLowerCase().includes(pTerm);
        if (!matchParty) return false;
      }

      // Consignee (Receiver) Filter
      if (consigneeFilter && consigneeFilter !== 'all') {
        const ceTerm = consigneeFilter.toLowerCase();
        const matchConsignee = inv.consigneeName && inv.consigneeName.toLowerCase().includes(ceTerm);
        if (!matchConsignee) return false;
      }

      if (dispatchedPartyFilter && dispatchedPartyFilter !== 'all') {
        const dpTerm = dispatchedPartyFilter.toLowerCase();
        if (!inv.dispatchedPartyName || !inv.dispatchedPartyName.toLowerCase().includes(dpTerm)) {
          return false;
        }
      }
      
      if (ledgerPartyFilter && ledgerPartyFilter !== 'all') {
        const matchedTransporter = transporterParties.find(p => p.id === ledgerPartyFilter);
        const transNameLower = matchedTransporter?.name?.toLowerCase().trim();
        const matchesTransporter = 
          inv.partyId === ledgerPartyFilter ||
          (transNameLower && inv.consignorName && inv.consignorName.toLowerCase().trim() === transNameLower) ||
          (transNameLower && inv.consigneeName && inv.consigneeName.toLowerCase().trim() === transNameLower) ||
          (transNameLower && inv.dispatchedPartyName && inv.dispatchedPartyName.toLowerCase().trim() === transNameLower);
        if (!matchesTransporter) return false;
      }

      const invDate = inv.invoiceDate || inv.salesBillDate || inv.purchaseDate || inv.lrDate || '';
      if (startDate && invDate && invDate < startDate) return false;
      if (endDate && invDate && invDate > endDate) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(term)) ||
          (inv.salesBillNumber && inv.salesBillNumber.toLowerCase().includes(term)) ||
          (inv.purchaseBillNumber && inv.purchaseBillNumber.toLowerCase().includes(term)) ||
          (inv.lrNumber && inv.lrNumber.toLowerCase().includes(term)) ||
          (inv.consignorName && inv.consignorName.toLowerCase().includes(term)) ||
          (inv.consigneeName && inv.consigneeName.toLowerCase().includes(term)) ||
          (inv.dispatchedPartyName && inv.dispatchedPartyName.toLowerCase().includes(term)) ||
          (inv.vehicleNumber && inv.vehicleNumber.toLowerCase().includes(term)) ||
          (inv.origin && inv.origin.toLowerCase().includes(term)) ||
          (inv.destination && inv.destination.toLowerCase().includes(term)) ||
          (inv.materialType && inv.materialType.toLowerCase().includes(term)) ||
          inv.items?.some(it => 
            (it.description && it.description.toLowerCase().includes(term)) ||
            (it.unit && it.unit.toLowerCase().includes(term)) ||
            (it.weightTons && String(it.weightTons).includes(term)) ||
            (it.ratePerTon && String(it.ratePerTon).includes(term))
          )
        );
      }
      return true;
    });

    list.sort((a, b) => {
      const dateA = new Date(a.invoiceDate || a.salesBillDate || a.purchaseDate || a.lrDate || 0).getTime();
      const dateB = new Date(b.invoiceDate || b.salesBillDate || b.purchaseDate || b.lrDate || 0).getTime();
      if (sortOrder === 'new_first') {
        return dateB - dateA;
      } else {
        return dateA - dateB;
      }
    });

    return list;
  }, [transportInvoicesList, typeFilter, statusFilter, partyFilter, consigneeFilter, dispatchedPartyFilter, ledgerPartyFilter, startDate, endDate, searchTerm, sortOrder, transporterParties]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const paginatedInvoices = useMemo(() => {
    if (pageSize === 0) return filteredInvoices;
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold tracking-tight flex items-center space-x-2 text-slate-900">
            <FileText className="w-5 h-5 text-blue-700" />
            <span>Transport Invoices & Bills Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage tax invoices, non-tax freight bills, LR bilty numbers, payment clearances & printable PDF formats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print / PDF Statement Report */}
          <button
            onClick={() => setShowStatementModal(true)}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Print or export multi-bill registry statement PDF"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>PRINT / PDF STATEMENT</span>
          </button>

          <button
            onClick={() => setShowExcelModal(true)}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            title="Import or Export billing data via Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>EXCEL IMPORT / EXPORT</span>
          </button>

          {['admin', 'accountant'].includes(userRole) && (
            <button
              onClick={onNewInvoice}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE NEW INVOICE</span>
            </button>
          )}
        </div>
      </div>

      {/* Comprehensive Search & Filter Bar */}
      <div className="bg-white border border-slate-200 p-3.5 rounded-lg text-xs space-y-3 shadow-xs">
        
        {/* Search Row: Keyword Search + Party Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Keyword Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-blue-700 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Invoice #, Party, Dispatched, Vehicle #..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-lg pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
                title="Clear search term"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Billing Party (Consignor) Dropdown Filter */}
          <div className="relative">
            <Building2 className="w-4 h-4 text-blue-700 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={partyFilter}
              onChange={e => setPartyFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
            >
              <option value="all">All Billing Parties / Consignors ({uniqueConsignors.length})</option>
              {uniqueConsignors.map(party => (
                <option key={party} value={party}>
                  {party}
                </option>
              ))}
            </select>
          </div>

          {/* Dispatched Party (Shipped From) Filter */}
          <div className="relative">
            <MapPin className="w-4 h-4 text-amber-600 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={dispatchedPartyFilter}
              onChange={e => setDispatchedPartyFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
            >
              <option value="all">All Dispatched Parties ({uniqueDispatchedParties.length})</option>
              {uniqueDispatchedParties.map(dp => (
                <option key={dp} value={dp}>
                  {dp}
                </option>
              ))}
            </select>
          </div>

          {/* Transporter Party Ledger Filter (SHOW ONLY Transporter Party Ledgers) */}
          <div className="relative">
            <Building2 className="w-4 h-4 text-blue-700 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={ledgerPartyFilter}
              onChange={e => setLedgerPartyFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
            >
              <option value="all">All Transporter Ledgers ({transporterParties.length})</option>
              {transporterParties.map(party => (
                <option key={party.id} value={party.id}>
                  {party.name} {party.city ? `(${party.city})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range & Quick Presets Row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 flex items-center space-x-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-blue-700" />
              <span>Date:</span>
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'last_30', label: 'Last 30 Days' },
              { id: 'this_quarter', label: 'This Quarter' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => handleQuickDatePreset(preset.id)}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                  quickDatePreset === preset.id && (!startDate && !endDate || preset.id !== 'all')
                    ? 'bg-blue-100 text-blue-800 border border-blue-300 font-bold'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Specific Date Range Inputs */}
          <div className="flex items-center space-x-2 w-full lg:w-auto">
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 px-2 py-1 rounded-md">
              <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setQuickDatePreset('custom');
                }}
                className="bg-transparent text-xs text-slate-800 font-mono font-medium focus:outline-none"
              />
            </div>
            <span className="text-slate-400 font-bold">➔</span>
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 px-2 py-1 rounded-md">
              <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setQuickDatePreset('custom');
                }}
                className="bg-transparent text-xs text-slate-800 font-mono font-medium focus:outline-none"
              />
            </div>
          </div>

        </div>

        {/* Category, Status Filters & Clear Action Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-slate-100">
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Type Filter */}
            <div className="flex flex-wrap items-center space-x-1 bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                  typeFilter === 'all' ? 'bg-blue-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setTypeFilter('tax_invoice')}
                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                  typeFilter === 'tax_invoice' ? 'bg-blue-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tax Invoices
              </button>
              <button
                onClick={() => setTypeFilter('normal_bill')}
                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                  typeFilter === 'normal_bill' ? 'bg-blue-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Normal Bills
              </button>
              <button
                onClick={() => setTypeFilter('sales')}
                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                  typeFilter === 'sales' ? 'bg-blue-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sales Bills
              </button>
              <button
                onClick={() => setTypeFilter('purchase')}
                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                  typeFilter === 'purchase' ? 'bg-blue-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Purchase Bills
              </button>
            </div>

            {/* Sort Order */}
            <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                onClick={() => setSortOrder('new_first')}
                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                  sortOrder === 'new_first' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                New First
              </button>
              <button
                onClick={() => setSortOrder('old_first')}
                className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                  sortOrder === 'old_first' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Old First
              </button>
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded border border-slate-200">
              {(['all', 'paid', 'unpaid', 'partial'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                    statusFilter === st ? 'bg-slate-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Reset / Clear All Filters button */}
            {isFilterActive && (
              <button
                onClick={handleResetFilters}
                className="flex items-center space-x-1 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded border border-rose-200 transition-all"
                title="Reset all search filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Results Counter Badge */}
          <div className="text-[11px] font-mono text-slate-500 font-semibold flex items-center space-x-1">
            <span>Showing</span>
            <span className="text-blue-700 font-bold px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded">
              {filteredInvoices.length}
            </span>
            <span>of {invoices.length} invoices</span>
          </div>

        </div>

      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="p-2.5">Invoice No</th>
                <th className="p-2.5">Billing Party (Consignor)</th>
                <th className="p-2.5">Route & Truck</th>
                <th className="p-2.5">Qty / Weight</th>
                <th className="p-2.5 text-right">Rate (₹)</th>
                <th className="p-2.5">Tax Slab & Type</th>
                <th className="p-2.5 text-right">Subtotal</th>
                <th className="p-2.5 text-right">TDS (₹)</th>
                <th className="p-2.5 text-right">Net Bill (₹)</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-800">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-sans">
                    No matching transport invoices found.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-blue-50/50 transition-colors">
                    
                    <td className="p-2.5">
                      <div className="font-bold text-blue-700">{inv.invoiceNumber || inv.salesBillNumber || inv.purchaseBillNumber || inv.lrNumber || 'BILL'}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{inv.invoiceDate || inv.salesBillDate || inv.purchaseDate || inv.lrDate}</div>
                      {inv.salesBillNumber && (
                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5" title={`Sales Bill Date: ${inv.salesBillDate || 'N/A'}`}>
                          SB: {inv.salesBillNumber}
                        </div>
                      )}
                      {inv.purchaseBillNumber && (
                        <div className="text-[10px] text-purple-700 font-semibold mt-0.5" title={`Purchase Date: ${inv.purchaseDate || 'N/A'}`}>
                          PB: {inv.purchaseBillNumber}
                        </div>
                      )}
                    </td>

                    <td className="p-2.5 font-sans">
                      <div className="font-bold text-slate-800">{inv.consignorName || inv.consigneeName || 'Cash / Party'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">GSTIN: {inv.consignorGSTIN || inv.consigneeGSTIN || 'URP'}</div>
                      {inv.dispatchedPartyName && (
                        <div className="text-[10px] text-amber-800 font-medium truncate max-w-[180px]">
                          Dispatch: {inv.dispatchedPartyName}
                        </div>
                      )}
                    </td>

                    <td className="p-2.5 font-sans">
                      <div className="font-semibold text-slate-800">
                        {inv.origin && inv.destination ? `${inv.origin} ➔ ${inv.destination}` : (inv.materialType || 'Goods / Freight')}
                      </div>
                      <div className="text-[10px] text-blue-700 font-mono font-bold">{inv.vehicleNumber || '—'}</div>
                    </td>

                    <td className="p-2.5 font-sans">
                      {inv.items && inv.items.length > 0 ? (
                        inv.items.map((item, idx) => {
                          const unit = (item.unit || 'Tons').trim();
                          const qtyVal = item.quantity > 0 ? item.quantity : (item.weightTons && item.weightTons > 0 ? item.weightTons : 0);
                          let qtyText = '';

                          if (unit.toLowerCase() === 'fixed') {
                            qtyText = 'Fixed Rate';
                          } else if (qtyVal > 0) {
                            qtyText = `${qtyVal} ${unit}`;
                          } else if (item.packagesCount && item.packagesCount > 0) {
                            qtyText = `${item.packagesCount} Pkgs`;
                          } else {
                            qtyText = '—';
                          }

                          return (
                            <div key={item.id || idx}>
                              <div className="font-bold text-slate-900 font-mono text-[11px] whitespace-nowrap">
                                {qtyText}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="p-2.5 text-right font-sans">
                      {inv.items && inv.items.length > 0 ? (
                        inv.items.map((item, idx) => {
                          const rateVal = item.ratePerTon && item.ratePerTon > 0
                            ? item.ratePerTon
                            : (item.quantity > 0 && item.amount > 0 ? item.amount / item.quantity : 0);
                          
                          const unitLabel = item.unit ? `/${item.unit}` : '/Ton';

                          return (
                            <div key={item.id || idx}>
                              {rateVal > 0 ? (
                                <div className="font-bold text-slate-900 font-mono text-[11px]">
                                  ₹{formatINR(rateVal)}
                                  <span className="text-[10px] text-slate-500 font-normal">{unitLabel}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="p-2.5 font-sans">
                      {inv.invoiceType === 'tax_invoice' ? (
                        <div className="space-y-0.5">
                          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase inline-block">
                            {inv.taxSlab}% GST
                          </span>
                          <div className="text-[10px] text-slate-500 uppercase font-bold">
                            {inv.taxMechanism === 'rcm' ? 'RCM (Reverse Charge)' : 'Forward Charge'}
                          </div>
                        </div>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                          Normal Bill (No Tax)
                        </span>
                      )}
                    </td>

                    <td className="p-2.5 text-right text-slate-600">
                      ₹{formatINR(inv.subTotal ?? (inv.grandTotal || inv.grossFreight || 0))}
                    </td>
                    <td className="p-2.5 text-right text-red-600">
                      {inv.tdsAmount ? `-₹${formatINR(inv.tdsAmount)}` : '—'}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-900 text-xs">
                      ₹{formatINR(inv.netPayable !== undefined ? inv.netPayable : (inv.grandTotal ?? inv.subTotal ?? 0))}
                    </td>


                    <td className="p-2.5 text-center font-sans font-bold">
                      {inv.paymentStatus === 'paid' && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">PAID</span>}
                      {inv.paymentStatus === 'partial' && <span className="text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">PARTIAL</span>}
                      {inv.paymentStatus === 'unpaid' && <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">UNPAID</span>}
                    </td>

                    <td className="p-2.5 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1">
                        
                        {/* Print PDF modal trigger */}
                        <button
                          onClick={() => onSelectInvoice(inv)}
                          className="p-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 rounded border border-slate-200 transition-all"
                          title="View / Print Official Invoice PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* Record Payment trigger */}
                        {inv.balanceDue > 0 && ['admin', 'accountant'].includes(userRole) && (
                          <button
                            onClick={() => onOpenPaymentModal(inv)}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-200 transition-all"
                            title="Record Payment"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit */}
                        {['admin', 'accountant'].includes(userRole) && (
                          <button
                            onClick={() => onEditInvoice(inv)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition-all"
                            title="Edit Invoice"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete (Admin only) */}
                        {userRole === 'admin' && (
                          <button
                            onClick={() => onDeleteInvoice(inv.id)}
                            className="p-1 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded border border-slate-200 transition-all"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Bar */}
        {filteredInvoices.length > 25 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-bold focus:outline-none"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={0}>Show All ({filteredInvoices.length})</option>
              </select>
              <span>of {filteredInvoices.length} invoices</span>
            </div>

            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-white flex items-center space-x-1 font-medium text-slate-700"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="px-2 font-bold text-slate-800">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-white flex items-center space-x-1 font-medium text-slate-700"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Excel Import / Export Modal */}
      <ExcelBillingModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        filteredInvoices={filteredInvoices}
        allInvoices={invoices}
        onImportInvoices={async (importedInvoices, mode) => {
          if (onImportInvoices) {
            await onImportInvoices(importedInvoices, mode);
          }
        }}
      />

      {/* Transport Invoices & Bills Statement Print / PDF Modal */}
      {showStatementModal && (
        <InvoiceRegistryStatementModal
          invoices={invoices}
          parties={parties}
          settings={activeSettings}
          initialStartDate={startDate}
          initialEndDate={endDate}
          initialPartyFilter={partyFilter}
          initialConsignorFilter={partyFilter}
          initialConsigneeFilter={consigneeFilter}
          initialDispatchedFilter={dispatchedPartyFilter}
          initialTypeFilter={typeFilter}
          initialStatusFilter={statusFilter}
          initialSearchTerm={searchTerm}
          onClose={() => setShowStatementModal(false)}
        />
      )}

    </div>
  );
};
