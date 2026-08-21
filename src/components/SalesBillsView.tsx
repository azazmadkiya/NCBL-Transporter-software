import React, { useState, useMemo } from 'react';
import { Invoice, Party, ProductItem, CompanySettings, formatINR } from '../types';
import { 
  Receipt, Plus, Search, Filter, Printer, Download, Eye, 
  Edit, Trash2, CreditCard, ArrowUpRight, ArrowDownLeft, CheckCircle2, AlertCircle, 
  FileSpreadsheet, Boxes, Layers, RefreshCw, Calendar, X, Tag, Truck, Building2
} from 'lucide-react';
import { SalesBillPrintModal } from './SalesBillPrintModal';
import { PurchaseBillPrintModal } from './PurchaseBillPrintModal';
import { InvoicePrintModal } from './InvoicePrintModal';
import { PartyTaxBillModal } from './PartyTaxBillModal';

interface SalesBillsViewProps {
  invoices: Invoice[];
  parties: Party[];
  settings: CompanySettings;
  userRole?: string;
  onNewSalesBill: () => void;
  onNewPurchaseBill: () => void;
  onNewLiftingBill?: () => void;
  onEditSalesBill: (bill: Invoice) => void;
  onEditPurchaseBill: (bill: Invoice) => void;
  onEditLiftingBill?: (bill: Invoice) => void;
  onDeleteBill: (billId: string) => Promise<void>;
  onOpenPaymentModal: (bill: Invoice) => void;
  onSaveInvoice?: (invoice: Invoice) => void;
}

