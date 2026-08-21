import React, { useState } from 'react';
import { Invoice, CompanySettings, PaymentMode, PaymentRecord, Party, formatINR } from '../types';
import { 
  X, QrCode, Copy, Check, Building2, CreditCard, 
  Smartphone, Wallet, DollarSign, CheckCircle2, ShieldCheck, Share2 
} from 'lucide-react';

interface PaymentOptionsModalProps {
  invoice?: Invoice | null;
  party?: Party | null;
  amountToPay?: number;
  settings: CompanySettings;
  onClose: () => void;
  onRecordPayment?: (invoice: Invoice, payment: PaymentRecord) => void;
  initialTab?: 'qr' | 'bank' | 'record';
}

export const PaymentOptionsModal: React.FC<PaymentOptionsModalProps> = ({
  invoice,
  party,
  amountToPay,
  settings,
  onClose,
  onRecordPayment,
  initialTab = 'qr'
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'bank' | 'record'>(initialTab);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const dueAmount = invoice ? (typeof invoice.balanceDue === 'number' ? invoice.balanceDue : invoice.netPayable) : (amountToPay || 0);

  // Form states for manual recording
  const [payAmount, setPayAmount] = useState<number>(dueAmount > 0 ? dueAmount : (invoice?.netPayable || 0));
  const [payKasar, setPayKasar] = useState<number | ''>('');
  const [payMode, setPayMode] = useState<PaymentMode>('upi');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaved, setIsSaved] = useState(false);

  const upiId = settings.upiId || '9687709315@upi';
  const companyName = settings.companyName || 'NCBL Transport';
  const invRef = invoice ? invoice.invoiceNumber : (party ? party.name : 'Transport Payment');
  
  // Standard UPI payment URI format according to NPCI / Indian Banking standard
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(companyName)}&am=${dueAmount}&tn=${encodeURIComponent('Bill ' + invRef)}&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `*Payment Request from ${companyName}*\n\n` +
      `*Reference:* ${invRef}\n` +
      `*Amount Payable:* ₹${formatINR(dueAmount)}\n\n` +
      `*Pay via UPI ID:* ${upiId}\n\n` +
      `*Bank Account Details:*\n` +
      `Bank: ${settings.bankName}\n` +
      `A/C No: ${settings.bankAccountNo}\n` +
      `IFSC: ${settings.bankIfsc}\n` +
      `Branch: ${settings.bankBranch}\n\n` +
      `Thank you for your business!`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || (!payAmount && !payKasar) || !onRecordPayment) return;

    const newPayment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      date: payDate,
      amount: Number(payAmount) || 0,
      kasarAmount: Number(payKasar) > 0 ? Number(payKasar) : undefined,
      mode: payMode,
      referenceNo: payRef || undefined,
      notes: payNotes || undefined
    };

    onRecordPayment(invoice, newPayment);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full text-slate-800 shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="bg-blue-700 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight leading-none uppercase">Payment Options</h3>
              <p className="text-[11px] text-blue-100 mt-0.5 font-medium">
                {invoice ? `Invoice: ${invoice.invoiceNumber}` : (party ? `Party: ${party.name}` : 'Quick Payment')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase">Payable To:</span>
            <span className="font-bold text-slate-900">{companyName}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-semibold block text-[10px] uppercase">Net Due Amount:</span>
            <span className="font-black text-blue-700 text-sm font-mono">₹{formatINR(dueAmount)}</span>
          </div>

        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-bold">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-1.5 transition-colors border-b-2 ${
              activeTab === 'qr'
                ? 'bg-white border-blue-600 text-blue-700 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <QrCode className="w-4 h-4 text-blue-600" />
            <span>UPI QR Code</span>
          </button>

          <button
            onClick={() => setActiveTab('bank')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-1.5 transition-colors border-b-2 ${
              activeTab === 'bank'
                ? 'bg-white border-blue-600 text-blue-700 font-extrabold'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Bank Details</span>
          </button>

          {invoice && onRecordPayment && (
            <button
              onClick={() => setActiveTab('record')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-1.5 transition-colors border-b-2 ${
                activeTab === 'record'
                  ? 'bg-white border-blue-600 text-blue-700 font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
              <span>Record Payment</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-5">
          
          {/* TAB 1: UPI QR CODE */}
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 inline-block shadow-inner">
                <img
                  src={qrCodeUrl}
                  alt="UPI QR Code"
                  className="w-48 h-48 mx-auto rounded border border-slate-300"
                />
                <div className="mt-2 flex items-center justify-center space-x-1 text-[11px] font-bold text-slate-700">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Scan with GPay, PhonePe, Paytm or BHIM</span>
                </div>
              </div>

              {/* UPI ID Copy Bar */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-left flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-800 uppercase block">VPA / UPI ID:</span>
                  <span className="font-mono font-bold text-slate-900 text-xs">{upiId}</span>
                </div>
                <button
                  onClick={() => handleCopy(upiId, 'upi')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded flex items-center space-x-1 transition-all shadow-xs"
                >
                  {copiedType === 'upi' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy UPI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Share & Quick Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  onClick={handleShareWhatsApp}
                  className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share Payment Request via WhatsApp</span>
                </button>

                {invoice && onRecordPayment && (
                  <button
                    onClick={() => setActiveTab('record')}
                    className="w-full sm:w-auto bg-purple-700 hover:bg-purple-800 text-white font-bold py-2 px-3 rounded text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Record Payment</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BANK DETAILS */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 border-b pb-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Direct Bank Wire Transfer (NEFT / RTGS / IMPS)</span>
                </h4>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Bank Name:</span>
                    <span className="font-bold text-slate-900">{settings.bankName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Account Number:</span>
                    <span className="font-mono font-bold text-slate-900">{settings.bankAccountNo}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">IFSC Code:</span>
                    <span className="font-mono font-bold text-blue-700">{settings.bankIfsc}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Branch Name:</span>
                    <span className="font-semibold text-slate-800">{settings.bankBranch}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500 font-medium">Account Holder:</span>
                    <span className="font-bold text-slate-900">{companyName}</span>
                  </div>
                </div>
              </div>

              {/* Copy Bank Info & Record */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleCopy(`Bank: ${settings.bankName}\nA/C No: ${settings.bankAccountNo}\nIFSC: ${settings.bankIfsc}\nBranch: ${settings.bankBranch}`, 'bank')}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs"
                >
                  {copiedType === 'bank' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Bank Details Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Full Bank Details</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleShareWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded text-xs flex items-center space-x-1.5 transition-all shadow-xs"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>

                {invoice && onRecordPayment && (
                  <button
                    onClick={() => setActiveTab('record')}
                    className="bg-purple-700 hover:bg-purple-800 text-white font-bold py-2 px-3 rounded text-xs flex items-center space-x-1.5 transition-all shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Record</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RECORD PAYMENT */}
          {activeTab === 'record' && invoice && onRecordPayment && (
            <div>
              {isSaved ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-2 text-emerald-900">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="font-extrabold text-base">Payment Recorded Successfully!</h4>
                  <p className="text-xs text-emerald-700 font-medium">Updating ledger and closing window...</p>
                </div>
              ) : (
                <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1 uppercase text-[10px]">
                        Payment Amount (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        max={dueAmount * 2 || 9999999}
                        value={payAmount}
                        onChange={(e) => setPayAmount(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-sm font-black font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-purple-900 font-bold mb-1 uppercase text-[10px]">
                        Kasar / Discount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 200"
                        value={payKasar}
                        onChange={(e) => setPayKasar(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-purple-50/80 border border-purple-300 rounded px-3 py-1.5 text-sm font-black font-mono text-purple-950 focus:bg-white focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>


                  <div>
                    <label className="block text-slate-600 font-bold mb-1 uppercase text-[10px]">
                      Payment Mode / Channel *
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { mode: 'upi', label: 'UPI / QR', icon: Smartphone },
                        { mode: 'bank_neft', label: 'NEFT / RTGS', icon: Building2 },
                        { mode: 'cash', label: 'Cash Payment', icon: Wallet },
                        { mode: 'cheque', label: 'Cheque', icon: CreditCard },
                        { mode: 'fuel_card', label: 'Fuel Card / Slip', icon: DollarSign }
                      ].map(item => (
                        <button
                          type="button"
                          key={item.mode}
                          onClick={() => setPayMode(item.mode as PaymentMode)}
                          className={`p-2 rounded border text-[11px] font-bold flex flex-col items-center space-y-1 transition-all ${
                            payMode === item.mode
                              ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1 uppercase text-[10px]">
                        Payment Date
                      </label>
                      <input
                        type="date"
                        required
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1 uppercase text-[10px]">
                        UTR / Transaction Ref No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UTR987123"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold mb-1 uppercase text-[10px]">
                      Remarks / Receipt Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Part payment received via Google Pay"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-1.5 mt-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm & Record Receipt (₹{formatINR(payAmount)})</span>
                  </button>

                </form>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

