import React, { useState } from 'react';
import { Invoice, CompanySettings, formatINR, GSTSummaryItem, TaxSlab } from '../types';
import { 
  Printer, Download, X, Copy, Check, Share2, FileText, CheckCircle2, ShieldCheck, QrCode, ArrowDownLeft
} from 'lucide-react';

interface PurchaseBillPrintModalProps {
  invoice: Invoice;
  settings: CompanySettings;
  onClose: () => void;
}

// Convert numbers into Indian Currency words
function numberToWordsINR(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Zero Rupees Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 10) return singleDigits[n];
    if (n >= 10 && n < 20) return teens[n - 10];
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    return tens[ten] + (unit ? ' ' + singleDigits[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = '';
    if (hundred) {
      str += singleDigits[hundred] + ' Hundred';
      if (rest) str += ' and ';
    }
    if (rest) {
      str += convertTwoDigits(rest);
    }
    return str;
  }

  let num = rounded;
  let words = '';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  if (crore) {
    words += convertTwoDigits(crore) + ' Crore ';
  }

  const lakh = Math.floor(num / 100000);
  num %= 100000;
  if (lakh) {
    words += convertTwoDigits(lakh) + ' Lakh ';
  }

  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (thousand) {
    words += convertTwoDigits(thousand) + ' Thousand ';
  }

  if (num) {
    words += convertThreeDigits(num);
  }

  return 'Rupees ' + words.trim() + ' Only';
}