export const SalesBillsView: React.FC<SalesBillsViewProps> = ({
  invoices,
  parties,
  settings,
  userRole = 'admin',
  onNewSalesBill,
  onNewPurchaseBill,
  onNewLiftingBill,
  onEditSalesBill,
  onEditPurchaseBill,
  onEditLiftingBill,
  onDeleteBill,
  onOpenPaymentModal,
  onSaveInvoice
}) => {
  const [billTypeFilter, setBillTypeFilter] = useState<'all' | 'sales' | 'purchase' | 'lifting'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [quickDatePreset, setQuickDatePreset] = useState('all');
  
  // Print & Modal states
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<Invoice | null>(null);
  const [showTaxBillModal, setShowTaxBillModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Strictly isolate Commercial Sales, Purchases & Lifting Bills
  // Transport LR freight invoices / Bilties MUST NEVER appear in this section
  const allCommercialBills = useMemo(() => {
    return invoices.filter(inv => {
      // Strictly exclude any Transport / LR / Freight bilties
      if (inv.billCategory === 'freight' || (!inv.billCategory && !inv.salesBillNumber && !inv.purchaseBillNumber)) return false;

      // 1. Explicit Sales Bills
      if (inv.billCategory === 'sales' || (inv.salesBillNumber && inv.billCategory !== 'purchase')) return true;

      // 2. Explicit Purchase Bills
      if (inv.billCategory === 'purchase' || inv.purchaseBillNumber) return true;

      // 3. Explicit Income or Expense Commercial Tax Bills
      if (inv.billCategory === 'income' || inv.billCategory === 'expense') return true;

      return false;
    });
  }, [invoices]);

  // Helper to determine specific category tag of a bill
  const getBillCategoryType = (b: Invoice): 'sales' | 'purchase' | 'lifting' => {
    if (b.billCategory === 'purchase' || b.purchaseBillNumber) return 'purchase';
    if (b.billCategory === 'sales' || b.salesBillNumber) return 'sales';
    return 'lifting';
  };

  // Filtered by Category Tab
  const billsByType = useMemo(() => {
    if (billTypeFilter === 'sales') {
      return allCommercialBills.filter(b => getBillCategoryType(b) === 'sales');
    }
    if (billTypeFilter === 'purchase') {
      return allCommercialBills.filter(b => getBillCategoryType(b) === 'purchase');
    }
    if (billTypeFilter === 'lifting') {
      return allCommercialBills.filter(b => getBillCategoryType(b) === 'lifting');
    }
    return allCommercialBills;
  }, [allCommercialBills, billTypeFilter]);

  // Unique Commercial & Lifting Parties present in bills
  const billParties = useMemo(() => {
    const set = new Set<string>();
    billsByType.forEach(b => {
      const name = b.consignorName || b.consigneeName;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [billsByType]);

  // Date Presets Handler
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

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return billsByType.filter(bill => {
      const billNo = bill.purchaseBillNumber || bill.salesBillNumber || bill.supplierInvoiceNumber || bill.invoiceNumber || '';
      const party = bill.consignorName || bill.consigneeName || '';
      const gstin = bill.consignorGSTIN || bill.consigneeGSTIN || '';
      const vehicle = bill.vehicleNumber || '';
      const itemsStr = bill.items ? bill.items.map(i => i.description || '').join(' ') : '';
      const bDate = bill.purchaseDate || bill.salesBillDate || bill.invoiceDate || '';

      const matchesSearch = 
        billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        party.toLowerCase().includes(searchTerm.toLowerCase()) ||
        gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        itemsStr.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || bill.paymentStatus === statusFilter;
      const matchesParty = selectedPartyFilter === 'all' || party === selectedPartyFilter;

      if (startDate && bDate < startDate) return false;
      if (endDate && bDate > endDate) return false;

      return matchesSearch && matchesStatus && matchesParty;
    });
  }, [billsByType, searchTerm, statusFilter, selectedPartyFilter, startDate, endDate]);

  // Comprehensive Statistics
  const stats = useMemo(() => {
    let salesTotal = 0;
    let salesGST = 0;
    let salesPaid = 0;
    let salesBalance = 0;
    let salesCount = 0;

    let purchaseTotal = 0;
    let purchaseGST = 0;
    let purchasePaid = 0;
    let purchaseBalance = 0;
    let purchaseCount = 0;

    let liftingTotal = 0;
    let liftingGST = 0;
    let liftingPaid = 0;
    let liftingBalance = 0;
    let liftingCount = 0;

    allCommercialBills.forEach(b => {
      const category = getBillCategoryType(b);
      const grand = Number(b.grandTotal) || 0;
      const tax = Number(b.totalTax) || 0;
      const paid = Number(b.amountPaid) || 0;
      const bal = Number(b.balanceDue) || 0;

      if (category === 'purchase') {
        purchaseCount++;
        purchaseTotal += grand;
        purchaseGST += tax;
        purchasePaid += paid;
        purchaseBalance += bal;
      } else if (category === 'sales') {
        salesCount++;
        salesTotal += grand;
        salesGST += tax;
        salesPaid += paid;
        salesBalance += bal;
      } else {
        liftingCount++;
        liftingTotal += grand;
        liftingGST += tax;
        liftingPaid += paid;
        liftingBalance += bal;
      }
    });

    const netGSTLiability = salesGST - purchaseGST;

    return {
      salesCount,
      salesTotal,
      salesGST,
      salesPaid,
      salesBalance,

      purchaseCount,
      purchaseTotal,
      purchaseGST,
      purchasePaid,
      purchaseBalance,

      liftingCount,
      liftingTotal,
      liftingGST,
      liftingPaid,
      liftingBalance,

      netGSTLiability,
      totalCommercialCount: salesCount + purchaseCount + liftingCount,
      totalCommercialTurnover: salesTotal + purchaseTotal + liftingTotal
    };
  }, [allCommercialBills]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredBills.length === 0) {
      alert('No bills to export.');
      return;
    }

    const headers = [
      'Category', 'Bill Number', 'Supplier/Ref No', 'Date', 'Party Name', 'GSTIN', 'Taxable Amount (₹)', 
      'GST Tax (₹)', 'Grand Total (₹)', 'Paid Amount (₹)', 'Balance Due (₹)', 'Status'
    ];

    const rows = filteredBills.map(b => {
      const cat = getBillCategoryType(b).toUpperCase();
      const billNo = b.purchaseBillNumber || b.salesBillNumber || b.invoiceNumber;
      const date = b.purchaseDate || b.salesBillDate || b.invoiceDate;
      return [
        `"${cat}"`,
        `"${billNo}"`,
        `"${b.supplierInvoiceNumber || b.lrNumber || ''}"`,
        `"${date}"`,
        `"${b.consignorName || b.consigneeName}"`,
        `"${b.consignorGSTIN || b.consigneeGSTIN || 'URP'}"`,
        b.subTotal || 0,
        b.totalTax || 0,
        b.grandTotal || 0,
        b.amountPaid || 0,
        b.balanceDue || 0,
        b.paymentStatus || 'unpaid'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Party_Ledgers_Sales_Purchase_Lifting_Bills_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedPartyFilter('all');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setQuickDatePreset('all');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Party Ledgers SALES / PURCHASE / LIFTING Invoices & Bills Registry</span>
              <span className="text-[11px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-bold">
                Commercial Registry
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dedicated commercial registry for all Sales Invoices, Purchase Bills (ITC), and Lifting / Material Dispatches. Separate from Transport LR Invoices.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-semibold border border-slate-300 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {['admin', 'accountant'].includes(userRole) && (
            <>
              {/* Lifting / Tax Bill */}
              <button
                onClick={() => {
                  if (onNewLiftingBill) {
                    onNewLiftingBill();
                  } else {
                    setShowTaxBillModal(true);
                  }
                }}
                className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Lifting Bill</span>
              </button>

              {/* Inward Purchase Tax Bill */}
              <button
                onClick={onNewPurchaseBill}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow-xs transition-colors"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>+ New Purchase Bill</span>
              </button>

              {/* Outward Sales Tax Bill */}
              <button
                onClick={onNewSalesBill}
                className="flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Sales Bill</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bill Type Selector Tabs */}
      <div className="bg-white border border-slate-200 p-1.5 rounded-lg shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setBillTypeFilter('all')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
              billTypeFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Bills ({allCommercialBills.length})
          </button>
          
          <button
            onClick={() => setBillTypeFilter('sales')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center space-x-1.5 ${
              billTypeFilter === 'sales'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Sales Bills (Outward: {stats.salesCount})</span>
          </button>

          <button
            onClick={() => setBillTypeFilter('purchase')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center space-x-1.5 ${
              billTypeFilter === 'purchase'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Purchase Bills (Inward / ITC: {stats.purchaseCount})</span>
          </button>

          <button
            onClick={() => setBillTypeFilter('lifting')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center space-x-1.5 ${
              billTypeFilter === 'lifting'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Lifting & Material Bills ({stats.liftingCount})</span>
          </button>
        </div>

        {/* GST Net Position Badge */}
        <div className="flex items-center space-x-3 text-xs pr-2 font-mono">
          <span className="text-slate-500">GST Net Position:</span>
          <span className={`font-bold px-2 py-0.5 rounded text-xs ${
            stats.netGSTLiability >= 0 
              ? 'bg-blue-50 text-blue-800 border border-blue-200' 
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}>
            {stats.netGSTLiability >= 0 ? `Net GST Payable: ₹${formatINR(stats.netGSTLiability)}` : `Net ITC Refundable: ₹${formatINR(Math.abs(stats.netGSTLiability))}`}
          </span>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Sales Turnover */}
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Sales Turnover (Outward)
          </div>
          <div className="text-lg font-black text-blue-700 mt-1">
            ₹{formatINR(stats.salesTotal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            {stats.salesCount} Sales Invoices | Tax: ₹{formatINR(stats.salesGST)}
          </div>
        </div>

        {/* Card 2: Purchases */}
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Inward Purchases (ITC)
          </div>
          <div className="text-lg font-black text-emerald-700 mt-1">
            ₹{formatINR(stats.purchaseTotal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            {stats.purchaseCount} Vendor Invoices | ITC: ₹{formatINR(stats.purchaseGST)}
          </div>
        </div>

        {/* Card 3: Lifting Value */}
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Lifting & Material Bills
          </div>
          <div className="text-lg font-black text-amber-700 mt-1">
            ₹{formatINR(stats.liftingTotal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            {stats.liftingCount} Lifting Dispatches
          </div>
        </div>

        {/* Card 4: Balance Due */}
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Outstanding Balance Due
          </div>
          <div className="text-lg font-black text-rose-700 mt-1">
            ₹{formatINR(stats.salesBalance + stats.purchaseBalance + stats.liftingBalance)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
            Customer Receivable + Vendor Payable
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        
        {/* Filters Bar */}
        <div className="p-3 bg-slate-50/70 border-b border-slate-200 space-y-2.5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full md:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Bill #, Supplier, Customer, GSTIN, Vehicle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Party Filter */}
              <select
                value={selectedPartyFilter}
                onChange={(e) => setSelectedPartyFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-medium"
              >
                <option value="all">All Parties & Suppliers ({billParties.length})</option>
                {billParties.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              {/* Payment Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-medium"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>

              {(searchTerm || statusFilter !== 'all' || selectedPartyFilter !== 'all' || startDate || endDate) && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2 py-1 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Date Presets Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 text-[11px] font-semibold">Date Preset:</span>
              {['all', 'this_month', 'last_month', 'last_30', 'this_quarter'].map(preset => (
                <button
                  key={preset}
                  onClick={() => handleQuickDatePreset(preset)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                    quickDatePreset === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {preset === 'all' && 'All Dates'}
                  {preset === 'this_month' && 'This Month'}
                  {preset === 'last_month' && 'Last Month'}
                  {preset === 'last_30' && 'Last 30 Days'}
                  {preset === 'this_quarter' && 'This Quarter'}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <span className="text-[11px] text-slate-400">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    setQuickDatePreset('custom');
                  }}
                  className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] text-slate-700"
                />
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-[11px] text-slate-400">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setQuickDatePreset('custom');
                  }}
                  className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-[11px] text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bills Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3 w-24 text-center">Category</th>
                <th className="p-3">Bill No & Date</th>
                <th className="p-3">Party / Supplier & GSTIN</th>
                <th className="p-3">Particulars / Vehicle</th>
                <th className="p-3 text-right">Taxable (₹)</th>
                <th className="p-3 text-right">GST Tax (₹)</th>
                <th className="p-3 text-right">Grand Total (₹)</th>
                <th className="p-3 text-right">Paid (₹)</th>
                <th className="p-3 text-right">Balance Due (₹)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No Commercial or Lifting bills found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Create sales bills, purchase bills or lifting dispatches to manage commercial accounting.
                    </p>
                    {['admin', 'accountant'].includes(userRole) && (
                      <div className="mt-3 flex items-center justify-center space-x-2">
                        <button
                          onClick={onNewSalesBill}
                          className="inline-flex items-center space-x-1.5 bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-800"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Sales Bill</span>
                        </button>
                        <button
                          onClick={onNewPurchaseBill}
                          className="inline-flex items-center space-x-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-emerald-700"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>New Purchase Bill</span>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill, idx) => {
                  const catType = getBillCategoryType(bill);
                  const isPaid = bill.paymentStatus === 'paid' || bill.balanceDue === 0;
                  const isPartial = bill.paymentStatus === 'partial' || (!isPaid && (bill.amountPaid || 0) > 0);
                  const isUnpaid = !isPaid && !isPartial;

                  const billNo = bill.purchaseBillNumber || bill.salesBillNumber || bill.supplierInvoiceNumber || bill.invoiceNumber;
                  const billDate = bill.purchaseDate || bill.salesBillDate || bill.invoiceDate;

                  return (
                    <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Bill Category Badge */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          catType === 'purchase'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : catType === 'sales'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {catType === 'purchase' && (
                            <>
                              <ArrowDownLeft className="w-3 h-3" />
                              <span>Purchase</span>
                            </>
                          )}
                          {catType === 'sales' && (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              <span>Sales</span>
                            </>
                          )}
                          {catType === 'lifting' && (
                            <>
                              <Boxes className="w-3 h-3" />
                              <span>Lifting</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Bill No & Date */}
                      <td className="p-3">
                        <div className={`font-bold font-mono text-xs ${
                          catType === 'purchase' ? 'text-emerald-800' : catType === 'sales' ? 'text-blue-700' : 'text-amber-800'
                        }`}>
                          {billNo}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {billDate}
                          {catType === 'purchase' && bill.supplierInvoiceNumber && bill.supplierInvoiceNumber !== billNo && (
                            <span className="ml-1 text-slate-400 font-mono">({bill.supplierInvoiceNumber})</span>
                          )}
                        </div>
                      </td>

                      {/* Party & GSTIN */}
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {bill.consignorName || bill.consigneeName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          GSTIN: {bill.consignorGSTIN || bill.consigneeGSTIN || 'URP'}
                        </div>
                      </td>

                      {/* Particulars / Items / Vehicle */}
                      <td className="p-3">
                        <div className="text-slate-800 font-medium truncate max-w-[180px]">
                          {bill.items && bill.items.length > 0 
                            ? bill.items.map(i => i.description).filter(Boolean).join(', ') 
                            : (bill.materialType || 'General Goods')}
                        </div>
                        {bill.vehicleNumber && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Truck className="w-3 h-3 text-slate-400" />
                            <span>{bill.vehicleNumber}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono font-semibold text-slate-700">
                        ₹{formatINR(bill.subTotal)}
                      </td>

                      <td className={`p-3 text-right font-mono font-bold ${
                        catType === 'purchase' ? 'text-emerald-700' : catType === 'sales' ? 'text-blue-700' : 'text-amber-700'
                      }`}>
                        ₹{formatINR(bill.totalTax)}
                      </td>

                      <td className="p-3 text-right font-mono font-black text-slate-900">
                        ₹{formatINR(bill.grandTotal)}
                      </td>

                      <td className="p-3 text-right font-mono text-emerald-700 font-bold">
                        ₹{formatINR(bill.amountPaid)}
                      </td>

                      <td className="p-3 text-right font-mono font-black">
                        <span className={bill.balanceDue > 0 ? 'text-rose-600' : 'text-slate-400'}>
                          ₹{formatINR(bill.balanceDue)}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isPaid 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : isPartial 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {bill.paymentStatus || 'unpaid'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setSelectedBillForPrint(bill)}
                            className="p-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title="Print / View Bill"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {['admin', 'accountant'].includes(userRole) && (
                            <>
                              <button
                                onClick={() => onOpenPaymentModal(bill)}
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                                title="Record / Manage Payment"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  if (catType === 'purchase') {
                                    onEditPurchaseBill(bill);
                                  } else if (catType === 'sales') {
                                    onEditSalesBill(bill);
                                  } else {
                                    if (onEditLiftingBill) {
                                      onEditLiftingBill(bill);
                                    } else {
                                      onEditSalesBill(bill);
                                    }
                                  }
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                title="Edit Bill"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete Bill "${billNo}"?`)) {
                                    onDeleteBill(bill.id);
                                  }
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                                title="Delete Bill"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        {filteredBills.length > 0 && (
          <div className="p-3 bg-slate-50/70 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              Showing <strong>{filteredBills.length}</strong> of <strong>{billsByType.length}</strong> {billTypeFilter === 'all' ? 'commercial/lifting' : billTypeFilter} bills
            </div>
            <div className="font-mono text-slate-700">
              Sales: <strong className="text-blue-700">₹{formatINR(stats.salesTotal)}</strong> | Purchases: <strong className="text-emerald-800">₹{formatINR(stats.purchaseTotal)}</strong> | Lifting: <strong className="text-amber-800">₹{formatINR(stats.liftingTotal)}</strong> | Net GST: <strong className={stats.netGSTLiability >= 0 ? 'text-blue-700' : 'text-emerald-700'}>₹{formatINR(Math.abs(stats.netGSTLiability))}</strong>
            </div>
          </div>
        )}

      </div>

      {/* Print Modal for Sales Bill */}
      {selectedBillForPrint && getBillCategoryType(selectedBillForPrint) === 'sales' && (
        <SalesBillPrintModal
          invoice={selectedBillForPrint}
          settings={settings}
          onClose={() => setSelectedBillForPrint(null)}
        />
      )}

      {/* Print Modal for Purchase Bill */}
      {selectedBillForPrint && getBillCategoryType(selectedBillForPrint) === 'purchase' && (
        <PurchaseBillPrintModal
          invoice={selectedBillForPrint}
          settings={settings}
          onClose={() => setSelectedBillForPrint(null)}
        />
      )}

      {/* Print Modal for Lifting & Other Tax Bills */}
      {selectedBillForPrint && getBillCategoryType(selectedBillForPrint) === 'lifting' && (
        <InvoicePrintModal
          invoice={selectedBillForPrint}
          settings={settings}
          onClose={() => setSelectedBillForPrint(null)}
        />
      )}

      {/* Quick Party Tax / Lifting Bill Modal */}
      {showTaxBillModal && (
        <PartyTaxBillModal
          isOpen={showTaxBillModal}
          onClose={() => setShowTaxBillModal(false)}
          parties={parties}
          invoices={invoices}
          settings={settings}
          onSaveInvoice={async (inv) => {
            if (onSaveInvoice) {
              await onSaveInvoice(inv);
            }
            setShowTaxBillModal(false);
          }}
        />
      )}

    </div>
  );
};
