import React, { useState, useMemo } from 'react';
import { Party, Invoice, LedgerEntry, CompanySettings, PaymentRecord, AccountGroup, PartyAccountCategory, formatINR, INDIAN_STATES } from '../types';
import { 
  Users, Plus, Download, Printer, ArrowUpRight, ArrowDownLeft, FileText, Search, Building2, Edit, Trash2, Wallet, ChevronLeft, ChevronRight, CheckCircle2, ShieldCheck, Tag, Columns, LayoutGrid, User 
} from 'lucide-react';
import { PartyLedgerPrintModal } from './PartyLedgerPrintModal';
import { DirectPartyPaymentModal } from './DirectPartyPaymentModal';
import { PartyTaxBillModal } from './PartyTaxBillModal';

import { UserRole } from '../types';

interface PartyLedgerViewProps {
  userRole?: UserRole;
  categoryFilter?: 'transporter' | 'party' | 'all';
  parties: Party[];
  invoices: Invoice[];
  settings?: CompanySettings;
  onAddParty: (party: Party) => void;
  onEditParty?: (party: Party) => void;
  onDeleteParty?: (partyId: string) => void;
  onRecordPaymentModal: (partyId: string) => void;
  onAddPayment?: (invoice: Invoice, payment: PaymentRecord) => void;
  onSaveInvoice?: (invoice: Invoice) => void;
  onCreateNewInvoice?: (partyId?: string) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
  onEditPayment?: (invoice: Invoice, payment: any) => void;
  onDeletePayment?: (invoice: Invoice, paymentId: string) => void;
}

