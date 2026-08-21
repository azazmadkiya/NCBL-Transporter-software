import React, { useRef, useState, useMemo } from 'react';
import { Party, Invoice, CompanySettings, formatINR } from '../types';
import { Printer, Download, X, Truck, Building2, Calendar, FileText, Columns, LayoutGrid, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { useReactToPrint } from 'react-to-print';

interface PartyLedgerPrintModalProps {
  party: Party;
  invoices: Invoice[];
  settings: CompanySettings;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
  initialFormat?: 't_format' | 'tabular';
}

interface RawLedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment';
  referenceNo: string;
  lrNumber?: string;
  consigneeName?: string;
  shipToName?: string;
  shipToAddress?: string;
  origin?: string;
  destination?: string;
  vehicleNumber?: string;
  materialType?: string;
  qtyWeight?: string;
  rate?: number;
  basicAmount?: number;
  taxAmount?: number;
  tdsAmount?: number;
  advancePaid?: number;
  fuelDeduction?: number;
  description: string;
  debit: number;
  credit: number;
}

interface TFormatItem {
  id: string;
  date: string;
  voucherType: string; // 'GSTEx' | 'Jrnl' | 'Pymt' | 'Rcpt' | 'Bank' | 'Cash'
  amount: number;
  title: string; // e.g. 'TRANSPORT' | 'TDS ON TRANSPORT PAYABLE A/C.'
  vehicleNumber?: string; // Uppercase vehicle number e.g. 'GJ-06BT-9219'
  particulars?: string; // Material / Route / Description
  qtyWeight?: string; // e.g. '35.40 MT'
  rate?: number; // e.g. 2170
  consignee?: string; // Consignee name
  shipTo?: string; // Ship To destination / address / consignee
  subtitle?: string; // e.g. '(94C)'
  voucherNo: string; // e.g. 'Vou No GPT/1'
  notes?: string;
}

