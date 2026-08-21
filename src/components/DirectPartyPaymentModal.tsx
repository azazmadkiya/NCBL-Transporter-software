import React, { useState, useEffect } from 'react';
import { Invoice, PaymentRecord, PaymentMode, Party, formatINR } from '../types';
import { X, ArrowDownLeft, CheckCircle2, Building2, Calendar, FileText, CreditCard, Tag } from 'lucide-react';

interface DirectPartyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  parties: Party[];
  invoices: Invoice[];
  initialPartyId?: string;
  onAddPayment: (invoice: Invoice, payment: PaymentRecord) => void;
}

export const DirectPartyPaymentModal: React.FC<DirectPartyPaymentModalProps> = ({
  isOpen,
  onClose,
  parties,
  invoices,
  initialPartyId,
  onAddPayment
}) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payKasar, setPayKasar] = useState<number | ''>('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payMode, setPayMode] = useState<PaymentMode>('bank_neft');
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      const defaultParty = initialPartyId || (parties.length > 0 ? parties[0].id : '');
      setSelectedPartyId(defaultParty);
      setPayAmount('');
      setPayKasar('');
      setPayRef('');
      setPayNotes('');
      setSuccessMessage('');
      setPayDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen, initialPartyId, parties]);

  if (!isOpen) return null;

  const selectedParty = parties.find(p => p.id === selectedPartyId) || parties[0];

  // Calculate current real-time outstanding balance for selected party
  const partyInvoices = invoices.filter(inv => {
    if (!selectedParty) return false;
    if (inv.partyId === selectedParty.id) return true;
    const pName = selectedParty.name.toLowerCase().trim();
    if (inv.consignorName && inv.consignorName.toLowerCase().trim() === pName) return true;
    if (inv.consigneeName && inv.consigneeName.toLowerCase().trim() === pName) return true;
    return false;
  });

  const totalBilled = partyInvoices.reduce((sum, inv) => sum + Number(inv.netPayable ?? inv.grandTotal ?? 0), 0);
  const totalReceived = partyInvoices.reduce((sum, inv) => {
    if (inv.payments && inv.payments.length > 0) {
      return sum + inv.payments.reduce((pSum, p) => pSum + Number(p.amount || 0) + Number(p.kasarAmount || 0), 0);
    }
    return sum;
  }, 0);

  const currentOutstanding = (Number(selectedParty?.openingBalance) || 0) + totalBilled - totalReceived;

  const numAmount = typeof payAmount === 'number' ? payAmount : 0;
  const numKasar = typeof payKasar === 'number' ? payKasar : 0;
  const totalJamaAmount = numAmount + numKasar;
  const newOutstanding = currentOutstanding - totalJamaAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0 && numKasar <= 0) {
      alert('Please enter a valid payment amount or discount/kasar received.');
      return;
    }

    setIsSubmitting(true);

    // Get all pending/partially paid invoices for party sorted by date ASC (oldest first)
    const pendingInvoices = partyInvoices
      .filter(inv => inv.balanceDue > 0)
      .sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());

    const batchTimestamp = Date.now();
    const batchId = `pay-direct-${batchTimestamp}`;
    const defaultRef = payRef.trim() || 'RECEIPT';
    const defaultNote = payNotes.trim() ? payNotes.trim() : 'Direct Jama in Account';

    let remainingAmount = numAmount;
    let remainingKasar = numKasar;
    let recordedCount = 0;

    if (pendingInvoices.length > 0) {
      // Distribute payment across pending invoices starting from oldest
      for (const inv of pendingInvoices) {
        if (remainingAmount <= 0 && remainingKasar <= 0) break;

        let invBalance = inv.balanceDue;

        // Allocate amount
        const allocAmt = Math.min(remainingAmount, invBalance);
        remainingAmount -= allocAmt;
        invBalance -= allocAmt;

        // Allocate Kasar
        const allocKasar = Math.min(remainingKasar, invBalance);
        remainingKasar -= allocKasar;

        if (allocAmt > 0 || allocKasar > 0) {
          const payRecord: PaymentRecord = {
            id: `${batchId}-${inv.id}`,
            date: payDate,
            amount: Number(allocAmt),
            kasarAmount: allocKasar > 0 ? Number(allocKasar) : undefined,
            mode: payMode,
            referenceNo: defaultRef,
            notes: defaultNote
          };

          onAddPayment(inv, payRecord);
          recordedCount++;
        }
      }

      // If there is still excess payment amount left over after settling all pending invoices,
      // attach excess to the latest invoice so it's fully credited
      if (remainingAmount > 0 || remainingKasar > 0) {
        const latestInvoice = partyInvoices.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())[0];
        if (latestInvoice) {
          const payRecord: PaymentRecord = {
            id: `${batchId}-excess-${Date.now()}`,
            date: payDate,
            amount: Number(remainingAmount),
            kasarAmount: remainingKasar > 0 ? Number(remainingKasar) : undefined,
            mode: payMode,
            referenceNo: defaultRef,
            notes: `${defaultNote} (Account Advance / Excess)`
          };
          onAddPayment(latestInvoice, payRecord);
          recordedCount++;
        }
      }
    } else if (partyInvoices.length > 0) {
      // If no pending invoices, attach payment directly to latest invoice as advance/credit
      const latestInvoice = partyInvoices.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())[0];
      const payRecord: PaymentRecord = {
        id: `${batchId}-advance-${Date.now()}`,
        date: payDate,
        amount: Number(numAmount),
        kasarAmount: numKasar > 0 ? Number(numKasar) : undefined,
        mode: payMode,
        referenceNo: defaultRef,
        notes: `${defaultNote} (Account Credit)`
      };
      onAddPayment(latestInvoice, payRecord);
      recordedCount++;
    } else {
      alert('Note: No invoices exist for this party yet. Please create an invoice first to attach payment entries.');
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage(`Payment of ₹${formatINR(numAmount)} successfully credited (Jama) to ${selectedParty?.name || 'Party'} account!`);
    setIsSubmitting(false);

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center space-x-2">
                <span>Record Direct Payment (Jama)</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Directly credit payment received into party account ledger.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMessage ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Payment Recorded!</h3>
            <p className="text-xs text-slate-600 font-medium max-w-xs mx-auto">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            
            {/* Party Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span>Select Party / Account *</span>
                <span className="text-[11px] text-slate-500 normal-case font-normal">
                  Outstanding: <strong className="font-mono text-slate-900">{currentOutstanding >= 0 ? 'Dr' : 'Cr'} ₹{formatINR(Math.abs(currentOutstanding))}</strong>
                </span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <select
                  value={selectedPartyId}
                  onChange={e => setSelectedPartyId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  {parties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.city ? `(${p.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount & Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Payment Date *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 font-bold focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Amount Received (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 50000"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 font-black font-mono focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Payment Mode & Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Payment Mode *
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <select
                    value={payMode}
                    onChange={e => setPayMode(e.target.value as PaymentMode)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="bank_neft">Bank NEFT / RTGS / IMPS</option>
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="cash">Cash Received</option>
                    <option value="cheque">Cheque / Demand Draft</option>
                    <option value="other">Other / Adjustment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Ref / Cheque / UTR No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR12345678"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-mono font-bold focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Kasar / Discount & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Kasar / Discount (₹)
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Optional kasar discount"
                    value={payKasar}
                    onChange={e => setPayKasar(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 font-mono font-bold focus:bg-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Remarks / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank payment received"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Calculation Summary Card */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] text-emerald-800 uppercase font-bold">Total Jama (Credit) Entry</div>
                <div className="text-base font-black text-emerald-900 font-mono">
                  ₹{formatINR(totalJamaAmount)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase font-bold">New Account Balance</div>
                <div className="text-xs font-bold text-slate-900 font-mono">
                  <span className="text-slate-500 mr-0.5">{newOutstanding >= 0 ? 'Dr' : 'Cr'}</span>₹{formatINR(Math.abs(newOutstanding))}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (numAmount <= 0 && numKasar <= 0)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center space-x-1.5"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Record Jama Payment</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
