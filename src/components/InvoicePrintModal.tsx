import React, { useRef, useState } from 'react';
import { Invoice, CompanySettings, formatINR } from '../types';
import { Printer, Download, X, Truck, CheckCircle2, Building2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { useReactToPrint } from 'react-to-print';

interface InvoicePrintModalProps {
  invoice: Invoice;
  settings: CompanySettings;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoice,
  settings,
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${invoice.invoiceNumber}_${invoice.lrNumber}`,
  });

  const handleDownloadPDF = async () => {
    const content = printRef.current;
    if (content) {
      try {
        setIsGenerating(true);

        // Temporarily override parent styles to prevent cropping
        const scrollParent = content.parentElement;
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

        // Small delay to allow DOM to update
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(content, { 
          scale: 1.5, 
          useCORS: true, 
          logging: false,
          scrollY: -window.scrollY
        });

        // Restore styles
        if (scrollParent && modalCard) {
          scrollParent.style.overflow = oldScrollOverflow;
          modalCard.style.maxHeight = oldCardMaxHeight;
          modalCard.style.overflow = oldCardOverflow;
        }

        const imgData = canvas.toDataURL('image/png', 1.0);
        const pdf = new jsPDF('p', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfPageHeight;

        while (heightLeft > 0) {
          position -= pdfPageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfPageHeight;
        }

        pdf.save(`${invoice.invoiceNumber}_${invoice.lrNumber}.pdf`);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const isTaxInvoice = invoice.invoiceType === 'tax_invoice';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-invoice, #printable-invoice * {
              visibility: visible;
            }
            #printable-invoice {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          }
        `}
      </style>

      {/* Modal Card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col my-auto">
        
        {/* Header toolbar */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-lg sticky top-0 z-10 print:hidden">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {isTaxInvoice ? 'TAX INVOICE' : 'TRANSPORT BILL / MEMO'} PREVIEW
              </h3>
              <p className="text-xs text-slate-500">
                Invoice No: <span className="text-blue-700 font-mono font-bold">{invoice.invoiceNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>
            
            <button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded text-xs font-semibold transition-all"
            >
              <Download className={`w-3.5 h-3.5 text-blue-700 ${isGenerating ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{isGenerating ? 'Generating PDF...' : 'Download as PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex justify-center">
          
          {/* Printable White Paper Container */}
          <div 
            ref={printRef}
            className="bg-white text-slate-900 p-6 sm:p-10 rounded shadow-lg w-full max-w-[780px] text-xs font-sans border border-slate-200 print:shadow-none print:border-none print:p-0"
            id="printable-invoice"
          >
            
            {/* Header Document Banner */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-950 uppercase flex items-center space-x-2">
                    <span>{settings.companyName}</span>
                  </h1>
                  <p className="text-[11px] font-semibold text-amber-700">{settings.tagline}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{settings.address}, {settings.city}, {settings.state} - {settings.pincode}</p>
                  <p className="text-[10px] text-slate-600">Ph: {settings.phone} | Email: {settings.email}</p>
                  <p className="text-[10px] font-bold text-slate-800 mt-1">
                    GSTIN: <span className="font-mono text-slate-950">{settings.gstin}</span> | PAN: <span className="font-mono text-slate-950">{settings.pan}</span>
                  </p>
                </div>

                <div className="text-right sm:text-right border-l-2 sm:border-l-0 pl-3 sm:pl-0 border-amber-500">
                  <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-xs font-extrabold uppercase tracking-wider mb-1">
                    {isTaxInvoice ? 'TAX INVOICE' : 'NORMAL TRANSPORT BILL'}
                  </div>
                  {invoice.taxMechanism === 'rcm' && (
                    <div className="text-[10px] font-extrabold text-rose-700 uppercase block">
                      * REVERSE CHARGE MECHANISM (RCM)
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">Original for Recipient</p>
                </div>
              </div>
            </div>

            {/* Invoice Meta Grid */}
            <div className={`grid grid-cols-2 ${(invoice.lrNumber || invoice.salesBillNumber) ? 'sm:grid-cols-4' : 'sm:grid-cols-2'} gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4`}>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block font-semibold">Invoice No:</span>
                <span className="font-extrabold text-slate-900 font-mono text-xs">{invoice.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 uppercase block font-semibold">Invoice Date:</span>
                <span className="font-bold text-slate-900">{invoice.invoiceDate}</span>
              </div>
              {invoice.salesBillNumber && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-semibold">Sales Bill No:</span>
                  <span className="font-extrabold text-slate-900 font-mono text-xs">{invoice.salesBillNumber}</span>
                </div>
              )}
              {invoice.salesBillDate && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-semibold">Sales Date:</span>
                  <span className="font-bold text-slate-900">{invoice.salesBillDate}</span>
                </div>
              )}
              {invoice.purchaseBillNumber && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-semibold">Purchase Bill No:</span>
                  <span className="font-extrabold text-slate-900 font-mono text-xs">{invoice.purchaseBillNumber}</span>
                </div>
              )}
              {invoice.purchaseDate && (
                <div>
                  <span className="text-[9px] text-slate-500 uppercase block font-semibold">Purchase Date:</span>
                  <span className="font-bold text-slate-900">{invoice.purchaseDate}</span>
                </div>
              )}
              {invoice.lrNumber && (
                <>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-semibold">LR / Bilty No:</span>
                    <span className="font-extrabold text-slate-900 font-mono text-xs">{invoice.lrNumber}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-semibold">LR Date:</span>
                    <span className="font-bold text-slate-900">{invoice.lrDate}</span>
                  </div>
                </>
              )}
            </div>

            {/* Consignor, Consignee & Ship To Columns */}
            <div className={`grid grid-cols-1 ${invoice.dispatchedPartyName ? ((invoice.shipToName || invoice.shipToAddress) ? 'sm:grid-cols-4' : 'sm:grid-cols-3') : ((invoice.shipToName || invoice.shipToAddress) ? 'sm:grid-cols-3' : 'sm:grid-cols-2')} gap-3 mb-4`}>
              <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                <div className="font-extrabold uppercase text-[10px] text-amber-800 mb-1 border-b pb-1 border-slate-200">
                  BILL TO / CONSIGNOR (SENDER)
                </div>
                <div className="font-bold text-slate-950 text-xs">{invoice.consignorName}</div>
                {invoice.consignorPartyUser && (
                  <div className="text-[10px] font-semibold text-amber-900 mt-0.5">
                    Party User: <span className="font-medium text-slate-800">{invoice.consignorPartyUser}</span>
                  </div>
                )}
                <div className="text-[10px] text-slate-600 mt-0.5">{invoice.consignorAddress}</div>
                {invoice.consignorCity && (
                  <div className="text-[10px] text-slate-700 font-medium mt-0.5">City: {invoice.consignorCity}</div>
                )}
                {invoice.consignorMobile && (
                  <div className="text-[10px] text-slate-700 font-medium">Mob: {invoice.consignorMobile}</div>
                )}
                <div className="text-[10px] font-semibold text-slate-800 mt-1">
                  GSTIN: <span className="font-mono">{invoice.consignorGSTIN || 'URP (Unregistered)'}</span>
                </div>
                <div className="text-[10px] text-slate-600">State: {invoice.consignorState} ({invoice.consignorStateCode})</div>
              </div>

              {invoice.dispatchedPartyName && (
                <div className="border border-amber-200 rounded p-3 bg-amber-50/30">
                  <div className="font-extrabold uppercase text-[10px] text-amber-900 mb-1 border-b pb-1 border-amber-200">
                    DISPATCHED FROM (LOADING SITE)
                  </div>
                  <div className="font-bold text-slate-950 text-xs">{invoice.dispatchedPartyName}</div>
                  {invoice.dispatchedPartyPartyUser && (
                    <div className="text-[10px] font-semibold text-amber-800 mt-0.5">
                      Party User: <span className="font-medium text-slate-800">{invoice.dispatchedPartyPartyUser}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-600 mt-0.5">{invoice.dispatchedPartyAddress || invoice.consignorAddress}</div>
                  {invoice.dispatchedPartyCity && (
                    <div className="text-[10px] text-slate-700 font-medium mt-0.5">City: {invoice.dispatchedPartyCity}</div>
                  )}
                  {invoice.dispatchedPartyMobile && (
                    <div className="text-[10px] text-slate-700 font-medium">Mob: {invoice.dispatchedPartyMobile}</div>
                  )}
                  {invoice.dispatchedPartyGSTIN && (
                    <div className="text-[10px] font-semibold text-slate-800 mt-1">
                      GSTIN: <span className="font-mono">{invoice.dispatchedPartyGSTIN}</span>
                    </div>
                  )}
                  {invoice.dispatchedPartyState && (
                    <div className="text-[10px] text-slate-600">State: {invoice.dispatchedPartyState}</div>
                  )}
                </div>
              )}

              <div className="border border-slate-200 rounded p-3 bg-slate-50/50">
                <div className="font-extrabold uppercase text-[10px] text-slate-700 mb-1 border-b pb-1 border-slate-200">
                  CONSIGNEE (RECEIVER)
                </div>
                <div className="font-bold text-slate-950 text-xs">{invoice.consigneeName}</div>
                {invoice.consigneePartyUser && (
                  <div className="text-[10px] font-semibold text-blue-700 mt-0.5">
                    Party User: <span className="font-medium text-slate-800">{invoice.consigneePartyUser}</span>
                  </div>
                )}
                <div className="text-[10px] text-slate-600 mt-0.5">{invoice.consigneeAddress}</div>
                {invoice.consigneeCity && (
                  <div className="text-[10px] text-slate-700 font-medium mt-0.5">City: {invoice.consigneeCity}</div>
                )}
                {invoice.consigneeMobile && (
                  <div className="text-[10px] text-slate-700 font-medium">Mob: {invoice.consigneeMobile}</div>
                )}
                <div className="text-[10px] font-semibold text-slate-800 mt-1">
                  GSTIN: <span className="font-mono">{invoice.consigneeGSTIN || 'URP (Unregistered)'}</span>
                </div>
                <div className="text-[10px] text-slate-600">State: {invoice.consigneeState}</div>
              </div>

              {(invoice.shipToName || invoice.shipToAddress) && (
                <div className="border border-blue-200 rounded p-3 bg-blue-50/40">
                  <div className="font-extrabold uppercase text-[10px] text-blue-900 mb-1 border-b pb-1 border-blue-200">
                    SHIP TO (DELIVERY SITE)
                  </div>
                  <div className="font-bold text-slate-950 text-xs">{invoice.shipToName || invoice.consigneeName}</div>
                  {invoice.shipToPartyUser && (
                    <div className="text-[10px] font-semibold text-blue-700 mt-0.5">
                      Party User: <span className="font-medium text-slate-800">{invoice.shipToPartyUser}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-600 mt-0.5">{invoice.shipToAddress || invoice.consigneeAddress}</div>
                  {invoice.shipToCity && (
                    <div className="text-[10px] text-slate-700 font-medium mt-0.5">City: {invoice.shipToCity}</div>
                  )}
                  {invoice.shipToMobile && (
                    <div className="text-[10px] text-slate-700 font-medium">Mob: {invoice.shipToMobile}</div>
                  )}
                  {invoice.shipToGSTIN && (
                    <div className="text-[10px] font-semibold text-slate-800 mt-1">
                      GSTIN: <span className="font-mono">{invoice.shipToGSTIN}</span>
                    </div>
                  )}
                  {invoice.shipToState && (
                    <div className="text-[10px] text-slate-600">State: {invoice.shipToState}</div>
                  )}
                </div>
              )}
            </div>

            {/* Transport & Route Details Bar */}
            <div className="bg-slate-100 border border-slate-300 rounded p-2.5 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div>
                <span className="text-slate-500 font-medium block">Route:</span>
                <span className="font-bold text-slate-900">{invoice.origin} ➔ {invoice.destination}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Vehicle No:</span>
                <span className="font-extrabold font-mono text-slate-950">{invoice.vehicleNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Driver Name & Contact:</span>
                <span className="font-semibold text-slate-800">{invoice.driverName} ({invoice.driverPhone})</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Material Type:</span>
                <span className="font-semibold text-slate-800">{invoice.materialType}</span>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border border-slate-300 mb-4 text-[10px]">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase">
                  <th className="border border-slate-300 p-1.5 text-center w-8">#</th>
                  <th className="border border-slate-300 p-1.5 text-left">Description of Service / Freight</th>
                  <th className="border border-slate-300 p-1.5 text-center">Pkgs</th>
                  <th className="border border-slate-300 p-1.5 text-center">Qty / Weight</th>
                  <th className="border border-slate-300 p-1.5 text-right">Rate</th>
                  <th className="border border-slate-300 p-1.5 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-200">
                    <td className="border border-slate-300 p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-slate-300 p-1.5 font-medium">{item.description}</td>
                    <td className="border border-slate-300 p-1.5 text-center">{item.packagesCount || '-'}</td>
                    <td className="border border-slate-300 p-1.5 text-center font-semibold">
                      {Number(item.quantity).toFixed(2)} {item.unit}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-right">₹{item.ratePerTon ? formatINR(item.ratePerTon) : '-'}</td>
                    <td className="border border-slate-300 p-1.5 text-right font-bold">₹{formatINR(item.amount)}</td>

                  </tr>
                ))}
              </tbody>
            </table>

            {/* Freight Charges & Tax Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              
              {/* Left Column: Bank Details & Notes */}
              <div className="space-y-3">
                <div className="bg-amber-50/70 border border-amber-200 rounded p-2.5 text-[10px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-bold text-amber-950 uppercase mb-1 flex items-center space-x-1">
                        <Building2 className="w-3 h-3 text-amber-700" />
                        <span>BANK ACCOUNT FOR PAYMENT</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-800 font-medium">
                        <span>Bank Name:</span> <span className="font-bold">{settings.bankName}</span>
                        <span>Account No:</span> <span className="font-mono font-bold">{settings.bankAccountNo}</span>
                        <span>IFSC Code:</span> <span className="font-mono font-bold">{settings.bankIfsc}</span>
                        <span>Branch:</span> <span>{settings.bankBranch}</span>
                        {settings.upiId && (
                          <>
                            <span>UPI ID:</span> <span className="font-mono font-bold text-blue-700">{settings.upiId}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* QR Code for Instant Scan & Pay */}
                    <div className="shrink-0 text-center">
                      <img
                        crossOrigin="anonymous"
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`upi://pay?pa=${settings.upiId || '9687709315@upi'}&pn=${settings.companyName}&am=${invoice.balanceDue}&tn=${'Bill-' + invoice.invoiceNumber}&cu=INR`)}`}
                        alt="Scan & Pay UPI QR"
                        className="w-16 h-16 border border-amber-300 rounded p-0.5 bg-white mx-auto"
                      />
                      <span className="text-[8px] font-bold text-amber-900 block mt-0.5 uppercase tracking-tighter">
                        Scan to Pay
                      </span>
                    </div>
                  </div>
                </div>

                {isTaxInvoice && (
                  <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[9.5px]">
                    <div className="font-bold text-slate-800 uppercase mb-0.5">GST Declaration & Tax Slab</div>
                    <p className="text-slate-600 leading-tight">
                      Tax Slab Applicable: <span className="font-bold text-slate-900">{invoice.taxSlab}%</span> | 
                      Type: <span className="font-bold uppercase text-slate-900">{invoice.taxType === 'intra_state' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}</span>
                    </p>
                    {invoice.taxMechanism === 'rcm' ? (
                      <p className="text-rose-700 font-bold mt-1">
                        GST is payable by the Recipient of Service under Reverse Charge Mechanism (RCM) Notification No. 13/2017-Central Tax (Rate).
                      </p>
                    ) : (
                      <p className="text-emerald-800 font-semibold mt-1">
                        GST charged under Forward Charge Mechanism.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Calculation Breakdown */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-[10px]">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 font-medium text-slate-600">Gross Freight:</td>
                      <td className="p-1.5 text-right font-semibold">₹{formatINR(invoice.grossFreight)}</td>
                    </tr>
                    {invoice.loadingCharges > 0 && (
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 font-medium text-slate-600">Loading Charges:</td>
                        <td className="p-1.5 text-right font-semibold">₹{formatINR(invoice.loadingCharges)}</td>
                      </tr>
                    )}
                    {invoice.unloadingCharges > 0 && (
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 font-medium text-slate-600">Unloading Charges:</td>
                        <td className="p-1.5 text-right font-semibold">₹{formatINR(invoice.unloadingCharges)}</td>
                      </tr>
                    )}
                    {invoice.detentionCharges > 0 && (
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 font-medium text-slate-600">Detention / Holding:</td>
                        <td className="p-1.5 text-right font-semibold">₹{formatINR(invoice.detentionCharges)}</td>
                      </tr>
                    )}
                    {invoice.otherCharges > 0 && (
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 font-medium text-slate-600">Other Charges:</td>
                        <td className="p-1.5 text-right font-semibold">₹{formatINR(invoice.otherCharges)}</td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-300 bg-slate-50 font-bold">
                      <td className="p-1.5 text-slate-800">Sub Total:</td>
                      <td className="p-1.5 text-right text-slate-900">₹{formatINR(invoice.subTotal)}</td>
                    </tr>

                    {/* Tax Breakdown */}
                    {isTaxInvoice && invoice.taxMechanism === 'forward_charge' && (
                      <>
                        {invoice.taxType === 'intra_state' ? (
                          <>
                            <tr className="border-b border-slate-200 text-slate-700">
                              <td className="p-1.5">CGST ({invoice.cgstRate}%):</td>
                              <td className="p-1.5 text-right font-semibold">₹{formatINR(invoice.cgstAmount)}</td>
                            </tr>
                            <tr className="border-b border-slate-200 text-slate-700">
                              <td className="p-1.5">SGST ({invoice.sgstRate}%):</td>
                              <td className="p-1.5 text-right font-semibold">₹{formatINR(invoice.sgstAmount)}</td>
                            </tr>
                          </>
                        ) : (
                          <tr className="border-b border-slate-200 text-slate-700">
                            <td className="p-1.5">IGST ({invoice.igstRate}%):</td>
                            <td className="p-1.5 text-right font-semibold">₹{formatINR(invoice.igstAmount)}</td>
                          </tr>
                        )}
                      </>
                    )}

                    {invoice.roundOff !== undefined && invoice.roundOff !== 0 && (
                      <tr className="border-b border-slate-200 text-slate-700 font-medium">
                        <td className="p-1.5">Round Off:</td>
                        <td className="p-1.5 text-right font-mono font-semibold">
                          {invoice.roundOff > 0 ? '+' : ''}₹{formatINR(invoice.roundOff)}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-slate-900 text-white font-extrabold text-xs">
                      <td className="p-2">GRAND TOTAL:</td>
                      <td className="p-2 text-right">₹{formatINR(invoice.grandTotal)}</td>
                    </tr>

                    {/* Advances, TDS & Net Payable */}
                    {invoice.advancePaid > 0 && (
                      <tr className="border-t border-slate-200 text-rose-700">
                        <td className="p-1.5 font-medium">Less: Advance Paid:</td>
                        <td className="p-1.5 text-right font-bold">- ₹{formatINR(invoice.advancePaid)}</td>
                      </tr>
                    )}
                    {invoice.fuelDeduction > 0 && (
                      <tr className="border-t border-slate-200 text-rose-700">
                        <td className="p-1.5 font-medium">Less: Fuel Slip Advance:</td>
                        <td className="p-1.5 text-right font-bold">- ₹{formatINR(invoice.fuelDeduction)}</td>
                      </tr>
                    )}
                    {invoice.kasarDeduction !== undefined && invoice.kasarDeduction > 0 && (
                      <tr className="border-t border-slate-200 text-emerald-800 bg-emerald-50/50">
                        <td className="p-1.5 font-semibold">Less: Kasar / Lump-Sum Discount:</td>
                        <td className="p-1.5 text-right font-bold font-mono text-emerald-900">- ₹{formatINR(invoice.kasarDeduction)}</td>
                      </tr>
                    )}
                    {invoice.tdsAmount !== undefined && invoice.tdsAmount > 0 && (
                      <tr className="border-t border-slate-200 text-purple-800 bg-purple-50/50">
                        <td className="p-1.5 font-semibold">
                          Less: TDS u/s 194C ({invoice.tdsDeducteeType === 'individual' ? '1% Individual/HUF' : invoice.tdsDeducteeType === 'company' ? '2% Company/Firm' : `${invoice.tdsRate || 0}%`}):
                        </td>
                        <td className="p-1.5 text-right font-bold font-mono text-purple-900">- ₹{formatINR(invoice.tdsAmount)}</td>
                      </tr>
                    )}

                    <tr className="bg-amber-100 border-t-2 border-amber-500 text-amber-950 font-black text-xs">
                      <td className="p-2 uppercase">NET BALANCE PAYABLE:</td>
                      <td className="p-2 text-right text-sm">₹{formatINR(invoice.balanceDue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Terms & Signatures */}
            <div className="border-t border-slate-300 pt-3 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-[9px] text-slate-600">
              <div>
                <div className="font-bold text-slate-800 uppercase mb-1">Terms & Conditions:</div>
                <ol className="list-decimal pl-3 space-y-0.5">
                  {settings.termsAndConditions.map((term, i) => (
                    <li key={i}>{term}</li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col justify-between items-end text-right pt-4 sm:pt-0">
                <div className="text-slate-800 font-bold">For {settings.companyName}</div>
                <div className="mt-8 pt-2 border-t border-slate-400 w-36 text-center font-bold text-slate-900">
                  Authorized Signatory
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