export const PartyLedgerView: React.FC<PartyLedgerViewProps> = ({
  userRole = 'admin',
  categoryFilter = 'party',
  parties,
  invoices,
  settings,
  onAddParty,
  onEditParty,
  onDeleteParty,
  onRecordPaymentModal,
  onAddPayment,
  onSaveInvoice,
  onCreateNewInvoice,
  onEditInvoice,
  onDeleteInvoice
}) => {
  // Filter parties based on categoryFilter (transporter vs regular party)
  const categoryParties = useMemo(() => {
    if (categoryFilter === 'transporter') {
      return parties.filter(p => p.accountCategory === 'transporter' || p.partyType === 'transporter');
    }
    if (categoryFilter === 'party') {
      return parties.filter(p => 
        p.accountCategory !== 'transporter' &&
        p.partyType !== 'transporter'
      );
    }
    return parties;
  }, [parties, categoryFilter]);

  const [selectedPartyId, setSelectedPartyId] = useState<string>(() => {
    return categoryParties[0]?.id || '';
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [accountGroupFilter, setAccountGroupFilter] = useState<'all' | 'sundry_debtors' | 'sundry_creditors'>('all');
  const [viewMode, setViewMode] = useState<'standard' | 't_format'>('t_format');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'old_first' | 'new_first'>('old_first');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Modals
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDirectPaymentModal, setShowDirectPaymentModal] = useState(false);
  const [showTaxBillModal, setShowTaxBillModal] = useState(false);
  const [taxBillType, setTaxBillType] = useState<'income' | 'expense'>('income');
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [newName, setNewName] = useState('');
  const [newPartyUser, setNewPartyUser] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('Maharashtra');
  const [newStateCode, setNewStateCode] = useState('27');
  const [newAddress, setNewAddress] = useState('');
  const [newOpeningBal, setNewOpeningBal] = useState(0);
  const [newAccountCategory, setNewAccountCategory] = useState<PartyAccountCategory>(
    categoryFilter === 'transporter' ? 'transporter' : 'party'
  );
  const [newAccountGroup, setNewAccountGroup] = useState<AccountGroup>(
    categoryFilter === 'transporter' ? 'sundry_creditors' : 'sundry_debtors'
  );

  // Keep selected party synced with current category filter
  React.useEffect(() => {
    if (!categoryParties.some(p => p.id === selectedPartyId)) {
      if (categoryParties.length > 0) {
        setSelectedPartyId(categoryParties[0].id);
      } else {
        setSelectedPartyId('');
      }
    }
  }, [categoryParties, selectedPartyId]);

  const selectedParty = useMemo(() => {
    if (categoryParties.length === 0) return null;
    return categoryParties.find(p => p.id === selectedPartyId) || categoryParties[0];
  }, [categoryParties, selectedPartyId]);

  // Pre-aggregate balance for ALL parties in a single O(N) pass
  const partyBalancesMap = useMemo(() => {
    const map = new Map<string, number>();
    const partyNameLookup = new Map<string, string>(); // lowercase name -> partyId

    parties.forEach(p => {
      map.set(p.id, Number(p.openingBalance) || 0);
      if (p.name) {
        partyNameLookup.set(p.name.toLowerCase().trim(), p.id);
      }
    });

    invoices.forEach(inv => {
      const net = Number(inv.netPayable ?? inv.grandTotal ?? 0);
      let received = 0;
      if (inv.payments && inv.payments.length > 0) {
        for (let i = 0; i < inv.payments.length; i++) {
          received += Number(inv.payments[i].amount || 0);
        }
      }

      let targetPartyId = inv.partyId;
      if (!targetPartyId && inv.consignorName) {
        targetPartyId = partyNameLookup.get(inv.consignorName.toLowerCase().trim());
      }
      if (!targetPartyId && inv.consigneeName) {
        targetPartyId = partyNameLookup.get(inv.consigneeName.toLowerCase().trim());
      }

      if (targetPartyId && map.has(targetPartyId)) {
        map.set(targetPartyId, (map.get(targetPartyId) || 0) + net - received);
      }
    });

    return map;
  }, [parties, invoices]);

  // Filtered party list for search & account group
  const filteredParties = useMemo(() => {
    let list = categoryParties;
    
    // Group filter (Sundry Debtors vs Sundry Creditors) for Party view
    if (categoryFilter === 'party' && accountGroupFilter !== 'all') {
      list = list.filter(p => {
        const group = p.accountGroup || (p.accountCategory === 'transporter' || p.partyType === 'transporter' ? 'sundry_creditors' : 'sundry_debtors');
        return group === accountGroupFilter;
      });
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    return list.filter(p => 
      p.name.toLowerCase().includes(term) || 
      (p.city && p.city.toLowerCase().includes(term)) ||
      (p.gstin && p.gstin.toLowerCase().includes(term))
    );
  }, [categoryParties, searchTerm, categoryFilter, accountGroupFilter]);

  // Calculate Ledger Entries for selected party
  const partyInvoices = useMemo(() => {
    if (!selectedParty) return [];
    const partyNameLower = selectedParty.name ? selectedParty.name.toLowerCase().trim() : '';
    return invoices.filter(inv => {
      if (inv.partyId === selectedParty.id) return true;
      if (partyNameLower) {
        if (inv.consignorName && inv.consignorName.toLowerCase().trim() === partyNameLower) return true;
        if (inv.consigneeName && inv.consigneeName.toLowerCase().trim() === partyNameLower) return true;
        if (inv.dispatchedPartyName && inv.dispatchedPartyName.toLowerCase().trim() === partyNameLower) return true;
        if ((inv as any).transporterName && (inv as any).transporterName.toLowerCase().trim() === partyNameLower) return true;
        if ((inv as any).transporterId === selectedParty.id) return true;
      }
      return false;
    });
  }, [invoices, selectedParty]);

  const isTransporterOrCreditor = selectedParty?.accountGroup === 'sundry_creditors' || 
    selectedParty?.accountCategory === 'transporter' || 
    selectedParty?.partyType === 'transporter';

  // Generate running ledger list from invoices & payment records
  const { rawEntries, openingBalanceForPeriod, filteredEntries, ledgerRows, totalBilled, totalReceived, netOutstanding, paymentMap } = useMemo(() => {
    const raw: {
      id: string;
      date: string;
      type: 'invoice' | 'payment';
      billCategory?: 'freight' | 'income' | 'expense' | 'sales' | 'purchase';
      invoiceRef?: Invoice;
      referenceNo: string;
      description: string;
      qtyWeight?: string;
      rate?: number;
      tdsAmount?: number;
      debit: number;
      credit: number;
    }[] = [];

    // Group payments so they show as direct lump sum / transaction entries without bill breakdown
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
      const isIncome = inv.billCategory === 'income';
      const isExpense = inv.billCategory === 'expense';
      const isCreditExpense = isExpense && inv.ledgerImpact !== 'debit';
      const billKasarText = inv.kasarDeduction && inv.kasarDeduction > 0 ? ` [Bill Kasar: ₹${formatINR(inv.kasarDeduction)}]` : '';
      const taxTag = inv.taxSlab ? ` [GST ${inv.taxSlab}%: ₹${formatINR(inv.totalTax || 0)}]` : '';

      let desc = `Freight (${inv.origin} ➔ ${inv.destination}) - Vehicle: ${inv.vehicleNumber}${inv.shipToName ? ' | Ship To: ' + inv.shipToName : ''}${billKasarText}`;
      if (isIncome) {
        desc = `${inv.items?.[0]?.description || 'Transportation / Freight Services'}${inv.vehicleNumber && inv.vehicleNumber !== 'Direct/Logistics' ? ' - Vehicle: ' + inv.vehicleNumber : ''}${inv.destination ? ' (' + inv.origin + ' ➔ ' + inv.destination + ')' : ''}${taxTag}${billKasarText}`;
      } else if (isExpense) {
        desc = `${inv.items?.[0]?.description || inv.expenseCategory || 'Transport Expense'}${inv.vehicleNumber && inv.vehicleNumber !== 'Direct/Logistics' ? ' - Vehicle: ' + inv.vehicleNumber : ''}${taxTag}${billKasarText}`;
      }

      const entryDebit = isCreditExpense ? 0 : inv.netPayable;
      const entryCredit = isCreditExpense ? inv.netPayable : 0;

      raw.push({
        id: `inv-${inv.id}`,
        date: inv.invoiceDate,
        type: 'invoice',
        billCategory: inv.billCategory,
        invoiceRef: inv,
        referenceNo: inv.invoiceNumber,
        description: desc,
        qtyWeight: inv.items && inv.items.length > 0 
          ? (() => {
              const it = inv.items[0];
              const u = (it.unit || 'Tons').trim();
              const q = it.quantity > 0 ? it.quantity : (it.weightTons && it.weightTons > 0 ? it.weightTons : 0);
              if (u.toLowerCase() === 'fixed') return 'Fixed Rate';
              if (q > 0) return `${q} ${u}`;
              if (it.packagesCount && it.packagesCount > 0) return `${it.packagesCount} Pkgs`;
              return '—';
            })()
          : '—',
        rate: inv.items && inv.items.length > 0 ? (inv.items[0].ratePerTon || 0) : 0,
        tdsAmount: inv.tdsAmount || 0,
        debit: entryDebit,
        credit: entryCredit
      });

      // Accumulate Payment Entries against invoice
      (inv.payments || []).forEach(p => {
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
    });

    // Convert grouped payments into raw entries
    paymentMap.forEach((pGroup) => {
      const notesArray = Array.from(pGroup.notesSet).filter(n => n.length > 0);
      const combinedNotes = notesArray.join(' | ');
      const kasarText = pGroup.kasarAmount > 0 ? ` [Includes Kasar/Discount: ₹${formatINR(pGroup.kasarAmount)}]` : '';

      raw.push({
        id: `pay-${pGroup.id}`,
        date: pGroup.date,
        type: 'payment',
        referenceNo: pGroup.referenceNo,
        description: isTransporterOrCreditor 
          ? `Payment to Transporter (${pGroup.mode})${combinedNotes ? ' - ' + combinedNotes : ''}${kasarText}`
          : `Payment received (${pGroup.mode})${combinedNotes ? ' - ' + combinedNotes : ''}${kasarText}`,
        debit: 0,
        credit: (pGroup.amount + pGroup.kasarAmount)
      });
    });

    // Sort chronological for baseline calculation
    raw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate opening balance prior to startDate
    const priorEntries = raw.filter(e => startDate && e.date.substring(0, 10) < startDate.substring(0, 10));
    const priorDebit = priorEntries.reduce((acc, r) => acc + r.debit, 0);
    const priorCredit = priorEntries.reduce((acc, r) => acc + r.credit, 0);
    const openingBal = (selectedParty ? Number(selectedParty.openingBalance) || 0 : 0) + priorDebit - priorCredit;

    // Filter by date range if specified
    const filtered = raw.filter(e => {
      if (startDate && e.date.substring(0, 10) < startDate.substring(0, 10)) return false;
      if (endDate && e.date.substring(0, 10) > endDate.substring(0, 10)) return false;
      return true;
    });

    // Compute running balances starting from openingBal
    let currentBal = openingBal;
    const rows = filtered.map(entry => {
      currentBal = currentBal + entry.debit - entry.credit;
      return {
        ...entry,
        runningBalance: currentBal
      };
    });

    const billed = rows.reduce((acc, r) => acc + r.debit, 0);
    const received = rows.reduce((acc, r) => acc + r.credit, 0);
    const net = openingBal + billed - received;

    return {
      rawEntries: raw,
      openingBalanceForPeriod: openingBal,
      filteredEntries: filtered,
      ledgerRows: rows,
      totalBilled: billed,
      totalReceived: received,
      netOutstanding: net,
      paymentMap
    };
  }, [partyInvoices, startDate, endDate, selectedParty, isTransporterOrCreditor]);

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

  // Live T-Format (NCPL Style) data structure with standard Debit (Left) & Credit (Right) and Old First / New First sorting
  const tFormatData = useMemo(() => {
    interface TItem {
      id: string;
      rawDate: string;
      date: string;
      voucherType: string;
      amount: number;
      title: string;
      vehicleNumber?: string;
      particulars?: string;
      qtyWeight?: string;
      rate?: number;
      consignee?: string;
      shipTo?: string;
      subtitle?: string;
      voucherNo: string;
      isOpening?: boolean;
    }

    const leftItems: TItem[] = [];  // DEBIT (DR.)
    const rightItems: TItem[] = []; // CREDIT (CR.)

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

      // Debit side: Freight Bill / Invoice
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

      // Credit side: TDS Deduction (Section 194C)
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

      // Credit side: Cash Advance Paid
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

      // Credit side: Diesel / Fuel Issued
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

    // 3. Payment entries (Credit Side)
    if (paymentMap) {
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
    }

    // Apply Sorting (Old First vs New First) to left and right items
    const sortTItems = (items: TItem[]) => {
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
    const grandTotal = Math.max(totalLeft, totalRight);

    // Closing Balance Balancing:
    // If totalLeft (Debit) > totalRight (Credit): Balance is Debit Balance, placed on Right (Credit) side: "By Balance c/d (Dr. Balance)"
    // If totalRight (Credit) > totalLeft (Debit): Balance is Credit Balance, placed on Left (Debit) side: "To Balance c/d (Cr. Balance)"
    const diff = totalLeft - totalRight;
    const isDrBalance = diff > 0;
    const balanceAmount = Math.abs(diff);

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

  // Apply display sorting (Old First vs New First)
  const displayedLedgerRows = useMemo(() => {
    const copy = [...ledgerRows];
    copy.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (sortOrder === 'new_first') {
        return timeB - timeA;
      }
      return timeA - timeB;
    });
    return copy;
  }, [ledgerRows, sortOrder]);

  // Paginate displayed rows
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(displayedLedgerRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return displayedLedgerRows;
    const start = (currentPage - 1) * pageSize;
    return displayedLedgerRows.slice(start, start + pageSize);
  }, [displayedLedgerRows, currentPage, pageSize]);

  const handleOpenAddModal = () => {
    setNewName('');
    setNewPartyUser('');
    setNewGstin('');
    setNewPhone('');
    setNewCity('');
    setNewState('Maharashtra');
    setNewStateCode('27');
    setNewAddress('');
    setNewOpeningBal(0);
    const isTransporter = categoryFilter === 'transporter';
    setNewAccountCategory(isTransporter ? 'transporter' : 'party');
    setNewAccountGroup(isTransporter ? 'sundry_creditors' : 'sundry_debtors');
    setShowAddPartyModal(true);
  };

  const handleOpenEditModal = (p: Party) => {
    setEditingParty(p);
    setNewName(p.name || '');
    setNewPartyUser(p.partyUser || '');
    setNewGstin(p.gstin || '');
    setNewPhone(p.phone || '');
    setNewCity(p.city || '');
    setNewState(p.state || 'Maharashtra');
    setNewStateCode(p.stateCode || '27');
    setNewAddress(p.address || '');
    setNewOpeningBal(p.openingBalance || 0);
    const isTransporter = p.accountCategory === 'transporter' || p.partyType === 'transporter';
    setNewAccountCategory(p.accountCategory || (isTransporter ? 'transporter' : 'party'));
    setNewAccountGroup(p.accountGroup || (isTransporter ? 'sundry_creditors' : 'sundry_debtors'));
  };

  const handleSaveNewParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const finalAccountGroup: AccountGroup = newAccountCategory === 'transporter' ? 'sundry_creditors' : newAccountGroup;

    const newParty: Party = {
      id: `pty-${Date.now()}`,
      name: newName.trim(),
      partyUser: newPartyUser.trim(),
      gstin: newGstin.trim().toUpperCase(),
      phone: newPhone.trim(),
      city: newCity.trim() || 'Pune',
      state: newState.trim() || 'Maharashtra',
      stateCode: newStateCode.trim() || '27',
      address: newAddress.trim(),
      partyType: newAccountCategory === 'transporter' ? 'transporter' : 'consignor',
      accountCategory: newAccountCategory,
      accountGroup: finalAccountGroup,
      openingBalance: Number(newOpeningBal),
      currentBalance: Number(newOpeningBal),
      createdAt: new Date().toISOString()
    };

    onAddParty(newParty);
    setSelectedPartyId(newParty.id);
    setShowAddPartyModal(false);
    setNewName('');
    setNewPartyUser('');
    setNewGstin('');
    setNewPhone('');
    setNewCity('');
    setNewAddress('');
    setNewOpeningBal(0);
  };

  // Handle safe delete party click with confirmation & auto selection of next party
  const handleDeletePartyClick = (partyId: string, partyName?: string) => {
    if (!onDeleteParty) return;
    const name = partyName || selectedParty?.name || 'this party';
    if (window.confirm(`Are you sure you want to delete "${name}"? This party profile and its ledger account will be removed.`)) {
      const remainingParties = categoryParties.filter(p => p.id !== partyId);
      if (selectedPartyId === partyId) {
        setSelectedPartyId(remainingParties[0]?.id || '');
      }
      if (editingParty?.id === partyId) {
        setEditingParty(null);
      }
      onDeleteParty(partyId);
    }
  };

  const handlePrintLedger = () => {
    setShowPrintModal(true);
  };

  const isTransporterView = categoryFilter === 'transporter';

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            {isTransporterView ? (
              <Building2 className="w-4 h-4 text-blue-700" />
            ) : (
              <Users className="w-4 h-4 text-blue-700" />
            )}
            <span>
              {isTransporterView 
                ? 'Transporter Party Ledgers' 
                : 'Party Ledgers (Statements)'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isTransporterView 
              ? 'Complete debit/credit transaction statement, freight vouchers & running balance for Transporter accounts.' 
              : 'Complete debit/credit transaction statement, transport freight bills, receipts & running balance for Party accounts.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Transporter View: Create New Transport Invoice */}
          {isTransporterView && ['admin', 'accountant'].includes(userRole) && (
            <button
              onClick={() => {
                if (onCreateNewInvoice) {
                  onCreateNewInvoice(selectedParty?.id);
                }
              }}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs"
              title="Create New Transport Freight Invoice"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>+ Create Transport Invoice</span>
            </button>
          )}

          {['admin', 'accountant'].includes(userRole) && (
            <button
              onClick={handleOpenAddModal}
              className={`flex items-center space-x-1 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs ${
                isTransporterView ? 'bg-purple-700 hover:bg-purple-800' : 'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isTransporterView ? 'Add New Transporter' : 'Add New Party'}</span>
            </button>
          )}

          {selectedParty && (
            <button
              onClick={handlePrintLedger}
              className="flex items-center space-x-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-blue-700" />
              <span>Print Statement</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Party Selector Sidebar + Ledger Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Left Column: Party Search & List */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-xs">
          <div className="flex justify-between items-center">
            <span className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              {isTransporterView ? 'Transporters (Creditors)' : 'Select Party'}
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
              {filteredParties.length}
            </span>
          </div>

          {/* Group Filter Tabs (Only in Party Ledgers view) */}
          {!isTransporterView && (
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded border border-slate-200 text-[10px]">
              <button
                type="button"
                onClick={() => setAccountGroupFilter('all')}
                className={`py-1 rounded font-bold transition-all text-center ${
                  accountGroupFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({categoryParties.length})
              </button>
              <button
                type="button"
                onClick={() => setAccountGroupFilter('sundry_debtors')}
                className={`py-1 rounded font-bold transition-all text-center ${
                  accountGroupFilter === 'sundry_debtors'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-blue-700'
                }`}
                title="Sundry Debtors (Receivable/Customers)"
              >
                Debtors
              </button>
              <button
                type="button"
                onClick={() => setAccountGroupFilter('sundry_creditors')}
                className={`py-1 rounded font-bold transition-all text-center ${
                  accountGroupFilter === 'sundry_creditors'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-purple-700'
                }`}
                title="Sundry Creditors (Payable/Vendors)"
              >
                Creditors
              </button>
            </div>
          )}
          
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder={isTransporterView ? "Search transporter..." : "Search party name/city..."}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded pl-8 pr-2.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
            {filteredParties.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs space-y-2">
                <p>No {isTransporterView ? 'transporter accounts' : 'party accounts'} found</p>
                {['admin', 'accountant'].includes(userRole) && (
                  <button
                    onClick={handleOpenAddModal}
                    className="text-[11px] text-blue-600 hover:underline font-bold"
                  >
                    + Add New {isTransporterView ? 'Transporter' : 'Party'}
                  </button>
                )}
              </div>
            ) : (
              filteredParties.map(p => {
                const partyBalance = partyBalancesMap.get(p.id) ?? (Number(p.openingBalance) || 0);
                const isCreditor = p.accountGroup === 'sundry_creditors' || p.accountCategory === 'transporter' || p.partyType === 'transporter';
                const isSelected = p.id === selectedParty?.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedPartyId(p.id);
                      setCurrentPage(1);
                    }}
                    className={`group relative w-full text-left p-2 rounded border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-900 truncate">{p.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        {!isTransporterView && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                            isCreditor ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isCreditor ? 'CR' : 'DR'}
                          </span>
                        )}
                        {['admin', 'accountant'].includes(userRole) && onDeleteParty && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePartyClick(p.id, p.name);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                            title={`Delete "${p.name}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex justify-between items-center mt-0.5">
                      <span className="truncate mr-1">{p.city || 'N/A'}, {p.state || 'MH'}</span>
                      <span className={`font-mono font-bold shrink-0 ${partyBalance > 0 ? 'text-blue-700' : partyBalance < 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                        <span className="text-slate-500 mr-1 font-normal">{partyBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(partyBalance))}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ledger Statement Details */}
        {selectedParty ? (
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-4 space-y-4 text-slate-800 shadow-xs">
            
            {/* Party Overview Card */}
            <div className="bg-slate-50 p-3.5 rounded border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-blue-700 tracking-wider">
                    {isTransporterView ? 'TRANSPORTER STATEMENT' : 'PARTY STATEMENT'}
                  </span>
                  
                  {/* Account Group Badge */}
                  {selectedParty.accountGroup === 'sundry_creditors' || selectedParty.accountCategory === 'transporter' || selectedParty.partyType === 'transporter' ? (
                    <span className="inline-flex items-center space-x-1 bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Building2 className="w-3 h-3" />
                      <span>Sundry Creditors</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Users className="w-3 h-3" />
                      <span>Sundry Debtors</span>
                    </span>
                  )}

                  {onEditParty && (
                    <button
                      onClick={() => handleOpenEditModal(selectedParty)}
                      className="text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded text-xs font-bold flex items-center space-x-1 border border-blue-200 ml-1 transition-colors"
                      title="Edit Account Details"
                    >
                      <Edit className="w-3 h-3 inline" />
                      <span>Edit</span>
                    </button>
                  )}
                  {onDeleteParty && (
                    <button
                      onClick={() => handleDeletePartyClick(selectedParty.id, selectedParty.name)}
                      className="text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded text-xs font-bold flex items-center space-x-1 border border-rose-200 ml-1 transition-colors"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3 h-3 inline text-rose-600" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedParty.name}</h3>
                <p className="text-xs text-slate-600">{selectedParty.address}, {selectedParty.city}, {selectedParty.state}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  GSTIN: <span className="font-mono text-slate-800 font-bold">{selectedParty.gstin || 'N/A'}</span> | Ph: {selectedParty.phone}
                </p>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto text-center border-t md:border-t-0 md:border-l border-slate-200 pt-2.5 md:pt-0 md:pl-3">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Opening Bal</div>
                  <div className="text-xs font-bold text-slate-800 font-mono">
                    <span className="text-slate-500 mr-1 font-normal">{openingBalanceForPeriod >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(openingBalanceForPeriod))}
                  </div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total Billed</div>
                  <div className="text-xs font-bold text-slate-900 font-mono">₹{formatINR(totalBilled)}</div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Received</div>
                  <div className="text-xs font-bold text-emerald-700 font-mono">₹{formatINR(totalReceived)}</div>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <div className="text-[10px] text-blue-700 uppercase font-bold">Balance Due</div>
                  <div className="text-xs font-black text-blue-900 font-mono"><span className="text-blue-700 mr-1 font-normal">{netOutstanding >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(netOutstanding))}</div>
                </div>
              </div>

            </div>

            {/* Date Filters & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-600 font-bold">Date Range:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 focus:outline-none"
                  />
                </div>

                {/* View Mode Toggle: T-Format vs Tabular */}
                <div className="flex items-center space-x-1 bg-slate-200/80 p-0.5 rounded border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setViewMode('t_format')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      viewMode === 't_format'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Indian Ledger Book T-Format (Credit Particulars vs Debit Particulars)"
                  >
                    <Columns className="w-3 h-3" />
                    <span>T-Account (Debit/Credit)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('standard')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      viewMode === 'standard'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title="Multi-column Standard Tabular View"
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>Standard Table</span>
                  </button>
                </div>

                {/* Sort Filter: Old First / New First near Date option */}
                <div className="flex items-center space-x-1 bg-slate-200/80 p-0.5 rounded border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setSortOrder('old_first')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      sortOrder === 'old_first'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Old First
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('new_first')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      sortOrder === 'new_first'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    New First
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Transporter View: ONLY Create Transport Invoice */}
                {isTransporterView && ['admin', 'accountant'].includes(userRole) && (
                  <button
                    onClick={() => {
                      if (onCreateNewInvoice) {
                        onCreateNewInvoice(selectedParty?.id);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded font-bold transition-all flex items-center space-x-1 shadow-xs"
                    title="Create New Transport Freight Invoice"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>+ Create Transport Invoice</span>
                  </button>
                )}

                <button
                  onClick={() => setShowPrintModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded font-bold transition-all flex items-center space-x-1 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF Statement</span>
                </button>

                {['admin', 'accountant'].includes(userRole) && (<>
                <button
                  onClick={() => setShowDirectPaymentModal(true)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded font-bold transition-all flex items-center space-x-1 shadow-xs"
                  title="Record direct payment received to credit party account ledger"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>+ Add Payment</span>
                </button>

                <button
                  onClick={() => onRecordPaymentModal(selectedParty.id)}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-2.5 py-1 rounded font-bold transition-all flex items-center space-x-1 shadow-xs"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>+ Record Payment</span>
                </button>
                </>)}
              </div>
            </div>

            {/* LIVE T-ACCOUNT DUAL COLUMN VIEW */}
            {viewMode === 't_format' ? (
              <div className="bg-white border border-slate-300 rounded-lg p-4 sm:p-6 shadow-xs text-xs font-sans">
                {/* Center Company Title & Account Header */}
                <div className="text-center pb-2">
                  <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide text-slate-950">
                    {settings?.companyName || 'NCBL TRANSPORT'}
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end font-bold border-b border-black pb-1 mb-1 text-xs">
                  <div>
                    <div className="text-sm font-extrabold uppercase text-slate-950">
                      Account Statement For {selectedParty.name}
                    </div>
                    <div className="text-xs text-slate-700 font-bold mt-0.5">
                      From {startDate ? formatDateDMY(startDate) : 'Beginning'} To {endDate ? formatDateDMY(endDate) : 'Present'}
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono font-bold text-slate-900 mt-1 sm:mt-0">
                    Page : 1
                  </div>
                </div>

                {/* Dual Column T-Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-black pt-2">
                  
                  {/* LEFT COLUMN */}
                  <div className="md:pr-4 md:border-r border-slate-300 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-xs pb-1 mb-3 border-b border-slate-400 text-slate-900 uppercase">
                        {tFormatData.leftTitle}
                      </div>

                      <div className="space-y-3.5">
                        {tFormatData.leftItems.length === 0 ? (
                          <div className="text-slate-400 italic text-[11px] py-6 text-center">
                            No {tFormatData.leftTitle.toLowerCase()} recorded
                          </div>
                        ) : (
                          tFormatData.leftItems.map((item) => (
                            <div key={item.id} className="text-xs border-b border-slate-100 pb-2">
                              <div className="flex items-center space-x-2 font-mono font-medium text-slate-900">
                                <span className="w-24 text-right font-bold shrink-0">{item.amount.toFixed(2)}</span>
                                <span className="text-slate-800">{item.date}</span>
                                <span className="font-semibold text-slate-900 bg-slate-100 px-1 py-0.5 rounded text-[10px]">{item.voucherType}</span>
                              </div>
                              <div className="pl-24 text-slate-950 font-bold uppercase text-[11px] leading-tight mt-0.5 space-y-0.5">
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
                              <div className="pl-24 text-blue-900 font-mono text-[11px] font-semibold mt-0.5">
                                {item.voucherNo}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Bottom balancing on LEFT side */}
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
                          <div className="border-t border-black border-b-2 border-b-black py-1 mt-1 text-right">
                            <span className="font-mono text-sm font-black text-slate-950">
                              {tFormatData.grandTotal.toFixed(2)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="border-t-2 border-b-2 border-black py-1 mt-4">
                          <div className="text-left font-mono text-sm font-black text-slate-950 pl-2">
                            {tFormatData.grandTotal.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="md:pl-4 flex flex-col justify-between">
                    <div>
                      <div className="font-bold text-xs pb-1 mb-3 border-b border-slate-400 text-slate-900 uppercase">
                        {tFormatData.rightTitle}
                      </div>

                      <div className="space-y-3.5">
                        {tFormatData.rightItems.length === 0 ? (
                          <div className="text-slate-400 italic text-[11px] py-6 text-center">
                            No {tFormatData.rightTitle.toLowerCase()} recorded
                          </div>
                        ) : (
                          tFormatData.rightItems.map((item) => (
                            <div key={item.id} className="text-xs border-b border-slate-100 pb-2">
                              <div className="flex items-center space-x-2 font-mono font-medium text-slate-900">
                                <span className="w-24 text-right font-bold shrink-0">{item.amount.toFixed(2)}</span>
                                <span className="text-slate-800">{item.date}</span>
                                <span className="font-semibold text-slate-900 bg-slate-100 px-1 py-0.5 rounded text-[10px]">{item.voucherType}</span>
                              </div>
                              <div className="pl-24 text-slate-950 font-bold uppercase text-[11px] leading-tight mt-0.5 space-y-0.5">
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
                              <div className="pl-24 text-blue-900 font-mono text-[11px] font-semibold mt-0.5">
                                {item.voucherNo}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Bottom balancing on RIGHT side */}
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
                          <div className="border-t border-black border-b-2 border-b-black py-1 mt-1 text-right">
                            <span className="font-mono text-sm font-black text-slate-950">
                              {tFormatData.grandTotal.toFixed(2)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="border-t-2 border-b-2 border-black py-1 mt-4">
                          <div className="text-right font-mono text-sm font-black text-slate-950 pr-2">
                            {tFormatData.grandTotal.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              /* STANDARD TABULAR TABLE VIEW */
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                      <th className="p-2">Date</th>
                      <th className="p-2">Ref No</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Particulars / Description</th>
                      <th className="p-2 text-right">QTY / WEIGHT</th>
                      <th className="p-2 text-right">RATE (₹)</th>
                      <th className="p-2 text-right">TDS (₹)</th>
                      <th className="p-2 text-right">Debit (₹)</th>
                      <th className="p-2 text-right">Credit (₹)</th>
                      <th className="p-2 text-right font-mono">Closing BALANCE (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Opening balance row */}
                    <tr className="bg-slate-50/60 text-slate-600">
                      <td className="p-2 font-mono">-</td>
                      <td className="p-2 font-bold text-slate-800">OPENING</td>
                      <td className="p-2">-</td>
                      <td className="p-2">Opening Balance Carried Forward</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right">-</td>
                      <td className="p-2 text-right font-mono font-bold text-blue-700">
                        <span className="text-slate-500 mr-1 font-normal">{openingBalanceForPeriod >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(openingBalanceForPeriod))}
                      </td>
                    </tr>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-slate-400">
                          No transactions found for this party in selected date range.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-700 font-mono whitespace-nowrap">{row.date}</td>
                          <td className="p-2 font-mono font-bold text-blue-700 whitespace-nowrap">{row.referenceNo}</td>
                          <td className="p-2 whitespace-nowrap">
                            {row.type === 'invoice' ? (
                              row.billCategory === 'income' ? (
                                <span className="inline-flex items-center space-x-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                  <span>INCOME (TAX)</span>
                                </span>
                              ) : row.billCategory === 'expense' ? (
                                <span className="inline-flex items-center space-x-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  <ArrowDownLeft className="w-2.5 h-2.5" />
                                  <span>EXPENSE (TAX)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  <FileText className="w-2.5 h-2.5" />
                                  <span>FREIGHT BILL</span>
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center space-x-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                <ArrowDownLeft className="w-2.5 h-2.5" />
                                <span>JAMA (PAYMENT)</span>
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-slate-800">{row.description}</td>
                          <td className="p-2 text-right font-medium text-slate-700">{row.type === 'invoice' ? row.qtyWeight || '-' : '-'}</td>
                          <td className="p-2 text-right font-medium text-slate-700">{row.type === 'invoice' && row.rate ? `₹${formatINR(row.rate, 2, 2)}` : '-'}</td>
                          <td className="p-2 text-right font-medium text-slate-700">{row.type === 'invoice' && row.tdsAmount ? `₹${formatINR(row.tdsAmount)}` : '-'}</td>
                          <td className="p-2 text-right font-bold text-red-600">
                            {row.debit > 0 ? `₹${formatINR(row.debit)}` : '-'}
                          </td>
                          <td className="p-2 text-right font-bold text-emerald-600">
                            {row.credit > 0 ? `₹${formatINR(row.credit)}` : '-'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            <span className="text-slate-500 mr-1 font-normal">{row.runningBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(row.runningBalance))}
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Closing balance row */}
                    {displayedLedgerRows.length > 0 && (
                      <tr className="bg-blue-50/60 font-bold text-blue-900 border-t-2 border-slate-200">
                        <td colSpan={9} className="p-3 text-right uppercase tracking-wider text-xs">
                          Closing Balance Carried Forward:
                        </td>
                        <td className="p-3 text-right font-mono text-sm">
                          <span className="text-slate-500 mr-1 font-normal">{netOutstanding >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(netOutstanding))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination / Row Controls */}
            {displayedLedgerRows.length > 25 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
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
                    <option value={0}>Show All ({displayedLedgerRows.length})</option>
                  </select>
                  <span>of {displayedLedgerRows.length} total entries</span>
                </div>

                {pageSize > 0 && totalPages > 1 && (
                  <div className="flex items-center space-x-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-50 flex items-center space-x-1"
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
        ) : (
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500 shadow-xs space-y-3">
            <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto">
              {isTransporterView ? <Building2 className="w-6 h-6" /> : <Users className="w-6 h-6" />}
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {isTransporterView ? 'No Transporter Accounts Found' : 'No Party Accounts Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {isTransporterView 
                ? 'Create transporter accounts to manage freight vouchers, transport billing and running debit/credit balances.' 
                : 'Create client / party accounts to track freight invoices, payments received, and running debit/credit balances.'}
            </p>
            {['admin', 'accountant'].includes(userRole) && (
              <button
                onClick={handleOpenAddModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-bold transition-all shadow-xs inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isTransporterView ? 'Add New Transporter' : 'Add New Party'}</span>
              </button>
            )}
          </div>
        )}

      </div>

      {/* Modal: Add New Party / Transporter */}
      {showAddPartyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold mb-3 text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              {newAccountCategory === 'transporter' ? (
                <Building2 className="w-4 h-4 text-purple-700" />
              ) : (
                <Users className="w-4 h-4 text-blue-700" />
              )}
              <span>Add New {newAccountCategory === 'transporter' ? 'Transporter Account' : 'Party / Client Account'}</span>
            </h3>

            <form onSubmit={handleSaveNewParty} className="space-y-3 text-xs">
              
              {/* Account Category Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1.5">
                <label className="block text-slate-700 font-bold text-xs flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-700" />
                  <span>Account Ledger Category *</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewAccountCategory('transporter');
                      setNewAccountGroup('sundry_creditors');
                    }}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded border text-xs font-bold transition-all ${
                      newAccountCategory === 'transporter'
                        ? 'bg-purple-700 border-purple-700 text-white shadow-xs'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🚚 Transporter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewAccountCategory('party');
                      setNewAccountGroup('sundry_debtors');
                    }}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded border text-xs font-bold transition-all ${
                      newAccountCategory === 'party'
                        ? 'bg-blue-700 border-blue-700 text-white shadow-xs'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏢 Party / Client</span>
                  </button>
                </div>
              </div>

              {/* Accounting Group (Sundry Debtors / Sundry Creditors) */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1.5">
                <label className="block text-slate-700 font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <Tag className="w-3.5 h-3.5 text-blue-700" />
                    <span>Accounting Group *</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {newAccountCategory === 'transporter' ? 'Fixed: Creditor' : 'Choose Group'}
                  </span>
                </label>

                {newAccountCategory === 'transporter' ? (
                  /* Transporter is strictly Sundry Creditors ONLY */
                  <div className="bg-purple-50/80 border border-purple-200 rounded p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-purple-950 flex items-center space-x-1.5">
                        <span>🏢 SUNDRY CREDITORS</span>
                      </div>
                      <span className="bg-purple-700 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                        LOCKED
                      </span>
                    </div>
                    <p className="text-[10.5px] text-purple-800 mt-1">
                      Transporter accounts are registered exclusively under <strong>Sundry Creditors</strong> (Fleet vendor / payable account).
                    </p>
                  </div>
                ) : (
                  /* Party Ledgers have option for Sundry Debtors OR Sundry Creditors */
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewAccountGroup('sundry_debtors')}
                        className={`flex flex-col items-start p-2 rounded border text-left transition-all ${
                          newAccountGroup === 'sundry_debtors'
                            ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-blue-950">Sundry Debtors</span>
                          {newAccountGroup === 'sundry_debtors' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                        </div>
                        <span className="text-[9.5px] text-slate-500 mt-0.5 font-medium leading-tight">
                          Customer / Freight Receivable
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewAccountGroup('sundry_creditors')}
                        className={`flex flex-col items-start p-2 rounded border text-left transition-all ${
                          newAccountGroup === 'sundry_creditors'
                            ? 'bg-purple-50 border-purple-600 ring-1 ring-purple-600 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-purple-950">Sundry Creditors</span>
                          {newAccountGroup === 'sundry_creditors' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          )}
                        </div>
                        <span className="text-[9.5px] text-slate-500 mt-0.5 font-medium leading-tight">
                          Vendor / Supplier / Payable
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5">
                  {newAccountCategory === 'transporter' ? 'Transporter Company Name *' : 'Party / Company Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={newAccountCategory === 'transporter' ? "e.g. Mahavir Roadlines / Gujarat Transporter" : "e.g. Tata Steel BSL Ltd"}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Party User (Receiver User / Site Contact)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Contact Person</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma / Site Incharge"
                  value={newPartyUser}
                  onChange={e => setNewPartyUser(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5">GSTIN Number</label>
                <input
                  placeholder="27AAACT1234A1Z1"
                  value={newGstin}
                  onChange={e => setNewGstin(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="Pune"
                    value={newCity}
                    onChange={e => setNewCity(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">Phone / Mobile</label>
                  <input
                    type="text"
                    placeholder="+91 98..."
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">State *</label>
                  <input
                    type="text"
                    required
                    placeholder="Maharashtra"
                    value={newState}
                    onChange={e => setNewState(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">State Code</label>
                  <input
                    type="text"
                    required
                    placeholder="27"
                    value={newStateCode}
                    onChange={e => setNewStateCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5">Address</label>
                <textarea
                  rows={2}
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={newOpeningBal}
                  onChange={e => setNewOpeningBal(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs"
                >
                  Save {newAccountCategory === 'transporter' ? 'Transporter' : 'Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Party / Transporter */}
      {editingParty && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold mb-3 text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-blue-700" />
              <span>Modify Account Master Details</span>
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!onEditParty || !editingParty) return;
              const finalAccountGroup: AccountGroup = newAccountCategory === 'transporter' ? 'sundry_creditors' : newAccountGroup;
              const updatedParty: Party = {
                ...editingParty,
                name: newName.trim(),
                partyUser: newPartyUser.trim(),
                gstin: newGstin.trim().toUpperCase(),
                phone: newPhone.trim(),
                city: newCity.trim() || 'Pune',
                state: newState.trim() || 'Maharashtra',
                stateCode: newStateCode.trim() || '27',
                address: newAddress.trim(),
                accountCategory: newAccountCategory,
                accountGroup: finalAccountGroup,
                partyType: newAccountCategory === 'transporter' ? 'transporter' : (editingParty.partyType === 'transporter' ? 'consignor' : editingParty.partyType),
                openingBalance: Number(newOpeningBal)
              };
              onEditParty(updatedParty);
              setEditingParty(null);
            }} className="space-y-3 text-xs">
              
              {/* Account Category Selector */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1.5">
                <label className="block text-slate-700 font-bold text-xs flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-700" />
                  <span>Account Ledger Category *</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewAccountCategory('transporter');
                      setNewAccountGroup('sundry_creditors');
                    }}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded border text-xs font-bold transition-all ${
                      newAccountCategory === 'transporter'
                        ? 'bg-purple-700 border-purple-700 text-white shadow-xs'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🚚 Transporter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewAccountCategory('party');
                      setNewAccountGroup('sundry_debtors');
                    }}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded border text-xs font-bold transition-all ${
                      newAccountCategory === 'party'
                        ? 'bg-blue-700 border-blue-700 text-white shadow-xs'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏢 Party / Client</span>
                  </button>
                </div>
              </div>

              {/* Accounting Group (Sundry Debtors / Sundry Creditors) */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1.5">
                <label className="block text-slate-700 font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <Tag className="w-3.5 h-3.5 text-blue-700" />
                    <span>Accounting Group *</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {newAccountCategory === 'transporter' ? 'Fixed: Creditor' : 'Choose Group'}
                  </span>
                </label>

                {newAccountCategory === 'transporter' ? (
                  /* Transporter is strictly Sundry Creditors ONLY */
                  <div className="bg-purple-50/80 border border-purple-200 rounded p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-purple-950 flex items-center space-x-1.5">
                        <span>🏢 SUNDRY CREDITORS</span>
                      </div>
                      <span className="bg-purple-700 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                        LOCKED
                      </span>
                    </div>
                    <p className="text-[10.5px] text-purple-800 mt-1">
                      Transporter accounts are registered exclusively under <strong>Sundry Creditors</strong> (Fleet vendor / payable account).
                    </p>
                  </div>
                ) : (
                  /* Party Ledgers have option for Sundry Debtors OR Sundry Creditors */
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewAccountGroup('sundry_debtors')}
                        className={`flex flex-col items-start p-2 rounded border text-left transition-all ${
                          newAccountGroup === 'sundry_debtors'
                            ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-600 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-blue-950">Sundry Debtors</span>
                          {newAccountGroup === 'sundry_debtors' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                        </div>
                        <span className="text-[9.5px] text-slate-500 mt-0.5 font-medium leading-tight">
                          Customer / Freight Receivable
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewAccountGroup('sundry_creditors')}
                        className={`flex flex-col items-start p-2 rounded border text-left transition-all ${
                          newAccountGroup === 'sundry_creditors'
                            ? 'bg-purple-50 border-purple-600 ring-1 ring-purple-600 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-purple-950">Sundry Creditors</span>
                          {newAccountGroup === 'sundry_creditors' && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          )}
                        </div>
                        <span className="text-[9.5px] text-slate-500 mt-0.5 font-medium leading-tight">
                          Vendor / Supplier / Payable
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5">
                  {newAccountCategory === 'transporter' ? 'Transporter Company Name *' : 'Party / Company Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Party User (Receiver User / Site Contact)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Contact Person</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma / Site Incharge"
                  value={newPartyUser}
                  onChange={e => setNewPartyUser(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5">GSTIN Number</label>
                <input
                  type="text"
                  placeholder="27AAACN1234F1Z1"
                  value={newGstin}
                  onChange={e => setNewGstin(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono font-bold focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="Pune"
                    value={newCity}
                    onChange={e => setNewCity(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">Phone / Mobile</label>
                  <input
                    type="text"
                    placeholder="+91 98..."
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">State *</label>
                  <input
                    type="text"
                    required
                    placeholder="Maharashtra"
                    value={newState}
                    onChange={e => setNewState(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">State Code</label>
                  <input
                    type="text"
                    required
                    placeholder="27"
                    value={newStateCode}
                    onChange={e => setNewStateCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5">Address</label>
                <textarea
                  rows={2}
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-0.5">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={newOpeningBal}
                  onChange={e => setNewOpeningBal(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100 mt-2">
                {onDeleteParty ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingParty) {
                        handleDeletePartyClick(editingParty.id, editingParty.name);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-bold border border-rose-200 flex items-center space-x-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Party</span>
                  </button>
                ) : <div />}
                
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingParty(null)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs"
                  >
                    Update Account
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Party Ledger Print / PDF Modal */}
      {showPrintModal && selectedParty && (
        <PartyLedgerPrintModal
          party={selectedParty}
          invoices={invoices}
          settings={settings || {
            companyName: 'NCBL Transport',
            tagline: 'Fleet Logistics & Tax Billing System',
            gstin: '27AABCU9603R1ZM',
            pan: 'AABCU9603R',
            address: 'Shop No. 12, Transport Nagar, Nigdi',
            city: 'Pune',
            state: 'Maharashtra',
            stateCode: '27',
            pincode: '411044',
            phone: '+91 96877 09315',
            email: 'azazmadkiya@ncbltransport.com',
            bankName: 'HDFC Bank Ltd',
            bankAccountNo: '50200012345678',
            bankIfsc: 'HDFC0001234',
            bankBranch: 'Chinchwad Branch, Pune',
            upiId: '9687709315@upi',
            termsAndConditions: []
          }}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Direct Party Payment Modal */}
      <DirectPartyPaymentModal
        isOpen={showDirectPaymentModal}
        onClose={() => setShowDirectPaymentModal(false)}
        parties={parties}
        invoices={invoices}
        initialPartyId={selectedParty?.id}
        onAddPayment={(inv, pay) => {
          if (onAddPayment) {
            onAddPayment(inv, pay);
          }
        }}
      />

      {/* Party Income / Expense Tax Bill Modal */}
      {showTaxBillModal && (
        <PartyTaxBillModal
          isOpen={showTaxBillModal}
          onClose={() => setShowTaxBillModal(false)}
          parties={parties}
          invoices={invoices}
          initialPartyId={selectedParty?.id}
          initialBillType={taxBillType}
          settings={settings}
          onSaveInvoice={(inv) => {
            if (onSaveInvoice) {
              onSaveInvoice(inv);
            }
          }}
        />
      )}

    </div>
  );
};