export const PurchaseBillPrintModal: React.FC<PurchaseBillPrintModalProps> = ({
  invoice,
  settings,
  onClose
}) => {
  const [copyType, setCopyType] = useState<'Original' | 'Duplicate' | 'Office Copy'>('Original');
  const [copied, setCopied] = useState(false);

  const isInterState = invoice.taxType === 'inter_state' || (invoice.igstAmount || 0) > 0;

  // Rate-wise GST Summary calculation
  const gstRateSummaries = React.useMemo(() => {
    const map = new Map<string, GSTSummaryItem>();

    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach(item => {
        const slab: TaxSlab = (item.gstRate !== undefined ? item.gstRate : invoice.taxSlab) || 0;
        const key = `${item.hsnCode || '2523'}_${slab}`;
        const taxable = item.taxableAmount || (item.quantity * (item.rate || (item.amount / item.quantity)));

        if (!map.has(key)) {
          const halfRate = isInterState ? 0 : slab / 2;
          const fullRate = isInterState ? slab : 0;
          map.set(key, {
            hsnCode: item.hsnCode || '—',
            gstRate: slab,
            taxableValue: 0,
            cgstRate: halfRate,
            cgstAmount: 0,
            sgstRate: halfRate,
            sgstAmount: 0,
            igstRate: fullRate,
            igstAmount: 0,
            totalTax: 0
          });
        }

        const entry = map.get(key)!;
        entry.taxableValue += taxable;
        if (isInterState) {
          const tax = (taxable * slab) / 100;
          entry.igstAmount += tax;
          entry.totalTax += tax;
        } else {
          const halfTax = (taxable * (slab / 2)) / 100;
          entry.cgstAmount += halfTax;
          entry.sgstAmount += halfTax;
          entry.totalTax += halfTax * 2;
        }
      });
    }

    return Array.from(map.values());
  }, [invoice, isInterState]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const billNumber = invoice.purchaseBillNumber || invoice.supplierInvoiceNumber || invoice.invoiceNumber;
  const billDate = invoice.purchaseDate || invoice.supplierInvoiceDate || invoice.invoiceDate;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      
      {/* Container */}
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden p-3.5 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-600 rounded-md">
              <ArrowDownLeft className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight text-white flex items-center gap-2">
                GST Purchase Tax Invoice / Inward Bill
                <span className="text-xs font-normal text-emerald-300 font-mono">#{billNumber}</span>
              </h3>
              <p className="text-xs text-slate-300">Supplier: {invoice.consignorName || 'Vendor'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Copy Type selector */}
            <div className="flex items-center bg-slate-700 rounded-lg p-0.5 text-xs text-slate-300">
              {(['Original', 'Duplicate', 'Office Copy'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setCopyType(type)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    copyType === type ? 'bg-emerald-600 text-white font-medium shadow-xs' : 'hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleCopyLink}
              title="Copy link"
              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Page */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-50 print:bg-white print:p-0 flex-1">
          
          <div className="max-w-3xl mx-auto bg-white border border-slate-300 shadow-sm print:border-slate-800 print:shadow-none p-6 text-slate-800 text-xs">
            
            {/* Tax Invoice Header */}
            <div className="text-center pb-3 border-b-2 border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                  GST INWARD TAX INVOICE (PURCHASE)
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-sm font-semibold uppercase">
                  {copyType} - FOR RECORD / ITC
                </span>
              </div>
              <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900">
                {invoice.consignorName || 'SUPPLIER / VENDOR NAME'}
              </h1>
              <p className="text-[11px] text-slate-600 font-medium max-w-xl mx-auto mt-0.5">
                {invoice.consignorAddress || 'Vendor Address Details'}
              </p>
              <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-[11px] text-slate-700 mt-1 font-medium">
                {invoice.consignorGSTIN && (
                  <span>GSTIN / UIN: <strong className="font-bold text-slate-900">{invoice.consignorGSTIN}</strong></span>
                )}
                <span>State: <strong className="font-semibold">{invoice.consignorState || 'Maharashtra'}</strong> (Code: {invoice.consignorStateCode || '27'})</span>
              </div>
            </div>

            {/* Bill Meta & Dispatch Details */}
            <div className="grid grid-cols-2 border-b border-slate-300">
              {/* Left Column: Purchase Bill Info */}
              <div className="p-2.5 border-r border-slate-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Supplier Invoice No:</span>
                  <span className="font-bold text-slate-900 font-mono">{invoice.supplierInvoiceNumber || billNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Invoice Date:</span>
                  <span className="font-semibold">{billDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Internal Ref / Entry No:</span>
                  <span className="font-semibold text-slate-800">{invoice.invoiceNumber || 'PUR-' + billNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Payment Due Date:</span>
                  <span className="font-medium text-slate-700">{invoice.dueDate || 'On Receipt'}</span>
                </div>
              </div>

              {/* Right Column: Transport & LR details */}
              <div className="p-2.5 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Transport / Vehicle No:</span>
                  <span className="font-bold text-slate-900 font-mono">{invoice.vehicleNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">E-Way Bill / LR No:</span>
                  <span className="font-semibold font-mono">{invoice.lrNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Place of Supply:</span>
                  <span className="font-semibold">{invoice.consigneeState || settings.state || 'Maharashtra'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tax Mechanism:</span>
                  <span className="font-medium text-slate-800">{isInterState ? 'IGST (Inter-State)' : 'CGST + SGST (Intra-State)'}</span>
                </div>
              </div>
            </div>

            {/* Recipient / Purchaser (Billed To - NCBL Transport) */}
            <div className="grid grid-cols-2 border-b border-slate-300 bg-slate-50/50">
              
              {/* Billed To (Buyer / Company) */}
              <div className="p-2.5 border-r border-slate-300">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Billed To (Purchaser / Recipient):
                </div>
                <div className="font-bold text-sm text-slate-900">{settings.companyName || 'NCBL TRANSPORT'}</div>
                <div className="text-slate-600 mt-0.5 leading-relaxed">{settings.address || 'Company Address'}</div>
                <div className="mt-1 space-y-0.5">
                  <div>GSTIN: <strong className="font-semibold text-slate-900">{settings.gstin || settings.gstNumber || '27AABCU9603R1ZM'}</strong></div>
                  <div>State: <span className="font-medium">{settings.state || 'Maharashtra'}</span> (Code: {settings.stateCode || (settings.gstin ? settings.gstin.substring(0, 2) : '27')})</div>
                  {settings.phone && <div>Phone: <span className="font-medium">{settings.phone}</span></div>}
                </div>
              </div>

              {/* Shipped To / Delivery Warehouse */}
              <div className="p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Delivered At / Inward Site:
                </div>
                <div className="font-bold text-sm text-slate-900">{settings.companyName || 'Central Warehouse / Site'}</div>
                <div className="text-slate-600 mt-0.5 leading-relaxed">{settings.address || 'Same as billing premises'}</div>
                <div className="mt-1 space-y-0.5">
                  <div>Place of Delivery: <strong className="font-semibold">{settings.city || 'Pune'}, {settings.state || 'Maharashtra'}</strong></div>
                  <div>Inventory Status: <span className="font-semibold text-emerald-700">Added to Stock (+)</span></div>
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border-b border-slate-300">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase text-slate-700 font-bold">
                    <th className="py-2 px-2 text-center w-8 border-r border-slate-300">#</th>
                    <th className="py-2 px-2 border-r border-slate-300">Product / Item Description</th>
                    <th className="py-2 px-2 text-center border-r border-slate-300">HSN/SAC</th>
                    <th className="py-2 px-2 text-right border-r border-slate-300">Qty</th>
                    <th className="py-2 px-2 text-center border-r border-slate-300">Unit</th>
                    <th className="py-2 px-2 text-right border-r border-slate-300">Rate (₹)</th>
                    <th className="py-2 px-2 text-right border-r border-slate-300">Disc (%)</th>
                    <th className="py-2 px-2 text-right border-r border-slate-300">Taxable Val</th>
                    <th className="py-2 px-2 text-center border-r border-slate-300">GST %</th>
                    <th className="py-2 px-2 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((item, idx) => {
                      const itemTaxable = item.taxableAmount || (item.quantity * (item.rate || 0));
                      const itemGstRate = item.gstRate !== undefined ? item.gstRate : invoice.taxSlab || 0;
                      const itemTax = (itemTaxable * itemGstRate) / 100;
                      const itemTotal = itemTaxable + itemTax;

                      return (
                        <tr key={item.id || idx} className="text-[11px] hover:bg-slate-50/60">
                          <td className="py-2 px-2 text-center font-medium text-slate-500 border-r border-slate-300">{idx + 1}</td>
                          <td className="py-2 px-2 font-semibold text-slate-900 border-r border-slate-300">
                            {item.description}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-slate-600 border-r border-slate-300">{item.hsnCode || '—'}</td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900 border-r border-slate-300">{item.quantity}</td>
                          <td className="py-2 px-2 text-center text-slate-600 border-r border-slate-300">{item.unit || 'Bags'}</td>
                          <td className="py-2 px-2 text-right font-mono border-r border-slate-300">{formatINR(item.rate || 0)}</td>
                          <td className="py-2 px-2 text-right text-slate-600 border-r border-slate-300">{item.discountPercent || 0}%</td>
                          <td className="py-2 px-2 text-right font-semibold font-mono text-slate-900 border-r border-slate-300">
                            {formatINR(itemTaxable)}
                          </td>
                          <td className="py-2 px-2 text-center font-medium border-r border-slate-300">{itemGstRate}%</td>
                          <td className="py-2 px-2 text-right font-bold font-mono text-slate-900">{formatINR(itemTotal)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="text-[11px]">
                      <td className="py-2 px-2 text-center border-r border-slate-300">1</td>
                      <td className="py-2 px-2 font-semibold border-r border-slate-300">Purchase Goods / Materials</td>
                      <td className="py-2 px-2 text-center border-r border-slate-300">252329</td>
                      <td className="py-2 px-2 text-right font-bold border-r border-slate-300">{invoice.weightTons || 1}</td>
                      <td className="py-2 px-2 text-center border-r border-slate-300">MT</td>
                      <td className="py-2 px-2 text-right border-r border-slate-300">{formatINR(invoice.freightRate || invoice.subTotal)}</td>
                      <td className="py-2 px-2 text-right border-r border-slate-300">0%</td>
                      <td className="py-2 px-2 text-right font-semibold border-r border-slate-300">{formatINR(invoice.subTotal)}</td>
                      <td className="py-2 px-2 text-center border-r border-slate-300">{invoice.taxSlab || 18}%</td>
                      <td className="py-2 px-2 text-right font-bold">{formatINR(invoice.grandTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Tax Computation & Totals Grid */}
            <div className="grid grid-cols-12 border-b border-slate-300">
              
              {/* Left Column: HSN Wise GST Breakdown (6 cols) */}
              <div className="col-span-7 p-2.5 border-r border-slate-300">
                <div className="text-[10px] font-bold uppercase text-slate-600 mb-1.5">
                  GST Input Tax Credit (ITC) Summary:
                </div>
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                      <th className="py-1 px-1 border-r border-slate-300">HSN</th>
                      <th className="py-1 px-1 text-right border-r border-slate-300">Taxable</th>
                      {!isInterState && (
                        <>
                          <th className="py-1 px-1 text-right border-r border-slate-300">CGST</th>
                          <th className="py-1 px-1 text-right border-r border-slate-300">SGST</th>
                        </>
                      )}
                      {isInterState && (
                        <th className="py-1 px-1 text-right border-r border-slate-300">IGST</th>
                      )}
                      <th className="py-1 px-1 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {gstRateSummaries.map((sum, i) => (
                      <tr key={i} className="font-mono">
                        <td className="py-1 px-1 border-r border-slate-300 font-semibold">{sum.hsnCode} ({sum.gstRate}%)</td>
                        <td className="py-1 px-1 text-right border-r border-slate-300">{formatINR(sum.taxableValue)}</td>
                        {!isInterState && (
                          <>
                            <td className="py-1 px-1 text-right border-r border-slate-300">{formatINR(sum.cgstAmount)}</td>
                            <td className="py-1 px-1 text-right border-r border-slate-300">{formatINR(sum.sgstAmount)}</td>
                          </>
                        )}
                        {isInterState && (
                          <td className="py-1 px-1 text-right border-r border-slate-300">{formatINR(sum.igstAmount)}</td>
                        )}
                        <td className="py-1 px-1 text-right font-bold">{formatINR(sum.totalTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Amount in words */}
                <div className="mt-3 pt-2 border-t border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Amount (in words):</div>
                  <div className="font-bold text-slate-900 capitalize text-[11px] mt-0.5">
                    {numberToWordsINR(invoice.grandTotal || 0)}
                  </div>
                </div>
              </div>

              {/* Right Column: Financial Calculation Summary (5 cols) */}
              <div className="col-span-5 p-2.5 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Total Taxable Value:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatINR(invoice.subTotal || 0)}</span>
                </div>

                {!isInterState && (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Central Tax (CGST):</span>
                      <span className="font-mono font-semibold text-slate-900">{formatINR(invoice.cgstAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>State Tax (SGST):</span>
                      <span className="font-mono font-semibold text-slate-900">{formatINR(invoice.sgstAmount || 0)}</span>
                    </div>
                  </>
                )}

                {isInterState && (
                  <div className="flex justify-between text-slate-600">
                    <span>Integrated Tax (IGST):</span>
                    <span className="font-mono font-semibold text-slate-900">{formatINR(invoice.igstAmount || 0)}</span>
                  </div>
                )}

                {invoice.roundOff !== undefined && invoice.roundOff !== 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Round Off:</span>
                    <span className="font-mono">{invoice.roundOff > 0 ? `+${invoice.roundOff}` : invoice.roundOff}</span>
                  </div>
                )}

                <div className="pt-2 border-t-2 border-slate-800 flex justify-between items-center text-slate-900">
                  <span className="font-bold text-xs uppercase">Grand Total (₹):</span>
                  <span className="font-bold text-sm font-mono text-emerald-800">{formatINR(invoice.grandTotal || 0)}</span>
                </div>

                {/* Paid & Balance Breakdown */}
                <div className="pt-1.5 border-t border-dashed border-slate-300 space-y-1 text-[10px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Paid to Vendor:</span>
                    <span className="font-mono font-semibold text-emerald-600">{formatINR(invoice.amountPaid || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold">
                    <span>Balance Payable:</span>
                    <span className="font-mono text-amber-700">{formatINR(invoice.balanceDue || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Footer: Verification & Signatures */}
            <div className="grid grid-cols-2 pt-4 gap-6">
              
              {/* ITC & Tax Notes */}
              <div className="space-y-1 text-[10px] text-slate-500">
                <div className="font-bold uppercase text-slate-700">Audit & Tax Declaration:</div>
                <p>1. Certified that the goods covered by this purchase tax invoice have been received in good condition.</p>
                <p>2. Eligible for Input Tax Credit (ITC) under Section 16 of the CGST Act, 2017.</p>
                <p>3. Stock inventory entry has been verified and posted into product ledger.</p>
              </div>

              {/* Signatures */}
              <div className="flex flex-col justify-between items-end text-right">
                <div className="text-[10px] text-slate-600">
                  For <strong>{settings.companyName || 'NCBL TRANSPORT'}</strong>
                </div>
                <div className="pt-10 border-t border-slate-400 w-48 text-center text-[10px] font-semibold text-slate-800">
                  Verified & Authorized Signatory
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