export const PartyLedgerPrintModal: React.FC<PartyLedgerPrintModalProps> = ({
  party,
  invoices,
  settings,
  startDate,
  endDate,
  onClose,
  initialFormat = 't_format'
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [statementFormat, setStatementFormat] = useState<'t_format' | 'tabular'>(initialFormat);
  const [sortOrder, setSortOrder] = useState<'old_first' | 'new_first'>('old_first');
  const initialCompany = settings.companyName && !/nirmaladevi|nirmala|ncpl|nirmal/i.test(settings.companyName) 
    ? settings.companyName 
    : 'NCBL TRANSPORT';
  const [headerTitle, setHeaderTitle] = useState(initialCompany);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showConsigneeName, setShowConsigneeName] = useState(true);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('portrait');
  const [isGenerating, setIsGenerating] = useState(false);

  const displayPartyName = party?.name && /^(nirmaladevi(\s+care)?|nirmala(\s+transport(\s+services)?)?)$/i.test(party.name.trim())
    ? 'NCBL Transport'
    : (party?.name || '');

  // Helper date formatter DD/MM/YYYY
  const formatDateDMY = (dateStr?: string) => {
    if (!dateStr) return '';
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

  const isTransporterOrCreditor = party.accountGroup === 'sundry_creditors' || 
    party.accountCategory === 'transporter' || 
    party.partyType === 'transporter';

  // Filter party invoices (by partyId, consignor, consignee, dispatchedParty, or transporterName)
  const partyInvoices = invoices.filter(inv => {
    if (inv.partyId === party.id) return true;
    const partyNameLower = party.name ? party.name.toLowerCase().trim() : '';
    if (partyNameLower) {
      if (inv.consignorName && inv.consignorName.toLowerCase().trim() === partyNameLower) return true;
      if (inv.consigneeName && inv.consigneeName.toLowerCase().trim() === partyNameLower) return true;
      if (inv.dispatchedPartyName && inv.dispatchedPartyName.toLowerCase().trim() === partyNameLower) return true;
      if ((inv as any).transporterName && (inv as any).transporterName.toLowerCase().trim() === partyNameLower) return true;
      if ((inv as any).transporterId === party.id) return true;
    }
    return false;
  });

  // Raw entries calculation
  const rawEntries: RawLedgerEntry[] = [];

  // Group payment receipts by payment transaction key so they show as direct lump sum / transaction entries without bill breakdown
  const paymentMap = new Map<string, {
    id: string;
    date: string;
    referenceNo: string;
    mode: string;
    amount: number;
    kasarAmount: number;
    notesSet: Set<string>;
  }>();

  partyInvoices.forEach(inv => {
    const basicAmt = Number(inv.subTotal ?? inv.grossFreight ?? (inv.netPayable - (inv.totalTax || 0))) || 0;
    const taxAmt = Number(inv.totalTax || 0);
    const totalAmt = Number(inv.netPayable || inv.grandTotal || 0);

    const isIncome = inv.billCategory === 'income';
    const isExpense = inv.billCategory === 'expense';
    const isCreditExpense = isExpense && inv.ledgerImpact !== 'debit';
    const billKasarText = inv.kasarDeduction && inv.kasarDeduction > 0 ? ` [Bill Kasar: ₹${formatINR(inv.kasarDeduction)}]` : '';
    const taxTag = inv.taxSlab ? ` [GST ${inv.taxSlab}%: ₹${formatINR(taxAmt)}]` : '';

    let desc = `Freight (${inv.origin} ➔ ${inv.destination}) - Vehicle: ${inv.vehicleNumber}${inv.shipToName ? ' [Ship To: ' + inv.shipToName + ']' : ''}${billKasarText}`;
    if (isIncome) {
      desc = `[Income Bill (Tax ${inv.taxSlab || 18}%)] ${inv.items?.[0]?.description || 'Transport Services'}${inv.vehicleNumber ? ' - Vehicle: ' + inv.vehicleNumber : ''}${inv.destination ? ' (' + inv.origin + ' ➔ ' + inv.destination + ')' : ''}${taxTag}${billKasarText}`;
    } else if (isExpense) {
      desc = `[Expense Bill (Tax ${inv.taxSlab || 18}%)] ${inv.items?.[0]?.description || inv.expenseCategory || 'Transport Expense'}${inv.vehicleNumber ? ' - Vehicle: ' + inv.vehicleNumber : ''}${taxTag}${billKasarText}`;
    }

    const entryDebit = totalAmt;
    const entryCredit = 0;

    rawEntries.push({
      id: `inv-${inv.id}`,
      date: inv.invoiceDate,
      type: 'invoice',
      referenceNo: inv.invoiceNumber,
      lrNumber: inv.lrNumber || '—',
      consigneeName: inv.consigneeName || '—',
      shipToName: inv.shipToName || '',
      shipToAddress: inv.shipToAddress || '',
      origin: inv.origin || '—',
      destination: inv.destination || '—',
      vehicleNumber: inv.vehicleNumber || '—',
      materialType: inv.materialType || (isIncome ? 'Income Service' : isExpense ? 'Expense Bill' : 'General Freight'),
      qtyWeight: inv.items && inv.items.length > 0 
        ? `${Number(inv.items[0].quantity).toFixed(inv.items[0].unit === 'Fixed' ? 0 : 2)} ${inv.items[0].unit}`.trim() 
        : '—',
      rate: inv.items && inv.items.length > 0 ? (inv.items[0].ratePerTon || 0) : 0,
      basicAmount: basicAmt,
      taxAmount: taxAmt,
      tdsAmount: inv.tdsAmount || 0,
      advancePaid: inv.advancePaid || 0,
      fuelDeduction: inv.fuelDeduction || 0,
      description: desc,
      debit: entryDebit,
      credit: entryCredit
    });

    // Accumulate payment receipts
    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach(p => {
        let key = p.id;
        if (p.id && p.id.startsWith('pay-lumpsum-')) {
          const parts = p.id.split('-');
          if (parts.length >= 3) {
            key = `${parts[0]}-${parts[1]}-${parts[2]}`;
          }
        } else if (p.referenceNo && p.referenceNo.trim().length > 0 && p.referenceNo !== 'PAYMENT' && p.referenceNo !== 'RECEIPT') {
          key = `${p.date}_${(p.mode || 'cash').toLowerCase()}_${p.referenceNo.trim().toLowerCase()}`;
        } else {
          key = `${p.date}_${(p.mode || 'cash').toLowerCase()}_${(p.referenceNo || 'RECEIPT').trim().toLowerCase()}`;
        }

        const existing = paymentMap.get(key);
        const cleanNote = (p.notes || '')
          .replace(/Lump sum settlement applied to Inv #[^\s,]+/gi, '')
          .replace(/\[Lump Sum Bulk Settlement[^\]]*\]/gi, '')
          .replace(/applied to Inv #[^\s,]+/gi, '')
          .replace(/Inv #[^\s,]+/gi, '')
          .trim();

        if (existing) {
          existing.amount += Number(p.amount || 0);
          existing.kasarAmount += Number(p.kasarAmount || 0);
          if (cleanNote) existing.notesSet.add(cleanNote);
        } else {
          const notesSet = new Set<string>();
          if (cleanNote) notesSet.add(cleanNote);
          paymentMap.set(key, {
            id: p.id || key,
            date: p.date,
            referenceNo: p.referenceNo || 'RECEIPT',
            mode: p.mode ? p.mode.toUpperCase() : 'CASH',
            amount: Number(p.amount || 0),
            kasarAmount: Number(p.kasarAmount || 0),
            notesSet
          });
        }
      });
    }
  });

  // Convert grouped payments into raw entries
  paymentMap.forEach((pGroup) => {
    const notesArray = Array.from(pGroup.notesSet).filter(n => n.length > 0);
    const combinedNotes = notesArray.join(' | ');
    const kasarText = pGroup.kasarAmount > 0 ? ` [Includes Kasar/Discount: ₹${formatINR(pGroup.kasarAmount)}]` : '';

    rawEntries.push({
      id: `pay-${pGroup.id}`,
      date: pGroup.date,
      type: 'payment',
      referenceNo: pGroup.referenceNo,
      description: `Payment (${pGroup.mode})${combinedNotes ? ' - ' + combinedNotes : ''}${kasarText}`,
      debit: 0,
      credit: (pGroup.amount + pGroup.kasarAmount)
    });
  });

  // Sort chronological for baseline running balance
  rawEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate opening balance prior to startDate
  const priorEntries = rawEntries.filter(e => startDate && e.date.substring(0, 10) < startDate.substring(0, 10));
  const priorDebit = priorEntries.reduce((acc, r) => acc + r.debit, 0);
  const priorCredit = priorEntries.reduce((acc, r) => acc + r.credit, 0);
  const openingBalanceForPeriod = (Number(party.openingBalance) || 0) + priorDebit - priorCredit;

  // Filter by date range
  const filteredEntries = rawEntries.filter(e => {
    if (startDate && e.date.substring(0, 10) < startDate.substring(0, 10)) return false;
    if (endDate && e.date.substring(0, 10) > endDate.substring(0, 10)) return false;
    return true;
  });

  // Compute running balance starting from openingBalanceForPeriod
  let runningBal = openingBalanceForPeriod;
  const ledgerRows = filteredEntries.map(entry => {
    runningBal = runningBal + entry.debit - entry.credit;
    return {
      ...entry,
      runningBalance: runningBal
    };
  });

  // Tabular displayed rows sorted by sortOrder
  const displayedLedgerRows = useMemo(() => {
    if (sortOrder === 'new_first') {
      return [...ledgerRows].reverse();
    }
    return ledgerRows;
  }, [ledgerRows, sortOrder]);

  const totalBasic = ledgerRows.reduce((acc, r) => acc + (r.basicAmount || 0), 0);
  const totalTax = ledgerRows.reduce((acc, r) => acc + (r.taxAmount || 0), 0);
  const totalTds = ledgerRows.reduce((acc, r) => acc + (r.tdsAmount || 0), 0);
  const totalBilled = ledgerRows.reduce((acc, r) => acc + r.debit, 0);
  const totalReceived = ledgerRows.reduce((acc, r) => acc + r.credit, 0);
  const closingBalance = openingBalanceForPeriod + totalBilled - totalReceived;

  // ==========================================
  // T-FORMAT DATA GENERATION (NCPL Style)
  // ==========================================
  const tFormatData = useMemo(() => {
    const leftItems: (TFormatItem & { rawDate?: string; isOpening?: boolean })[] = [];
    const rightItems: (TFormatItem & { rawDate?: string; isOpening?: boolean })[] = [];

    // 1. Opening Balance
    if (openingBalanceForPeriod > 0) {
      leftItems.push({
        id: 'op-bal',
        rawDate: startDate || '1970-01-01',
        date: startDate ? formatDateDMY(startDate) : formatDateDMY(new Date().toISOString()),
        voucherType: 'OpBal',
        amount: Math.abs(openingBalanceForPeriod),
        title: 'OPENING BALANCE (DR)',
        voucherNo: 'B/F',
        isOpening: true
      });
    } else if (openingBalanceForPeriod < 0) {
      rightItems.push({
        id: 'op-bal',
        rawDate: startDate || '1970-01-01',
        date: startDate ? formatDateDMY(startDate) : formatDateDMY(new Date().toISOString()),
        voucherType: 'OpBal',
        amount: Math.abs(openingBalanceForPeriod),
        title: 'OPENING BALANCE (CR)',
        voucherNo: 'B/F',
        isOpening: true
      });
    }

    // 2. Invoices & Deductions
    partyInvoices.forEach(inv => {
      if (startDate && inv.invoiceDate.substring(0, 10) < startDate.substring(0, 10)) return;
      if (endDate && inv.invoiceDate.substring(0, 10) > endDate.substring(0, 10)) return;

      const grossFreight = Number(inv.grossFreight || inv.grandTotal || inv.netPayable || 0);
      const vouNo = inv.invoiceNumber || inv.lrNumber || '—';
      const formattedDate = formatDateDMY(inv.invoiceDate);

      const vehicleNo = inv.vehicleNumber ? inv.vehicleNumber.trim().toUpperCase() : undefined;
      let qtyWeightStr: string | undefined = undefined;
      let rateVal: number | undefined = undefined;
      let particularsDesc: string | undefined = undefined;

      if (inv.items && inv.items.length > 0) {
        const itm = inv.items[0];
        const qty = Number(itm.quantity || itm.weightTons || 0);
        const unit = itm.unit || 'MT';
        if (qty > 0) {
          qtyWeightStr = `${qty.toFixed(unit === 'Fixed' || unit === 'Trips' || unit === 'Pcs' || unit === 'Nos' ? 0 : 2)} ${unit.toUpperCase()}`;
        }
        rateVal = itm.ratePerTon || itm.rate || (qty > 0 ? (grossFreight / qty) : undefined);
        if (itm.description && itm.description.trim() && itm.description.toLowerCase() !== 'freight charges') {
          particularsDesc = itm.description.trim().toUpperCase();
        }
      }

      if (!particularsDesc) {
        if (inv.materialType && inv.materialType.trim()) {
          particularsDesc = inv.materialType.trim().toUpperCase();
        } else if (inv.origin && inv.destination) {
          particularsDesc = `${inv.origin.trim().toUpperCase()} TO ${inv.destination.trim().toUpperCase()}`;
        }
      }

      const consigneeNameStr = inv.consigneeName ? inv.consigneeName.trim().toUpperCase() : undefined;
      let shipToStr = inv.shipToName ? inv.shipToName.trim().toUpperCase() : undefined;
      if (!shipToStr) {
        if (inv.consigneeName) {
          shipToStr = inv.consigneeName.trim().toUpperCase();
          if (inv.destination && !shipToStr.includes(inv.destination.trim().toUpperCase())) {
            shipToStr = `${shipToStr} (${inv.destination.trim().toUpperCase()})`;
          }
        } else if (inv.destination) {
          shipToStr = inv.destination.trim().toUpperCase();
        }
      } else if (inv.destination && !shipToStr.includes(inv.destination.trim().toUpperCase())) {
        shipToStr = `${shipToStr} (${inv.destination.trim().toUpperCase()})`;
      }

      // Debit side (Left): Freight Bill / Invoice
      leftItems.push({
        id: `dr-freight-${inv.id}`,
        rawDate: inv.invoiceDate,
        date: formattedDate,
        voucherType: 'GSTEx',
        amount: grossFreight,
        title: inv.billCategory === 'sales' ? 'SALES GOODS / COMMODITY' : 'TRANSPORT FREIGHT',
        vehicleNumber: vehicleNo,
        particulars: particularsDesc,
        qtyWeight: qtyWeightStr,
        rate: rateVal,
        consignee: consigneeNameStr,
        shipTo: shipToStr,
        voucherNo: `Vou No ${vouNo}`
      });

      // Credit side (Right): TDS deduction (Section 194C)
      if (inv.tdsAmount && inv.tdsAmount > 0) {
        rightItems.push({
          id: `cr-tds-${inv.id}`,
          rawDate: inv.invoiceDate,
          date: formattedDate,
          voucherType: 'Jrnl',
          amount: inv.tdsAmount,
          title: 'TDS ON TRANSPORT (SEC 194C)',
          subtitle: `(Section 194C)`,
          voucherNo: `Vou No ${vouNo}`
        });
      }

      // Credit side (Right): Cash Advance
      if (inv.advancePaid && inv.advancePaid > 0) {
        rightItems.push({
          id: `cr-adv-${inv.id}`,
          rawDate: inv.invoiceDate,
          date: formattedDate,
          voucherType: 'Pymt',
          amount: inv.advancePaid,
          title: 'ADVANCE CASH PAID',
          voucherNo: `Vou No ${vouNo}`
        });
      }

      // Credit side (Right): Diesel / Fuel Deduction
      if (inv.fuelDeduction && inv.fuelDeduction > 0) {
        rightItems.push({
          id: `cr-fuel-${inv.id}`,
          rawDate: inv.invoiceDate,
          date: formattedDate,
          voucherType: 'Jrnl',
          amount: inv.fuelDeduction,
          title: 'DIESEL / FUEL ISSUED',
          voucherNo: `Vou No ${vouNo}`
        });
      }
    });

    // 3. Payment Entries (Credit Side / Right)
    paymentMap.forEach(pGroup => {
      if (startDate && pGroup.date.substring(0, 10) < startDate.substring(0, 10)) return;
      if (endDate && pGroup.date.substring(0, 10) > endDate.substring(0, 10)) return;

      const formattedDate = formatDateDMY(pGroup.date);
      const cleanNotes = Array.from(pGroup.notesSet).join(' ');
      const modeUpper = (pGroup.mode || '').toUpperCase();
      const isBankMode = modeUpper.includes('BANK') || modeUpper.includes('NEFT') || modeUpper.includes('RTGS') || modeUpper.includes('UPI') || modeUpper.includes('CHEQUE') || modeUpper.includes('ONLINE') || modeUpper.includes('TRANSFER');
      const vouType = isBankMode ? 'Bank' : 'Pymt';

      rightItems.push({
        id: `cr-pay-${pGroup.id}`,
        rawDate: pGroup.date,
        date: formattedDate,
        voucherType: vouType,
        amount: pGroup.amount,
        title: `PAYMENT (${pGroup.mode.replace(/_/g, ' ')})`,
        subtitle: cleanNotes || undefined,
        voucherNo: `Vou No ${pGroup.referenceNo}`
      });

      if (pGroup.kasarAmount > 0) {
        rightItems.push({
          id: `cr-kasar-${pGroup.id}`,
          rawDate: pGroup.date,
          date: formattedDate,
          voucherType: 'Jrnl',
          amount: pGroup.kasarAmount,
          title: 'KASAR / DISCOUNT CONCESSION',
          voucherNo: `Vou No ${pGroup.referenceNo}`
        });
      }
    });

    // Sort left and right items by sortOrder
    const sortTItems = (items: (TFormatItem & { rawDate?: string; isOpening?: boolean })[]) => {
      const opBalItems = items.filter(i => i.isOpening);
      const regularItems = items.filter(i => !i.isOpening);

      regularItems.sort((a, b) => {
        const timeA = new Date(a.rawDate || a.date).getTime() || 0;
        const timeB = new Date(b.rawDate || b.date).getTime() || 0;
        if (sortOrder === 'new_first') {
          return timeB - timeA;
        }
        return timeA - timeB;
      });

      if (sortOrder === 'old_first') {
        return [...opBalItems, ...regularItems];
      } else {
        return [...regularItems, ...opBalItems];
      }
    };

    const sortedLeft = sortTItems(leftItems);
    const sortedRight = sortTItems(rightItems);

    const totalLeft = sortedLeft.reduce((acc, i) => acc + i.amount, 0);
    const totalRight = sortedRight.reduce((acc, i) => acc + i.amount, 0);

    const diff = totalLeft - totalRight;
    const isDrBalance = diff > 0;
    const balanceAmount = Math.abs(diff);
    const grandTotal = Math.max(totalLeft, totalRight);

    return {
      leftTitle: 'DEBIT PARTICULARS (DR.)',
      rightTitle: 'CREDIT PARTICULARS (CR.)',
      leftItems: sortedLeft,
      rightItems: sortedRight,
      totalLeft,
      totalRight,
      closingBalanceAmount: balanceAmount,
      closingBalanceSide: isDrBalance ? 'right' : 'left',
      closingBalanceText: `${formatINR(balanceAmount)} ${isDrBalance ? 'DR' : 'CR'} Closing Balance`,
      grandTotal
    };
  }, [openingBalanceForPeriod, partyInvoices, paymentMap, startDate, endDate, sortOrder]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ledger_${displayPartyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`,
    pageStyle: `
      @page {
        size: ${orientation === 'landscape' ? 'landscape' : 'portrait'};
        margin: 6mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          margin: 0;
          padding: 0;
        }
        #printable-party-ledger {
          width: 100% !important;
          max-width: 100% !important;
          padding: 2mm !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        table {
          width: 100% !important;
          page-break-inside: auto;
        }
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      }
    `,
  });

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);

    const element = printRef.current;
    const scrollParent = element.parentElement;
    const modalCard = scrollParent?.parentElement;
    const modalOverlay = modalCard?.parentElement;

    let oldScrollOverflow = '';
    let oldScrollMaxHeight = '';
    let oldCardMaxHeight = '';
    let oldCardOverflow = '';
    let oldOverlayOverflow = '';

    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMinWidth = element.style.minWidth;
    const originalHeight = element.style.height;
    const originalMaxHeight = element.style.maxHeight;

    try {
      if (scrollParent && modalCard) {
        oldScrollOverflow = scrollParent.style.overflow;
        oldScrollMaxHeight = scrollParent.style.maxHeight;
        oldCardMaxHeight = modalCard.style.maxHeight;
        oldCardOverflow = modalCard.style.overflow;

        scrollParent.style.overflow = 'visible';
        scrollParent.style.maxHeight = 'none';
        modalCard.style.maxHeight = 'none';
        modalCard.style.overflow = 'visible';

        if (modalOverlay) {
          oldOverlayOverflow = modalOverlay.style.overflow;
          modalOverlay.style.overflow = 'visible';
        }
      }

      const isLandscape = orientation === 'landscape';
      const baseTargetWidth = isLandscape ? 1160 : 860;
      element.style.width = `${baseTargetWidth}px`;
      element.style.maxWidth = `${baseTargetWidth}px`;
      element.style.minWidth = `${baseTargetWidth}px`;
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
      element.style.overflow = 'visible';

      await new Promise(res => setTimeout(res, 180));

      const fullScrollHeight = Math.max(element.scrollHeight, element.offsetHeight);
      const fullScrollWidth = Math.max(element.scrollWidth, baseTargetWidth);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: fullScrollWidth,
        height: fullScrollHeight,
        windowWidth: fullScrollWidth + 60,
        windowHeight: fullScrollHeight + 100,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
      });

      const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'pt', 'a4');
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();

      const margin = 12; // 12pt clean margins
      const printableWidth = pdfPageWidth - (margin * 2);
      const printableHeight = pdfPageHeight - (margin * 2);

      // Height of one PDF page slice in canvas pixels
      const pageCanvasHeight = (printableHeight * canvas.width) / printableWidth;
      const totalImgHeightPt = (canvas.height * printableWidth) / canvas.width;

      if (totalImgHeightPt <= printableHeight) {
        // Single page document
        const imgData = canvas.toDataURL('image/png', 1.0);
        pdf.addImage(imgData, 'PNG', margin, margin, printableWidth, totalImgHeightPt, undefined, 'FAST');
      } else {
        // Multi-page document: slice canvas page-by-page to guarantee zero cutoffs
        let renderedHeightPx = 0;
        let pageIndex = 0;

        while (renderedHeightPx < canvas.height) {
          if (pageIndex > 0) {
            pdf.addPage();
          }

          const currentSliceHeightPx = Math.min(pageCanvasHeight, canvas.height - renderedHeightPx);

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = currentSliceHeightPx;
          const ctx = pageCanvas.getContext('2d');

          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0, renderedHeightPx, canvas.width, currentSliceHeightPx,
              0, 0, canvas.width, currentSliceHeightPx
            );

            const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
            const sliceHeightPt = (currentSliceHeightPx * printableWidth) / canvas.width;
            pdf.addImage(pageImgData, 'PNG', margin, margin, printableWidth, sliceHeightPt, undefined, 'FAST');
          }

          renderedHeightPx += currentSliceHeightPx;
          pageIndex++;
        }
      }

      const safePartyName = party.name.replace(/[^a-zA-Z0-9]/g, '_');
      const safeDate = new Date().toISOString().split('T')[0];
      pdf.save(`Ledger_${safePartyName}_${safeDate}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      if (scrollParent && modalCard) {
        scrollParent.style.overflow = oldScrollOverflow;
        scrollParent.style.maxHeight = oldScrollMaxHeight;
        modalCard.style.maxHeight = oldCardMaxHeight;
        modalCard.style.overflow = oldCardOverflow;
        if (modalOverlay) {
          modalOverlay.style.overflow = oldOverlayOverflow;
        }
      }
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.minWidth = originalMinWidth;
      element.style.height = originalHeight;
      element.style.maxHeight = originalMaxHeight;
      setIsGenerating(false);
    }
  };

  const formattedToday = formatDateDMY(new Date().toISOString());
  const startDateStr = startDate ? formatDateDMY(startDate) : '01/04/' + (new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  const endDateStr = endDate ? formatDateDMY(endDate) : '31/03/' + (new Date().getMonth() >= 3 ? new Date().getFullYear() + 1 : new Date().getFullYear());

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      
      {/* Modal Container */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-7xl max-h-[96vh] flex flex-col my-auto overflow-hidden">
        
        {/* Header Toolbar */}
        <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-white sticky top-0 z-10 print:hidden">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                <span>PARTY LEDGER STATEMENT</span>
                <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-extrabold uppercase">
                  {statementFormat === 't_format' ? 'T-Account Dual Column' : 'Standard Tabular'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Party: <span className="text-blue-700 font-bold">{displayPartyName}</span> | Period: <span className="font-mono text-slate-800 font-semibold">{startDateStr} to {endDateStr}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Header Name Input */}
            <div className="flex items-center bg-slate-100 px-2 py-1 rounded-lg border border-slate-300 text-xs">
              <span className="text-[11px] font-bold text-slate-600 mr-1.5 whitespace-nowrap">Header:</span>
              <input
                type="text"
                value={headerTitle}
                onChange={(e) => setHeaderTitle(e.target.value)}
                placeholder="NCBL TRANSPORT"
                className="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 w-36 sm:w-44 focus:outline-none focus:ring-1 focus:ring-blue-600"
                title="Edit Header Name for PDF / Print"
              />
            </div>

            {/* Format Selector Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => {
                  setStatementFormat('t_format');
                  setOrientation('portrait');
                }}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded font-bold text-[11px] transition-colors ${
                  statementFormat === 't_format' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-700 hover:text-slate-900'
                }`}
                title="Indian Ledger Book T-Format (Credit Particulars vs Debit Particulars)"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>T-Format (Ledger Book)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatementFormat('tabular');
                  setOrientation('landscape');
                }}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded font-bold text-[11px] transition-colors ${
                  statementFormat === 'tabular' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-700 hover:text-slate-900'
                }`}
                title="Detailed Multi-Column Table"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Standard Table</span>
              </button>
            </div>

            {/* Page Orientation Selector */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2 py-1 rounded font-bold text-[11px] transition-colors ${
                  orientation === 'portrait' 
                    ? 'bg-slate-800 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-2 py-1 rounded font-bold text-[11px] transition-colors ${
                  orientation === 'landscape' 
                    ? 'bg-slate-800 text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Landscape
              </button>
            </div>

            {/* Sort Order Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => setSortOrder('old_first')}
                className={`px-2 py-1 rounded font-bold text-[11px] transition-colors ${
                  sortOrder === 'old_first'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Sort Oldest First (1 to 31)"
              >
                Old First
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('new_first')}
                className={`px-2 py-1 rounded font-bold text-[11px] transition-colors ${
                  sortOrder === 'new_first'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Sort Newest First (31 to 1)"
              >
                New First
              </button>
            </div>

            {statementFormat === 'tabular' && (
              <label className="flex items-center space-x-1.5 text-xs text-slate-700 font-semibold cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors select-none">
                <input
                  type="checkbox"
                  checked={showConsigneeName}
                  onChange={e => setShowConsigneeName(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Consignee</span>
              </label>
            )}

            <label className="flex items-center space-x-1.5 text-xs text-slate-700 font-semibold cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors select-none">
              <input
                type="checkbox"
                checked={showBankDetails}
                onChange={e => setShowBankDetails(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Bank Details</span>
            </label>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
            </button>
            
            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="flex items-center space-x-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white border border-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Download className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isGenerating ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="p-3 sm:p-5 overflow-auto bg-slate-100 flex justify-center">
          
          {/* Printable White Paper Container */}
          <div 
            ref={printRef}
            className={`bg-white text-slate-900 p-4 sm:p-8 rounded shadow-lg w-full ${orientation === 'landscape' ? 'max-w-[1120px]' : 'max-w-[840px]'} text-xs font-sans border border-slate-200 print:w-full print:max-w-none print:shadow-none print:border-none print:p-0 transition-all duration-200`}
            id="printable-party-ledger"
          >
            {/* Printable CSS overrides */}
            <style>{`
              @media print {
                @page { size: A4 ${orientation}; margin: 6mm; }
                html, body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  background: white !important;
                }
                #printable-party-ledger {
                  width: 100% !important;
                  max-width: 100% !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                }
                table {
                  width: 100% !important;
                  table-layout: fixed !important;
                  border-collapse: collapse !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                th, td {
                  word-break: break-word !important;
                  overflow-wrap: break-word !important;
                }
              }
            `}</style>

            {/* ========================================================================= */}
            {/* 1. T-FORMAT LEDGER STATEMENT (Exact Match to Uploaded NCPL Transport Photo) */}
            {/* ========================================================================= */}
            {statementFormat === 't_format' ? (
              <div className="text-slate-900 font-sans">
                {/* Center Company Header */}
                <div className="text-center pb-2">
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-slate-950">
                    {headerTitle || settings.companyName || 'NCBL TRANSPORT'}
                  </h1>
                </div>

                {/* Party Name & Date Range Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end text-xs font-bold border-b border-black pb-1 mb-1">
                  <div>
                    <div className="font-extrabold text-sm uppercase text-slate-950">
                      Account Statement For {displayPartyName}
                    </div>
                    <div className="text-xs text-slate-800 font-bold mt-0.5">
                      From {startDateStr} To {endDateStr}
                    </div>
                  </div>
                  <div className="text-right text-xs font-bold text-slate-900 mt-1 sm:mt-0 font-mono">
                    Page : 1
                  </div>
                </div>

                {/* Dual Column Layout: Left Column & Right Column */}
                <div className="grid grid-cols-2 gap-0 border-t border-black pt-1">
                  
                  {/* LEFT COLUMN */}
                  <div className="pr-4 border-r border-slate-300 flex flex-col justify-between">
                    <div>
                      {/* Column Header */}
                      <div className="font-bold text-xs pb-1 mb-2 border-b border-slate-400 text-slate-900">
                        {tFormatData.leftTitle}
                      </div>

                      {/* Entries List */}
                      <div className="space-y-3">
                        {tFormatData.leftItems.length === 0 ? (
                          <div className="text-slate-400 italic text-[11px] py-4 text-center">
                            No {tFormatData.leftTitle.toLowerCase()} recorded
                          </div>
                        ) : (
                          tFormatData.leftItems.map((item) => (
                            <div key={item.id} className="text-xs font-sans">
                              {/* Line 1: Amount Date VouType */}
                              <div className="flex items-center space-x-2 font-mono font-medium text-slate-900">
                                <span className="w-24 text-right shrink-0">{item.amount.toFixed(2)}</span>
                                <span className="text-slate-800">{item.date}</span>
                                <span className="font-semibold text-slate-900">{item.voucherType}</span>
                              </div>
                              {/* Line 2: Title & Details */}
                              <div className="pl-24 text-slate-900 font-bold uppercase text-[11px] leading-tight mt-0.5 space-y-0.5">
                                <div>{item.title}</div>
                                {item.vehicleNumber && (
                                  <div className="text-slate-950 font-bold text-[10px] tracking-wide">
                                    VEHICLE : {item.vehicleNumber}
                                  </div>
                                )}
                                {item.particulars && (
                                  <div className="text-slate-800 font-semibold text-[10px]">
                                    PARTICULARS : {item.particulars}
                                  </div>
                                )}
                                {(item.qtyWeight || (item.rate !== undefined && item.rate > 0)) && (
                                  <div className="text-slate-800 font-semibold text-[10px] flex flex-wrap gap-x-2">
                                    {item.qtyWeight && <span>QTY / WEIGHT : {item.qtyWeight}</span>}
                                    {item.rate !== undefined && item.rate > 0 && (
                                      <span>RATE (₹) : ₹{formatINR(item.rate, 2, 2)}</span>
                                    )}
                                  </div>
                                )}
                                {item.consignee && item.consignee !== item.shipTo && (
                                  <div className="text-slate-800 font-semibold text-[10px]">
                                    CONSIGNEE : {item.consignee}
                                  </div>
                                )}
                                {item.shipTo && (
                                  <div className="text-blue-800 font-bold text-[10px] tracking-tight">
                                    Ship To: <span className="uppercase text-slate-950 font-bold">{item.shipTo}</span>
                                  </div>
                                )}
                                {item.subtitle && (
                                  <div className="text-slate-600 font-normal text-[10px] uppercase">{item.subtitle}</div>
                                )}
                              </div>
                              {/* Line 3: Voucher Number */}
                              <div className="pl-24 text-slate-700 text-[11px] mt-0.5 font-mono">
                                {item.voucherNo}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Bottom Balancing Section for LEFT side */}
                    <div className="pt-4 mt-auto">
                      {tFormatData.closingBalanceSide === 'left' ? (
                        <>
                          <div className="border-t border-black pt-1 mt-2 text-right">
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {tFormatData.totalLeft.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-right font-bold text-xs py-0.5 text-slate-950 font-mono">
                            {tFormatData.closingBalanceText}
                          </div>
                          <div className="border-t border-black border-b-2 border-b-black py-0.5 mt-1 text-right">
                            <span className="font-mono text-xs font-black text-slate-950">
                              {tFormatData.grandTotal.toFixed(2)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="border-t-2 border-b-2 border-black py-0.5 mt-4">
                          <div className="text-left font-mono text-xs font-black text-slate-950 pl-2">
                            {tFormatData.grandTotal.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="pl-4 flex flex-col justify-between">
                    <div>
                      {/* Column Header */}
                      <div className="font-bold text-xs pb-1 mb-2 border-b border-slate-400 text-slate-900">
                        {tFormatData.rightTitle}
                      </div>

                      {/* Entries List */}
                      <div className="space-y-3">
                        {tFormatData.rightItems.length === 0 ? (
                          <div className="text-slate-400 italic text-[11px] py-4 text-center">
                            No {tFormatData.rightTitle.toLowerCase()} recorded
                          </div>
                        ) : (
                          tFormatData.rightItems.map((item) => (
                            <div key={item.id} className="text-xs font-sans">
                              {/* Line 1: Amount Date VouType */}
                              <div className="flex items-center space-x-2 font-mono font-medium text-slate-900">
                                <span className="w-24 text-right shrink-0">{item.amount.toFixed(2)}</span>
                                <span className="text-slate-800">{item.date}</span>
                                <span className="font-semibold text-slate-900">{item.voucherType}</span>
                              </div>
                              {/* Line 2: Title & Details */}
                              <div className="pl-24 text-slate-900 font-bold uppercase text-[11px] leading-tight mt-0.5 space-y-0.5">
                                <div>{item.title}</div>
                                {item.vehicleNumber && (
                                  <div className="text-slate-950 font-bold text-[10px] tracking-wide">
                                    VEHICLE : {item.vehicleNumber}
                                  </div>
                                )}
                                {item.particulars && (
                                  <div className="text-slate-800 font-semibold text-[10px]">
                                    PARTICULARS : {item.particulars}
                                  </div>
                                )}
                                {(item.qtyWeight || (item.rate !== undefined && item.rate > 0)) && (
                                  <div className="text-slate-800 font-semibold text-[10px] flex flex-wrap gap-x-2">
                                    {item.qtyWeight && <span>QTY / WEIGHT : {item.qtyWeight}</span>}
                                    {item.rate !== undefined && item.rate > 0 && (
                                      <span>RATE (₹) : ₹{formatINR(item.rate, 2, 2)}</span>
                                    )}
                                  </div>
                                )}
                                {item.consignee && item.consignee !== item.shipTo && (
                                  <div className="text-slate-800 font-semibold text-[10px]">
                                    CONSIGNEE : {item.consignee}
                                  </div>
                                )}
                                {item.shipTo && (
                                  <div className="text-blue-800 font-bold text-[10px] tracking-tight">
                                    Ship To: <span className="uppercase text-slate-950 font-bold">{item.shipTo}</span>
                                  </div>
                                )}
                                {item.subtitle && (
                                  <div className="text-slate-600 font-normal text-[10px] uppercase">{item.subtitle}</div>
                                )}
                              </div>
                              {/* Line 3: Voucher Number */}
                              <div className="pl-24 text-slate-700 text-[11px] mt-0.5 font-mono">
                                {item.voucherNo}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Bottom Balancing Section for RIGHT side */}
                    <div className="pt-4 mt-auto">
                      {tFormatData.closingBalanceSide === 'right' ? (
                        <>
                          <div className="border-t border-black pt-1 mt-2 text-right">
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {tFormatData.totalRight.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-right font-bold text-xs py-0.5 text-slate-950 font-mono">
                            {tFormatData.closingBalanceText}
                          </div>
                          <div className="border-t border-black border-b-2 border-b-black py-0.5 mt-1 text-right">
                            <span className="font-mono text-xs font-black text-slate-950">
                              {tFormatData.grandTotal.toFixed(2)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="border-t-2 border-b-2 border-black py-0.5 mt-4">
                          <div className="text-right font-mono text-xs font-black text-slate-950 pr-2">
                            {tFormatData.grandTotal.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Optional Bank Info & Footer */}
                {showBankDetails && (
                  <div className="mt-6 pt-3 border-t border-slate-300 grid grid-cols-2 gap-4 text-[10px]">
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="font-bold text-slate-800 uppercase block mb-0.5">Remittance / Bank Info</span>
                      <div>Bank: {settings.bankName || 'N/A'}</div>
                      <div>A/C: {settings.bankAccountNo || 'N/A'}</div>
                      <div>IFSC: {settings.bankIfsc || 'N/A'}</div>
                      {settings.upiId && <div>UPI: {settings.upiId}</div>}
                    </div>
                    <div className="text-right flex flex-col justify-end">
                      <div className="font-bold uppercase">For {headerTitle || settings.companyName || 'NCBL TRANSPORT'}</div>
                      <div className="pt-4">
                        <div className="border-b border-slate-400 w-32 ml-auto mb-1"></div>
                        <span className="text-[9px] text-slate-500 uppercase">Authorized Signatory</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ========================================================================= */
              /* 2. STANDARD DETAILED TABULAR STATEMENT (Multi-Column Detailed Route & Tax) */
              /* ========================================================================= */
              <div>
                {/* Document Header */}
                <div className="border-b-2 border-slate-800 pb-3 mb-3 flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Truck className="w-6 h-6 text-blue-700 shrink-0" />
                      <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900">
                        {settings.companyName || 'NCBL TRANSPORT'}
                      </h1>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 max-w-md">
                      {settings.address}, {settings.city}, {settings.state} - {settings.pincode}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Phone: {settings.phone} | Email: {settings.email}
                    </p>
                    <p className="text-[10px] text-slate-800 font-mono font-bold mt-0.5">
                      GSTIN: {settings.gstin} | State Code: {settings.stateCode || (settings.gstin ? settings.gstin.substring(0, 2) : '24')}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="bg-slate-900 text-white font-extrabold px-3 py-1 text-xs rounded uppercase tracking-wider inline-block">
                      PARTY LEDGER STATEMENT
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                      Generated On: <span className="font-bold text-slate-800">{formattedToday}</span>
                    </p>
                    {(startDate || endDate) && (
                      <p className="text-[10px] text-blue-700 font-bold mt-0.5">
                        Period: {startDateStr} to {endDateStr}
                      </p>
                    )}
                  </div>
                </div>

                {/* Consignor / Party Info Block */}
                <div className="bg-slate-50 border border-slate-300 rounded p-3 mb-3 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Statement For Account:</span>
                    <h2 className="text-sm font-black text-slate-900 mt-0.5">{displayPartyName}</h2>
                    <p className="text-[11px] text-slate-700">{party.address}</p>
                    <p className="text-[11px] text-slate-700">{party.city}, {party.state}</p>
                  </div>

                  <div className="text-right text-[11px] space-y-0.5">
                    <div>
                      <span className="text-slate-500">Group:</span>{' '}
                      <span className="font-bold text-slate-900">
                        {isTransporterOrCreditor
                          ? 'Sundry Creditors'
                          : 'Sundry Debtors'}
                      </span>
                    </div>
                    <div><span className="text-slate-500">GSTIN:</span> <span className="font-mono font-bold text-slate-900">{party.gstin || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Contact:</span> <span className="font-bold text-slate-900">{party.phone || 'N/A'}</span></div>
                    <div><span className="text-slate-500">State Code:</span> <span className="font-mono font-bold text-slate-800">{party.stateCode || '27'}</span></div>
                  </div>
                </div>

                {/* Financial Summary Strip */}
                <div className="grid grid-cols-5 gap-1.5 mb-3 text-center">
                  <div className="bg-slate-100 border border-slate-300 p-1.5 rounded">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block">Opening Bal</span>
                    <span className="text-xs font-mono font-bold text-slate-900"><span className="text-slate-500 mr-1">{openingBalanceForPeriod >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(openingBalanceForPeriod))}</span>
                  </div>
                  <div className="bg-slate-100 border border-slate-300 p-1.5 rounded">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block">Basic Freight</span>
                    <span className="text-xs font-mono font-bold text-slate-800">₹{formatINR(totalBasic)}</span>
                  </div>
                  <div className="bg-slate-100 border border-slate-300 p-1.5 rounded">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block">Total Freight Billed</span>
                    <span className="text-xs font-mono font-bold text-blue-700">₹{formatINR(totalBilled)}</span>
                  </div>
                  <div className="bg-slate-100 border border-slate-300 p-1.5 rounded">
                    <span className="text-[8.5px] font-bold text-slate-500 uppercase block">Total Credit</span>
                    <span className="text-xs font-mono font-bold text-emerald-700">₹{formatINR(totalReceived)}</span>
                  </div>
                  <div className="bg-slate-900 text-white p-1.5 rounded">
                    <span className="text-[8.5px] font-bold text-blue-200 uppercase block">Closing Amount</span>
                    <span className="text-xs font-mono font-black"><span className="text-slate-500 mr-1">{closingBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(closingBalance))}</span>
                  </div>
                </div>

                {/* Ledger Transactions Table */}
                <div className="border border-slate-300 rounded overflow-hidden mb-4">
                  <table className="w-full text-[9px] text-left border-collapse table-fixed">
                    <colgroup>
                      <col style={{ width: showConsigneeName ? '8.5%' : '9%' }} />
                      {showConsigneeName && <col style={{ width: '11%' }} />}
                      <col style={{ width: showConsigneeName ? '9.5%' : '12%' }} />
                      <col style={{ width: showConsigneeName ? '8.5%' : '10%' }} />
                      <col style={{ width: showConsigneeName ? '7.5%' : '8%' }} />
                      <col style={{ width: showConsigneeName ? '8%' : '8.5%' }} />
                      <col style={{ width: showConsigneeName ? '9%' : '9.5%' }} />
                      <col style={{ width: showConsigneeName ? '4.5%' : '5%' }} />
                      <col style={{ width: showConsigneeName ? '4.5%' : '5%' }} />
                      <col style={{ width: showConsigneeName ? '9.5%' : '11%' }} />
                      <col style={{ width: showConsigneeName ? '9.5%' : '11%' }} />
                      <col style={{ width: showConsigneeName ? '10%' : '11%' }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-900 text-white uppercase text-[8px] font-bold">
                        <th className="p-1 border-r border-slate-700 whitespace-nowrap">Date/Inv #</th>
                        {showConsigneeName && <th className="p-1 border-r border-slate-700">Consignee</th>}
                        <th className="p-1 border-r border-slate-700">Route</th>
                        <th className="p-1 border-r border-slate-700">Vehicle/Item</th>
                        <th className="p-1 border-r border-slate-700 text-right whitespace-nowrap">Qty/Wt</th>
                        <th className="p-1 border-r border-slate-700 text-right whitespace-nowrap">Rate</th>
                        <th className="p-1 border-r border-slate-700 text-right whitespace-nowrap">Basic (₹)</th>
                        <th className="p-1 border-r border-slate-700 text-right whitespace-nowrap">Tax (₹)</th>
                        <th className="p-1 border-r border-slate-700 text-right whitespace-nowrap">TDS (₹)</th>
                        <th className="p-1 border-r border-slate-700 text-right whitespace-nowrap">Debit (Dr)</th>
                        <th className="p-1 border-r border-slate-700 text-right whitespace-nowrap">Credit (Cr)</th>
                        <th className="p-1 text-right whitespace-nowrap">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {/* Opening Balance Row */}
                      <tr className="bg-slate-100 font-bold text-[9px]">
                        <td className="p-1 border-r font-mono text-slate-500 whitespace-nowrap">—</td>
                        <td colSpan={showConsigneeName ? 8 : 7} className="p-1.5 border-r font-bold text-slate-800 uppercase tracking-wide">
                          Opening Balance Carried Forward
                        </td>
                        <td className="p-1 border-r text-right font-mono text-slate-400 whitespace-nowrap">—</td>
                        <td className="p-1 border-r text-right font-mono text-slate-400 whitespace-nowrap">—</td>
                        <td className="p-1 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                          <span className="text-slate-500 text-[7.5px] font-bold mr-0.5">{openingBalanceForPeriod >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(openingBalanceForPeriod))}
                        </td>
                      </tr>

                      {displayedLedgerRows.length === 0 ? (
                        <tr>
                          <td colSpan={showConsigneeName ? 12 : 11} className="p-4 text-center text-slate-500 italic">
                            No transactions recorded for this period.
                          </td>
                        </tr>
                      ) : (
                        displayedLedgerRows.map((row, idx) => (
                          <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            {/* Date & Inv # */}
                            <td className="p-1 border-r font-mono text-slate-800 text-[8.5px] leading-tight whitespace-nowrap overflow-hidden">
                              <div className="font-bold">{row.date}</div>
                              <div className="text-blue-900 font-extrabold">{row.referenceNo}</div>
                            </td>

                            {row.type === 'invoice' ? (
                              <>
                                {/* Consignee & Ship To (Receiver at Destination) */}
                                {showConsigneeName && (
                                  <td className="p-1 border-r text-slate-900 font-semibold text-[8.5px] leading-tight overflow-hidden">
                                    <div>
                                      <div className="font-bold text-slate-900 truncate" title={row.consigneeName}>
                                        {row.consigneeName || '—'}
                                      </div>
                                      {(row.shipToName || row.shipToAddress) && (
                                        <div className="text-[7.5px] text-blue-900 font-semibold truncate mt-0.5" title={`${row.shipToName} ${row.shipToAddress ? '(' + row.shipToAddress + ')' : ''}`}>
                                          <span className="text-blue-700 font-extrabold">Ship To:</span> {row.shipToName || row.shipToAddress}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                )}
                                {/* Route (Origin City to Destination City) */}
                                <td className="p-1 border-r text-slate-800 text-[8.5px] leading-tight overflow-hidden">
                                  <div className="font-bold text-slate-900 truncate">
                                    <span>{row.origin}</span>{' '}
                                    <span className="text-blue-700 font-black">➔</span>{' '}
                                    <span>{row.destination}</span>
                                  </div>
                                </td>
                                {/* Vehicle No & Material / Goods */}
                                <td className="p-1 border-r text-slate-800 text-[8.5px] leading-tight overflow-hidden">
                                  <div>
                                    <div className="font-mono font-bold text-slate-900 truncate">{row.vehicleNumber || '—'}</div>
                                    <div className="text-slate-600 text-[7.5px] truncate">{row.materialType || 'General'}</div>
                                  </div>
                                </td>
                                {/* Qty / Weight */}
                                <td className="p-1 border-r text-right font-mono text-slate-800 font-semibold text-[8.5px] whitespace-nowrap overflow-hidden">
                                  {row.qtyWeight || '—'}
                                </td>
                                {/* Rate */}
                                <td className="p-1 border-r text-right font-mono text-slate-800 font-semibold text-[8.5px] whitespace-nowrap overflow-hidden">
                                  {row.rate ? `₹${formatINR(row.rate)}` : '—'}
                                </td>
                                {/* Basic Amount */}
                                <td className="p-1 border-r text-right font-mono text-slate-800 font-semibold text-[8.5px] whitespace-nowrap overflow-hidden">
                                  {row.basicAmount ? `₹${formatINR(row.basicAmount)}` : '—'}
                                </td>
                                {/* Tax Amount */}
                                <td className="p-1 border-r text-right font-mono text-slate-700 text-[8.5px] whitespace-nowrap overflow-hidden">
                                  {row.taxAmount && row.taxAmount > 0 ? (
                                    <span className="font-semibold text-slate-900">₹{formatINR(row.taxAmount)}</span>
                                  ) : (
                                    <span className="text-slate-400 text-[7.5px]">₹0</span>
                                  )}
                                </td>
                                {/* TDS Amount */}
                                <td className="p-1 border-r text-right font-mono text-slate-700 text-[8.5px] whitespace-nowrap overflow-hidden">
                                  {row.tdsAmount && row.tdsAmount > 0 ? (
                                    <span className="font-semibold text-slate-900">₹{formatINR(row.tdsAmount)}</span>
                                  ) : (
                                    <span className="text-slate-400 text-[7.5px]">₹0</span>
                                  )}
                                </td>
                              </>
                            ) : (
                              <td colSpan={showConsigneeName ? 8 : 7} className="p-1 border-r text-slate-700 text-[8.5px] leading-relaxed whitespace-normal">
                                <span className="text-emerald-700 font-bold block mb-0.5">Payment</span>
                                <span className="italic text-slate-600">{row.description}</span>
                              </td>
                            )}
                            {/* Total / Debit */}
                            <td className="p-1 border-r text-right font-mono font-bold text-slate-900 text-[8.5px] whitespace-nowrap overflow-hidden">
                              {row.debit > 0 ? `₹${formatINR(row.debit)}` : '—'}
                            </td>

                            {/* Credit / Paid */}
                            <td className="p-1 border-r text-right font-mono font-bold text-emerald-700 text-[8.5px] whitespace-nowrap overflow-hidden">
                              {row.credit > 0 ? `₹${formatINR(row.credit)}` : '—'}
                            </td>

                            {/* Balance */}
                            <td className="p-1 text-right font-mono font-black text-slate-900 text-[8.5px] whitespace-nowrap overflow-hidden">
                              <span className="text-slate-500 text-[7px] font-bold mr-0.5">{row.runningBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(row.runningBalance))}
                            </td>
                          </tr>
                        ))
                      )}
                    
                      <tr className="bg-slate-200 font-bold border-t border-slate-300 text-slate-900 text-[9.5px]">
                        <td colSpan={showConsigneeName ? 11 : 10} className="p-1.5 text-right uppercase tracking-wider font-extrabold text-blue-900 whitespace-nowrap">
                          Closing Balance Carried Forward:
                        </td>
                        <td className="p-1 text-right font-mono font-black text-blue-900 text-[10px] whitespace-nowrap">
                          <span className="text-slate-600 text-[7.5px] font-bold mr-0.5">{closingBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(closingBalance))}
                        </td>
                      </tr>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900 text-[9px]">
                        <td colSpan={showConsigneeName ? 6 : 5} className="p-1.5 text-right uppercase text-[8.5px] tracking-wider font-extrabold whitespace-nowrap">
                          Statement Period Totals:
                        </td>
                        <td className="p-1 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                          ₹{formatINR(totalBasic)}
                        </td>
                        <td className="p-1 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                          ₹{formatINR(totalTax)}
                        </td>
                        <td className="p-1 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                          ₹{formatINR(totalTds)}
                        </td>
                        <td className="p-1 text-right font-mono font-black text-blue-900 whitespace-nowrap">
                          ₹{formatINR(totalBilled)}
                        </td>
                        <td className="p-1 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                          ₹{formatINR(totalReceived)}
                        </td>
                        <td className="p-1 text-right font-mono font-black text-slate-950 text-[10px] whitespace-nowrap">
                          <span className="text-slate-500 text-[7.5px] font-bold mr-0.5">{closingBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(closingBalance))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer Bank Info & Signature */}
                <div className={`grid ${showBankDetails ? 'grid-cols-2' : 'grid-cols-1'} gap-4 border-t border-slate-300 pt-3 text-[10px]`}>
                  {/* Payment Details */}
                  {showBankDetails && (
                    <div className="bg-slate-50 border border-slate-200 rounded p-2">
                      <span className="font-bold text-slate-800 uppercase block mb-0.5">REMITTANCE & BANK PAYMENT INFO</span>
                      <div className="space-y-0.5 text-slate-700">
                        <div><span className="font-semibold">Bank Name:</span> {settings.bankName || 'N/A'}</div>
                        <div><span className="font-semibold">Account No:</span> <span className="font-mono font-bold">{settings.bankAccountNo || 'N/A'}</span></div>
                        <div><span className="font-semibold">IFSC Code:</span> <span className="font-mono font-bold text-blue-700">{settings.bankIfsc || 'N/A'}</span></div>
                        {settings.upiId && <div><span className="font-semibold">UPI VPA:</span> <span className="font-mono font-bold">{settings.upiId}</span></div>}
                      </div>
                    </div>
                  )}

                  {/* Company Stamp & Signature */}
                  <div className="text-right flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-slate-900 uppercase">For {settings.companyName || 'NCBL TRANSPORT'}</span>
                    </div>
                    <div className="pt-6">
                      <div className="border-b border-slate-400 w-36 ml-auto mb-1"></div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Authorized Signatory</span>
                    </div>
                  </div>
                </div>

                {/* Footer attribution */}
                <div className="mt-3 pt-2 border-t border-slate-200 text-center text-[9px] font-mono text-slate-400 flex items-center justify-between">
                  <span>NCBL TRANSPORT LOGISTICS SYSTEM</span>
                  <span className="font-bold text-blue-700">Design By Azazmadkiya</span>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};


