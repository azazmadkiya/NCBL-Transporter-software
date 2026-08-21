import React, { useRef, useState, useMemo } from 'react';
import { Invoice, CompanySettings, Party, formatINR } from '../types';
import { 
  Printer, Download, X, FileText, Calendar, Building2, MapPin, 
  CheckCircle2, Clock, AlertCircle, Filter, RotateCcw, LayoutGrid, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { useReactToPrint } from 'react-to-print';

interface InvoiceRegistryStatementModalProps {
  invoices: Invoice[];
  parties?: Party[];
  settings: CompanySettings;
  initialStartDate?: string;
  initialEndDate?: string;
  initialPartyFilter?: string;
  initialConsignorFilter?: string;
  initialConsigneeFilter?: string;
  initialDispatchedFilter?: string;
  initialTypeFilter?: string;
  initialStatusFilter?: string;
  initialSearchTerm?: string;
  onClose: () => void;
}

export const InvoiceRegistryStatementModal: React.FC<InvoiceRegistryStatementModalProps> = ({
  invoices,
  parties = [],
  settings,
  initialStartDate = '',
  initialEndDate = '',
  initialPartyFilter = 'all',
  initialConsignorFilter = 'all',
  initialConsigneeFilter = 'all',
  initialDispatchedFilter = 'all',
  initialTypeFilter = 'all',
  initialStatusFilter = 'all',
  initialSearchTerm = '',
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  
  // Filter States inside Modal
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [consignorFilter, setConsignorFilter] = useState(initialConsignorFilter !== 'all' ? initialConsignorFilter : (initialPartyFilter !== 'all' ? initialPartyFilter : 'all'));
  const [consigneeFilter, setConsigneeFilter] = useState(initialConsigneeFilter);
  const [dispatchedFilter, setDispatchedFilter] = useState(initialDispatchedFilter);
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [quickDatePreset, setQuickDatePreset] = useState('all');
  const [sortOrder, setSortOrder] = useState<'old_first' | 'new_first'>('old_first');

  // Display & PDF Options
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [showVehicleNo, setShowVehicleNo] = useState(true);
  const [showMaterial, setShowMaterial] = useState(true);
  const [showRate, setShowRate] = useState(true);
  const [showDispatchedFrom, setShowDispatchedFrom] = useState(true);
  const [showTaxBreakup, setShowTaxBreakup] = useState(true);
  const [showTds, setShowTds] = useState(true);
  const [showPaidBalance, setShowPaidBalance] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Helper date formatter DD/MM/YYYY
  const formatDateDMY = (dateStr?: string) => {
    if (!dateStr) return '—';
    const clean = dateStr.substring(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  // Quick Date Preset Handler
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

  // Extract unique Billing Parties (Consignors)
  const uniqueConsignors = useMemo(() => {
    const fromInvoices = invoices.map(inv => inv.consignorName?.trim()).filter(Boolean) as string[];
    const fromParties = parties
      .filter(p => p.accountCategory !== 'transporter' && p.partyType !== 'transporter')
      .map(p => p.name.trim());
    return Array.from(new Set([...fromInvoices, ...fromParties])).filter(Boolean).sort();
  }, [invoices, parties]);

  // Extract unique Consignees (Receivers)
  const uniqueConsignees = useMemo(() => {
    const fromInvoices = invoices.map(inv => inv.consigneeName?.trim()).filter(Boolean) as string[];
    const fromParties = parties
      .filter(p => p.partyType === 'consignee' || p.partyType === 'both' || p.partyType === 'shipto')
      .map(p => p.name.trim());
    return Array.from(new Set([...fromInvoices, ...fromParties])).filter(Boolean).sort();
  }, [invoices, parties]);

  // Extract unique Dispatched Parties (Shipped From)
  const uniqueDispatched = useMemo(() => {
    return Array.from(
      new Set(
        invoices.map(inv => inv.dispatchedPartyName?.trim()).filter(Boolean) as string[]
      )
    ).sort();
  }, [invoices]);

  // Find details of selected Consignor / Billing Party for statement header
  const selectedConsignorDetails = useMemo(() => {
    if (!consignorFilter || consignorFilter === 'all') return null;
    const cLower = consignorFilter.toLowerCase();
    const matchedParty = parties.find(p => p.name.toLowerCase() === cLower);
    const matchedInvoice = invoices.find(inv => inv.consignorName && inv.consignorName.toLowerCase() === cLower);
    
    return {
      name: consignorFilter,
      gstin: matchedParty?.gstin || matchedInvoice?.consignorGSTIN || '',
      city: matchedParty?.city || matchedInvoice?.consignorCity || '',
      state: matchedParty?.state || matchedInvoice?.consignorState || '',
      address: matchedParty?.address || matchedInvoice?.consignorAddress || '',
      phone: matchedParty?.phone || matchedInvoice?.consignorMobile || matchedInvoice?.consignorPhone || '',
      email: matchedParty?.email || ''
    };
  }, [consignorFilter, parties, invoices]);

  // Filtered Invoices List
  const filteredList = useMemo(() => {
    return invoices.filter(inv => {
      if (typeFilter === 'tax_invoice' && inv.invoiceType !== 'tax_invoice') return false;
      if (typeFilter === 'normal_bill' && inv.invoiceType !== 'normal_bill') return false;
      if (typeFilter === 'sales' && !(inv.billCategory === 'sales' || inv.salesBillNumber)) return false;
      if (typeFilter === 'purchase' && !(inv.billCategory === 'purchase' || inv.purchaseBillNumber)) return false;

      if (statusFilter !== 'all' && inv.paymentStatus !== statusFilter) return false;

      // Billing Party (Consignor) Filter
      if (consignorFilter && consignorFilter !== 'all') {
        const cTerm = consignorFilter.toLowerCase();
        const matchConsignor = inv.consignorName && inv.consignorName.toLowerCase().includes(cTerm);
        if (!matchConsignor) return false;
      }

      // Consignee (Receiver) Filter
      if (consigneeFilter && consigneeFilter !== 'all') {
        const ceTerm = consigneeFilter.toLowerCase();
        const matchConsignee = inv.consigneeName && inv.consigneeName.toLowerCase().includes(ceTerm);
        if (!matchConsignee) return false;
      }

      // Dispatched Party Filter
      if (dispatchedFilter && dispatchedFilter !== 'all') {
        const dpTerm = dispatchedFilter.toLowerCase();
        if (!inv.dispatchedPartyName || !inv.dispatchedPartyName.toLowerCase().includes(dpTerm)) {
          return false;
        }
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
          (inv.materialType && inv.materialType.toLowerCase().includes(term))
        );
      }
      return true;
    }).sort((a, b) => {
      const dateA = new Date(a.invoiceDate || a.salesBillDate || a.purchaseDate || a.lrDate || 0).getTime();
      const dateB = new Date(b.invoiceDate || b.salesBillDate || b.purchaseDate || b.lrDate || 0).getTime();
      if (sortOrder === 'new_first') {
        return dateB - dateA;
      } else {
        return dateA - dateB; // chronological order (old first)
      }
    });
  }, [invoices, typeFilter, statusFilter, consignorFilter, consigneeFilter, dispatchedFilter, startDate, endDate, searchTerm, sortOrder]);

  // Aggregate Totals
  const totals = useMemo(() => {
    let totalBasic = 0;
    let totalTax = 0;
    let totalNet = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    let totalAdvance = 0;
    let totalTds = 0;

    filteredList.forEach(inv => {
      const basic = Number(inv.subTotal ?? inv.grossFreight ?? (inv.netPayable - (inv.totalTax || 0))) || 0;
      const tax = Number(inv.totalTax || 0);
      const net = Number(inv.netPayable || inv.grandTotal || 0);
      const paid = Number(inv.amountPaid || 0);
      const balance = Number(inv.balanceDue ?? (net - paid)) || 0;
      const adv = Number(inv.advancePaid || 0);
      const tds = Number(inv.tdsAmount || 0);

      totalBasic += basic;
      totalTax += tax;
      totalNet += net;
      totalPaid += paid;
      totalBalance += balance;
      totalAdvance += adv;
      totalTds += tds;
    });

    return {
      count: filteredList.length,
      totalBasic,
      totalTax,
      totalNet,
      totalPaid,
      totalBalance,
      totalAdvance,
      totalTds
    };
  }, [filteredList]);

  // Print Handler
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Transport_Statement_${new Date().toISOString().split('T')[0]}`,
    pageStyle: `
      @page {
        size: ${orientation === 'landscape' ? 'landscape' : 'portrait'};
        margin: 5mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          margin: 0;
          padding: 0;
        }
        .printable-statement-container {
          width: 100% !important;
          max-width: 100% !important;
          padding: 3mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        table {
          width: 100% !important;
          table-layout: auto !important;
          page-break-inside: auto;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        thead {
          display: table-header-group;
        }
        tfoot {
          display: table-footer-group;
        }
      }
    `,
  });

  // PDF Export Handler
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);

    try {
      const element = printRef.current;
      const scrollParent = element.parentElement;
      const modalCard = scrollParent?.parentElement;

      let oldScrollOverflow = '';
      let oldCardMaxHeight = '';
      let oldCardOverflow = '';

      if (scrollParent && modalCard) {
        oldScrollOverflow = scrollParent.style.overflow;
        oldCardMaxHeight = modalCard.style.maxHeight;
        oldCardOverflow = modalCard.style.overflow;

        scrollParent.style.overflow = 'visible';
        modalCard.style.maxHeight = 'none';
        modalCard.style.overflow = 'visible';
      }

      const originalWidth = element.style.width;
      const originalMaxWidth = element.style.maxWidth;
      const originalMinWidth = element.style.minWidth;

      const isLandscape = orientation === 'landscape';
      const baseWidth = isLandscape ? 1240 : 1000;
      element.style.width = `${baseWidth}px`;
      element.style.maxWidth = 'none';
      element.style.minWidth = `${baseWidth}px`;

      await new Promise(res => setTimeout(res, 150));

      const actualWidth = Math.max(element.scrollWidth, baseWidth);
      element.style.width = `${actualWidth}px`;
      element.style.minWidth = `${actualWidth}px`;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: actualWidth + 60,
        scrollX: 0,
        scrollY: 0,
      });

      if (scrollParent && modalCard) {
        scrollParent.style.overflow = oldScrollOverflow;
        modalCard.style.maxHeight = oldCardMaxHeight;
        modalCard.style.overflow = oldCardOverflow;
      }
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.minWidth = originalMinWidth;

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'pt', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();

      const margin = 10;
      const printableWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * printableWidth) / canvas.width;

      if (imgHeight <= pdfPageHeight - (margin * 2)) {
        pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, imgHeight, undefined, 'FAST');
      } else {
        let heightLeft = imgHeight;
        let position = margin;

        pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pdfPageHeight - margin);

        while (heightLeft > 20) {
          position -= (pdfPageHeight - (margin * 2));
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight, undefined, 'FAST');
          heightLeft -= (pdfPageHeight - (margin * 2));
        }
      }

      const safeDate = new Date().toISOString().split('T')[0];
      pdf.save(`Transport_Bills_Statement_${safeDate}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGenerating(false);
    }
  };

  const formattedToday = formatDateDMY(new Date().toISOString());

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden border border-slate-300">
        
        {/* Top Modal Header & Controls */}
        <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600/30 rounded-lg border border-blue-500/40 text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>Transport Invoices & Bills Statement</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
                  {totals.count} Records Found
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Official Multi-Bill Registry Statement • PDF & High-Definition Print Report
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Orientation Toggle */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  orientation === 'landscape'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Landscape (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded font-medium transition-all ${
                  orientation === 'portrait'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Portrait
              </button>
            </div>

            {/* Print Action */}
            <button
              type="button"
              onClick={() => handlePrint()}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>PRINT STATEMENT</span>
            </button>

            {/* Download PDF Action */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition-colors shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'GENERATING PDF...' : 'DOWNLOAD PDF'}</span>
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Options Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 text-xs space-y-2.5 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            
            {/* Billing Party (Consignor) Filter */}
            <div className="lg:col-span-2">
              <label className="block text-[10.5px] font-bold text-blue-900 mb-0.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-700" />
                <span>Billing Party (Consignor)</span>
              </label>
              <select
                value={consignorFilter}
                onChange={e => setConsignorFilter(e.target.value)}
                className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-slate-800 font-semibold focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none truncate"
              >
                <option value="all">All Billing Parties / Consignors ({uniqueConsignors.length})</option>
                {uniqueConsignors.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Consignee (Receiver) Filter */}
            <div className="lg:col-span-2">
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>Consignee (Receiver)</span>
              </label>
              <select
                value={consigneeFilter}
                onChange={e => setConsigneeFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-600 focus:outline-none truncate"
              >
                <option value="all">All Consignees ({uniqueConsignees.length})</option>
                {uniqueConsignees.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Dispatched Party (Shipped From) Filter */}
            <div className="lg:col-span-2">
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>Dispatched Site</span>
              </label>
              <select
                value={dispatchedFilter}
                onChange={e => setDispatchedFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-600 focus:outline-none truncate"
              >
                <option value="all">All Dispatched Sites ({uniqueDispatched.length})</option>
                {uniqueDispatched.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Quick Date Presets */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">Period Preset</label>
              <select
                value={quickDatePreset}
                onChange={e => handleQuickDatePreset(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Dates</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="last_30">Last 30 Days</option>
                <option value="this_quarter">This Quarter</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">Sort Date</label>
              <select
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'old_first' | 'new_first')}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-semibold focus:border-blue-600 focus:outline-none"
              >
                <option value="old_first">Old First (1st to Last)</option>
                <option value="new_first">New First (Latest)</option>
              </select>
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1 border-t border-slate-200">
            {/* Start Date */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setQuickDatePreset('custom');
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setQuickDatePreset('custom');
                }}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Bill Type Filter */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">Bill Type</label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Bill Types</option>
                <option value="tax_invoice">Tax Invoices (GST)</option>
                <option value="normal_bill">Freight Bilties (Non-Tax)</option>
                <option value="sales">Sales Bills</option>
                <option value="purchase">Purchase Bills</option>
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-700 mb-0.5">Payment Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Payment Statuses</option>
                <option value="paid">Paid (Fully Cleared)</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid / Pending</option>
              </select>
            </div>
          </div>

          {/* Toggle Switches */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700">
              <span className="font-bold text-slate-900">Show Columns:</span>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVehicleNo}
                  onChange={e => setShowVehicleNo(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Vehicle #</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMaterial}
                  onChange={e => setShowMaterial(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Material / Qty</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRate}
                  onChange={e => setShowRate(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Rate (₹)</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDispatchedFrom}
                  onChange={e => setShowDispatchedFrom(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Dispatched From</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTaxBreakup}
                  onChange={e => setShowTaxBreakup(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>GST Tax</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTds}
                  onChange={e => setShowTds(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>TDS (₹)</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPaidBalance}
                  onChange={e => setShowPaidBalance(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Paid & Balance</span>
              </label>
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBankDetails}
                  onChange={e => setShowBankDetails(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Bank Details Footer</span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setConsignorFilter('all');
                setConsigneeFilter('all');
                setDispatchedFilter('all');
                setTypeFilter('all');
                setStatusFilter('all');
                setSearchTerm('');
                setQuickDatePreset('all');
                setSortOrder('old_first');
              }}
              className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold flex items-center space-x-1 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        </div>

        {/* Statement Printable Area Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          <div 
            ref={printRef}
            className={`printable-statement-container bg-white text-slate-900 shadow-md border border-slate-300 p-4 sm:p-6 rounded-sm ${
              orientation === 'landscape' ? 'w-[1160px] max-w-full' : 'w-[960px] max-w-full'
            }`}
            style={{ minHeight: '800px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Printable Document Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4">
              <div className="text-center space-y-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-wider uppercase">
                  {settings.companyName || 'NCBL Transport'}
                </h1>
                <p className="text-xs font-semibold text-slate-700 tracking-wide">
                  {settings.tagline || 'Govt. Approved Transport Contractors & Fleet Owners'}
                </p>
                <p className="text-[11px] text-slate-600 max-w-2xl mx-auto">
                  {settings.address}{settings.city ? `, ${settings.city}` : ''}{settings.state ? `, ${settings.state}` : ''}{settings.pincode ? ` - ${settings.pincode}` : ''}
                </p>
                <div className="flex flex-wrap justify-center items-center gap-x-4 text-[10.5px] font-semibold text-slate-800 pt-0.5">
                  {settings.gstin && <span>GSTIN: <strong className="font-mono">{settings.gstin}</strong></span>}
                  {settings.pan && <span>PAN: <strong className="font-mono">{settings.pan}</strong></span>}
                  {settings.phone && <span>Mobile: <strong>{settings.phone}{settings.alternatePhone ? `, ${settings.alternatePhone}` : ''}</strong></span>}
                  {settings.email && <span>Email: <strong>{settings.email}</strong></span>}
                </div>
              </div>

              {/* Document Title Banner */}
              <div className="mt-3 bg-slate-900 text-white text-center py-1.5 px-4 rounded font-bold text-xs uppercase tracking-widest flex items-center justify-between">
                <span>TRANSPORT INVOICES & BILLS STATEMENT REPORT</span>
                <span className="text-[10px] font-normal text-slate-300">
                  {startDate || endDate ? `Period: ${formatDateDMY(startDate) || 'Beginning'} to ${formatDateDMY(endDate) || 'Today'}` : 'All Recorded Bills'}
                </span>
              </div>

              {/* Dedicated Consignor / Billing Party Info Card when filtered */}
              {selectedConsignorDetails && (
                <div className="mt-2.5 bg-blue-50/60 border border-blue-200 p-2.5 rounded-sm text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-1.5 mb-1.5">
                    <div>
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-blue-700">BILLED PARTY (CONSIGNOR):</span>
                      <div className="text-sm font-black text-slate-900">{selectedConsignorDetails.name}</div>
                    </div>
                    <div className="text-right text-[11px] text-slate-700">
                      {selectedConsignorDetails.gstin && (
                        <div>GSTIN: <strong className="font-mono text-blue-900">{selectedConsignorDetails.gstin}</strong></div>
                      )}
                      {selectedConsignorDetails.phone && (
                        <div>Phone: <strong>{selectedConsignorDetails.phone}</strong></div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[10.5px] text-slate-600">
                    <div>
                      {selectedConsignorDetails.address && <span>{selectedConsignorDetails.address}, </span>}
                      {selectedConsignorDetails.city && <span>{selectedConsignorDetails.city}</span>}
                      {selectedConsignorDetails.state && <span> ({selectedConsignorDetails.state})</span>}
                    </div>
                    <div className="font-semibold text-slate-700">
                      Statement Period: {startDate ? formatDateDMY(startDate) : 'Beginning'} to {endDate ? formatDateDMY(endDate) : 'Today'} • Sort: {sortOrder === 'old_first' ? 'Chronological (Old First)' : 'Newest First'}
                    </div>
                  </div>
                </div>
              )}

              {/* Statement Metadata Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-600 mt-2 bg-slate-50 p-2 rounded border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800">Generated On: </span>
                  {formattedToday}
                </div>
                <div>
                  <span className="font-bold text-slate-800">Total Invoices/Bills: </span>
                  {totals.count}
                </div>
                <div>
                  <span className="font-bold text-slate-800">Billing Party (Consignor): </span>
                  <span className="font-semibold text-blue-900">{consignorFilter !== 'all' ? consignorFilter : 'All Consignors'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">Bill Type: </span>
                  {typeFilter === 'all' ? 'All Types' : typeFilter.replace('_', ' ').toUpperCase()}
                </div>
              </div>
            </div>

            {/* KPI Summary Block */}
            <div className={`grid grid-cols-2 ${showTds && totals.totalTds > 0 ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} gap-2 mb-4`}>
              <div className="bg-slate-50 border border-slate-300 p-2 rounded text-center">
                <div className="text-[9.5px] font-bold text-slate-500 uppercase">Total Bills</div>
                <div className="text-sm font-black text-slate-900 mt-0.5">{totals.count}</div>
              </div>
              <div className="bg-blue-50/50 border border-blue-200 p-2 rounded text-center">
                <div className="text-[9.5px] font-bold text-blue-700 uppercase">Total Basic / Freight</div>
                <div className="text-sm font-black text-blue-950 mt-0.5">₹{formatINR(totals.totalBasic)}</div>
              </div>
              <div className="bg-purple-50/50 border border-purple-200 p-2 rounded text-center">
                <div className="text-[9.5px] font-bold text-purple-700 uppercase">Total GST Tax</div>
                <div className="text-sm font-black text-purple-950 mt-0.5">₹{formatINR(totals.totalTax)}</div>
              </div>
              {showTds && totals.totalTds > 0 && (
                <div className="bg-amber-50/50 border border-amber-200 p-2 rounded text-center">
                  <div className="text-[9.5px] font-bold text-amber-700 uppercase">Total TDS</div>
                  <div className="text-sm font-black text-amber-950 mt-0.5">₹{formatINR(totals.totalTds)}</div>
                </div>
              )}
              <div className="bg-slate-100 border border-slate-300 p-2 rounded text-center">
                <div className="text-[9.5px] font-bold text-slate-700 uppercase">Total Net Amount</div>
                <div className="text-sm font-black text-slate-950 mt-0.5">₹{formatINR(totals.totalNet)}</div>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-200 p-2 rounded text-center col-span-2 sm:col-span-1">
                <div className="text-[9.5px] font-bold text-emerald-700 uppercase">Balance Pending</div>
                <div className="text-sm font-black text-emerald-950 mt-0.5">₹{formatINR(totals.totalBalance)}</div>
              </div>
            </div>

            {/* Statement Table */}
            <div className="border border-slate-400 rounded overflow-hidden mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold border-b border-slate-900 text-[8.5px]">
                    <th className="p-1 text-center w-5 border-r border-slate-700">#</th>
                    <th className="p-1 w-16 border-r border-slate-700 whitespace-nowrap">Date</th>
                    <th className="p-1 w-20 border-r border-slate-700 whitespace-nowrap">Bill / Invoice #</th>
                    <th className="p-1 border-r border-slate-700 min-w-[85px] max-w-[115px]">Consignor (Sender)</th>
                    <th className="p-1 border-r border-slate-700 min-w-[85px] max-w-[115px]">Consignee (Receiver)</th>
                    {showDispatchedFrom && <th className="p-1 border-r border-slate-700 min-w-[70px] max-w-[90px]">Dispatched From</th>}
                    {showVehicleNo && <th className="p-1 w-18 border-r border-slate-700 whitespace-nowrap">Vehicle #</th>}
                    {showMaterial && <th className="p-1 border-r border-slate-700 min-w-[80px] max-w-[105px]">Material / Weight</th>}
                    {showRate && <th className="p-1 text-right w-16 border-r border-slate-700 whitespace-nowrap">Rate (₹)</th>}
                    <th className="p-1 text-right w-16 border-r border-slate-700 whitespace-nowrap">Basic (₹)</th>
                    {showTaxBreakup && <th className="p-1 text-right w-14 border-r border-slate-700 whitespace-nowrap">Tax (₹)</th>}
                    {showTds && <th className="p-1 text-right w-14 border-r border-slate-700 whitespace-nowrap">TDS (₹)</th>}
                    <th className="p-1 text-right w-18 border-r border-slate-700 whitespace-nowrap">Total (₹)</th>
                    {showPaidBalance && (
                      <>
                        <th className="p-1 text-right w-16 border-r border-slate-700 whitespace-nowrap">Paid (₹)</th>
                        <th className="p-1 text-right w-16 border-r border-slate-700 whitespace-nowrap">Balance (₹)</th>
                        <th className="p-1 text-center w-12 whitespace-nowrap">Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 text-[8.5px] leading-tight">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="p-6 text-center text-slate-500 font-medium italic">
                        No transport invoices or bills match the selected statement filters.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((inv, idx) => {
                      const invDate = formatDateDMY(inv.invoiceDate || inv.salesBillDate || inv.purchaseDate || inv.lrDate);
                      const billNo = inv.invoiceNumber || inv.salesBillNumber || inv.purchaseBillNumber || inv.lrNumber || '—';
                      const basicAmt = Number(inv.subTotal ?? inv.grossFreight ?? (inv.netPayable - (inv.totalTax || 0))) || 0;
                      const taxAmt = Number(inv.totalTax || 0);
                      const tdsAmt = Number(inv.tdsAmount || 0);
                      const netAmt = Number(inv.netPayable || inv.grandTotal || 0);
                      const paidAmt = Number(inv.amountPaid || 0);
                      const balAmt = Number(inv.balanceDue ?? (netAmt - paidAmt)) || 0;

                      // Material & Weight calculation
                      let matDesc = inv.materialType || '';
                      let rateVal: number | undefined = undefined;
                      let unitLabel = '';

                      if (inv.items && inv.items.length > 0) {
                        const itm = inv.items[0];
                        const qty = Number(itm.quantity || itm.weightTons || 0);
                        const unit = itm.unit || 'MT';
                        if (itm.unit) {
                          unitLabel = `/${itm.unit}`;
                        }
                        if (qty > 0) {
                          matDesc = `${matDesc ? matDesc + ' - ' : ''}${qty.toFixed(unit === 'Fixed' || unit === 'Trips' || unit === 'Pcs' || unit === 'Nos' ? 0 : 2)} ${unit}`;
                        }

                        if (itm.ratePerTon !== undefined && itm.ratePerTon > 0) {
                          rateVal = itm.ratePerTon;
                        } else if (itm.rate !== undefined && itm.rate > 0) {
                          rateVal = itm.rate;
                        } else if (qty > 0 && basicAmt > 0) {
                          rateVal = basicAmt / qty;
                        }
                      }

                      return (
                        <tr 
                          key={inv.id || idx} 
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                        >
                          <td className="p-1 text-center text-slate-500 font-medium border-r border-slate-300 font-mono">
                            {idx + 1}
                          </td>
                          <td className="p-1 font-medium whitespace-nowrap text-slate-800 border-r border-slate-300 font-mono">
                            {invDate}
                          </td>
                          <td className="p-1 font-bold font-mono text-slate-900 border-r border-slate-300 whitespace-nowrap">
                            <div>{billNo}</div>
                          </td>
                          <td className="p-1 font-semibold text-slate-900 border-r border-slate-300 break-words max-w-[115px]">
                            <div>{inv.consignorName || '—'}</div>
                            {inv.consignorCity && (
                              <div className="text-[7.5px] text-slate-500 font-normal">{inv.consignorCity}</div>
                            )}
                          </td>
                          <td className="p-1 text-slate-800 border-r border-slate-300 break-words max-w-[115px]">
                            <div className="font-semibold">{inv.consigneeName || '—'}</div>
                            {(inv.consigneeCity || inv.destination) && (
                              <div className="text-[7.5px] text-slate-500">
                                {inv.consigneeCity || inv.destination}
                              </div>
                            )}
                          </td>
                          {showDispatchedFrom && (
                            <td className="p-1 text-slate-700 border-r border-slate-300 break-words max-w-[90px]">
                              <div>{inv.dispatchedPartyName || inv.origin || '—'}</div>
                              {inv.dispatchedPartyCity && (
                                <div className="text-[7.5px] text-slate-500">{inv.dispatchedPartyCity}</div>
                              )}
                            </td>
                          )}
                          {showVehicleNo && (
                            <td className="p-1 font-mono font-bold text-slate-900 whitespace-nowrap border-r border-slate-300">
                              {inv.vehicleNumber || '—'}
                            </td>
                          )}
                          {showMaterial && (
                            <td className="p-1 text-slate-700 border-r border-slate-300 break-words max-w-[105px]">
                              <div>{matDesc || '—'}</div>
                            </td>
                          )}
                          {showRate && (
                            <td className="p-1 text-right font-medium font-mono text-slate-800 border-r border-slate-300 whitespace-nowrap">
                              {rateVal !== undefined && rateVal > 0 ? (
                                <div>
                                  <span>₹{formatINR(rateVal)}</span>
                                  {unitLabel && unitLabel.toLowerCase() !== '/fixed' && (
                                    <span className="text-[7.5px] text-slate-500 ml-0.5 font-sans">{unitLabel}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          )}
                          <td className="p-1 text-right font-medium text-slate-800 border-r border-slate-300 font-mono whitespace-nowrap">
                            ₹{formatINR(basicAmt)}
                          </td>
                          {showTaxBreakup && (
                            <td className="p-1 text-right font-medium text-slate-700 border-r border-slate-300 font-mono whitespace-nowrap">
                              {taxAmt > 0 ? `₹${formatINR(taxAmt)}` : '—'}
                            </td>
                          )}
                          {showTds && (
                            <td className="p-1 text-right font-medium font-mono text-slate-700 border-r border-slate-300 whitespace-nowrap">
                              {tdsAmt > 0 ? (
                                <span className="font-semibold text-amber-900">₹{formatINR(tdsAmt)}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          )}
                          <td className="p-1 text-right font-black text-slate-950 border-r border-slate-300 font-mono whitespace-nowrap">
                            ₹{formatINR(netAmt)}
                          </td>
                          {showPaidBalance && (
                            <>
                              <td className="p-1 text-right font-medium text-emerald-800 border-r border-slate-300 font-mono whitespace-nowrap">
                                {paidAmt > 0 ? `₹${formatINR(paidAmt)}` : '—'}
                              </td>
                              <td className="p-1 text-right font-black text-red-900 border-r border-slate-300 font-mono whitespace-nowrap">
                                {balAmt > 0 ? `₹${formatINR(balAmt)}` : '₹0.00'}
                              </td>
                              <td className="p-1 text-center whitespace-nowrap">
                                <span className={`text-[7.5px] font-black px-1 py-0.5 rounded uppercase ${
                                  inv.paymentStatus === 'paid' 
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : inv.paymentStatus === 'partial'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-red-100 text-red-900 border border-red-300'
                                }`}>
                                  {inv.paymentStatus || 'UNPAID'}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Grand Totals Footer */}
                {filteredList.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-200 font-black text-slate-950 border-t-2 border-slate-900 text-[8.5px]">
                      <td colSpan={5 + (showDispatchedFrom ? 1 : 0) + (showVehicleNo ? 1 : 0) + (showMaterial ? 1 : 0) + (showRate ? 1 : 0)} className="p-1.5 text-right uppercase border-r border-slate-400">
                        TOTALS ({totals.count} BILLS):
                      </td>
                      <td className="p-1.5 text-right border-r border-slate-400 font-mono whitespace-nowrap">
                        ₹{formatINR(totals.totalBasic)}
                      </td>
                      {showTaxBreakup && (
                        <td className="p-1.5 text-right border-r border-slate-400 font-mono whitespace-nowrap">
                          ₹{formatINR(totals.totalTax)}
                        </td>
                      )}
                      {showTds && (
                        <td className="p-1.5 text-right text-amber-950 border-r border-slate-400 font-mono whitespace-nowrap">
                          {totals.totalTds > 0 ? `₹${formatINR(totals.totalTds)}` : '₹0.00'}
                        </td>
                      )}
                      <td className="p-1.5 text-right text-slate-950 border-r border-slate-400 font-mono whitespace-nowrap">
                        ₹{formatINR(totals.totalNet)}
                      </td>
                      {showPaidBalance && (
                        <>
                          <td className="p-1.5 text-right text-emerald-900 border-r border-slate-400 font-mono whitespace-nowrap">
                            ₹{formatINR(totals.totalPaid)}
                          </td>
                          <td className="p-1.5 text-right text-red-950 border-r border-slate-400 font-mono whitespace-nowrap">
                            ₹{formatINR(totals.totalBalance)}
                          </td>
                          <td className="p-1.5 text-center text-[7.5px] whitespace-nowrap">
                            {totals.totalBalance === 0 ? 'CLEARED' : 'PENDING'}
                          </td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Bottom Statement Details: Bank Remittance & Verification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-300 text-[10.5px]">
              
              {/* Bank Account Details */}
              {showBankDetails && (
                <div className="bg-slate-50 border border-slate-300 p-3 rounded space-y-1">
                  <div className="font-bold text-slate-900 uppercase text-[10px] border-b border-slate-200 pb-1">
                    Bank Account Details for Remittance
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-700 mt-1">
                    <div>Bank Name: <strong className="text-slate-900">{settings.bankName || 'HDFC Bank'}</strong></div>
                    <div>A/C No: <strong className="text-slate-900 font-mono">{settings.bankAccountNo || '50200012345678'}</strong></div>
                    <div>IFSC Code: <strong className="text-slate-900 font-mono">{settings.bankIfsc || 'HDFC0001234'}</strong></div>
                    <div>Branch: <strong className="text-slate-900">{settings.bankBranch || 'Ring Road, Surat'}</strong></div>
                    {settings.upiId && (
                      <div className="col-span-2">UPI ID: <strong className="text-slate-900 font-mono">{settings.upiId}</strong></div>
                    )}
                  </div>
                </div>
              )}

              {/* Signatures & Certification */}
              <div className="flex flex-col justify-between items-end text-right">
                <div className="text-[10px] text-slate-500 italic">
                  * This is a computer-generated official billing registry statement.
                </div>
                <div className="pt-8 text-center sm:text-right">
                  <div className="font-bold text-slate-900">
                    For {settings.companyName || 'NCBL Transport'}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-6 pt-1 border-t border-slate-400 inline-block min-w-[180px]">
                    Authorized Signatory
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-100 px-4 py-3 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-600">
            Showing <strong className="text-slate-900">{totals.count}</strong> invoices/bills • Total Net: <strong className="text-slate-900">₹{formatINR(totals.totalNet)}</strong> • Outstanding: <strong className="text-red-700">₹{formatINR(totals.totalBalance)}</strong>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-4 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handlePrint()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors shadow-xs cursor-pointer flex items-center space-x-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print Statement</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors shadow-xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Saving PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
