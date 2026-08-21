import React, { useState } from 'react';
import { Invoice, CompanySettings, formatINR } from '../types';
import { BarChart3, Download, Printer, Shield, Calendar, FileSpreadsheet } from 'lucide-react';

import { UserRole } from '../types';

interface TaxReportsViewProps {
  userRole?: UserRole;
  invoices: Invoice[];
  settings: CompanySettings;
}

export const TaxReportsView: React.FC<TaxReportsViewProps> = ({
  userRole = 'admin',
  invoices,
  settings
}) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-08');

  // Filter invoices for selected month
  const monthlyInvoices = invoices.filter(inv => inv.invoiceDate.startsWith(selectedMonth));
  const taxInvoices = monthlyInvoices.filter(inv => inv.invoiceType === 'tax_invoice');

  // RCM vs Forward Charge breakdown
  const rcmInvoices = taxInvoices.filter(inv => inv.taxMechanism === 'rcm');
  const forwardInvoices = taxInvoices.filter(inv => inv.taxMechanism === 'forward_charge');

  // Calculations
  const totalFreightTurnover = monthlyInvoices.reduce((acc, inv) => acc + inv.subTotal, 0);
  
  const totalForwardTaxable = forwardInvoices.reduce((acc, inv) => acc + inv.subTotal, 0);
  const totalForwardCGST = forwardInvoices.reduce((acc, inv) => acc + inv.cgstAmount, 0);
  const totalForwardSGST = forwardInvoices.reduce((acc, inv) => acc + inv.sgstAmount, 0);
  const totalForwardIGST = forwardInvoices.reduce((acc, inv) => acc + inv.igstAmount, 0);
  const totalForwardTaxBilled = totalForwardCGST + totalForwardSGST + totalForwardIGST;

  const totalRcmTaxable = rcmInvoices.reduce((acc, inv) => acc + inv.subTotal, 0);
  const totalRcmTaxAmount = rcmInvoices.reduce((acc, inv) => acc + inv.totalTax, 0);

  // TDS Section 194C Total
  const totalTdsDeducted = monthlyInvoices.reduce((acc, inv) => acc + (inv.tdsAmount || 0), 0);
  const tdsInvoicesCount = monthlyInvoices.filter(inv => (inv.tdsAmount || 0) > 0).length;

  // Tax slab breakdown
  const slabBreakdown = [5, 12, 18, 28].map(slab => {
    const slabInvs = taxInvoices.filter(inv => inv.taxSlab === slab);
    const taxableValue = slabInvs.reduce((acc, inv) => acc + inv.subTotal, 0);
    const taxValue = slabInvs.reduce((acc, inv) => acc + inv.totalTax, 0);
    return {
      slab,
      count: slabInvs.length,
      taxableValue,
      taxValue
    };
  });

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Invoice No,LR No,Invoice Date,Party Name,GSTIN,Type,Tax Slab,Tax Mechanism,Taxable Freight,CGST,SGST,IGST,Grand Total\n";

    monthlyInvoices.forEach(inv => {
      csvContent += `"${inv.invoiceNumber}","${inv.lrNumber}","${inv.invoiceDate}","${inv.consignorName}","${inv.consignorGSTIN}","${inv.invoiceType}","${inv.taxSlab}%","${inv.taxMechanism}",${inv.subTotal},${inv.cgstAmount},${inv.sgstAmount},${inv.igstAmount},${inv.grandTotal}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GST_Report_${selectedMonth}_NCBLTransport.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-blue-700" />
            <span>GST & Tax Compliance Summary (GSTR-1 / GSTR-3B)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated tax slab calculations, RCM reverse charge records & forward charge GST summary for NCBL Transport.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-700" />
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-800 font-bold focus:outline-none"
            />
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-slate-800 shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Total Freight Turnover</span>
          <div className="text-xl font-mono font-bold text-slate-900 mt-0.5">
            ₹{formatINR(totalFreightTurnover)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{monthlyInvoices.length} Total Bills in {selectedMonth}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 text-slate-800 shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Forward GST Billed</span>
          <div className="text-xl font-mono font-bold text-emerald-700 mt-0.5">
            ₹{formatINR(totalForwardTaxBilled)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Taxable: ₹{formatINR(totalForwardTaxable)}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 text-slate-800 shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Reverse Charge (RCM)</span>
          <div className="text-xl font-mono font-bold text-blue-700 mt-0.5">
            ₹{formatINR(totalRcmTaxable)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">RCM Tax (5%): ₹{formatINR(totalRcmTaxAmount)}</div>
        </div>

        <div className="bg-white border border-purple-200 bg-purple-50/50 rounded-lg p-3 text-slate-800 shadow-xs">
          <span className="text-[10px] text-purple-900 uppercase font-bold">TDS Deducted (u/s 194C)</span>
          <div className="text-xl font-mono font-bold text-purple-900 mt-0.5">
            ₹{formatINR(totalTdsDeducted)}
          </div>
          <div className="text-[10px] text-purple-700 mt-0.5">{tdsInvoicesCount} Bills with TDS Deduction</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3 text-slate-800 shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold">CGST+SGST vs IGST</span>
          <div className="text-xs font-bold text-slate-800 mt-1 space-y-0.5">
            <div className="flex justify-between">
              <span>CGST+SGST:</span>
              <span className="font-mono text-emerald-700">₹{formatINR(totalForwardCGST + totalForwardSGST)}</span>
            </div>
            <div className="flex justify-between">
              <span>IGST:</span>
              <span className="font-mono text-emerald-700">₹{formatINR(totalForwardIGST)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Tax Slabs Summary Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 space-y-3 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
          Tax Slab Breakdown ({selectedMonth})
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {slabBreakdown.map(s => (
            <div key={s.slab} className="bg-slate-50 p-3 rounded border border-slate-200 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-blue-700 text-xs">{s.slab}% Tax Slab</span>
                <span className="text-[9px] bg-white border border-slate-300 text-slate-600 font-bold px-1.5 py-0.2 rounded">{s.count} Invoices</span>
              </div>
              <div className="text-slate-500 text-[10px]">Taxable: <span className="text-slate-900 font-bold font-mono">₹{formatINR(s.taxableValue)}</span></div>
              <div className="text-slate-500 text-[10px] mt-0.5">Tax Amt: <span className="text-emerald-700 font-bold font-mono">₹{formatINR(s.taxValue)}</span></div>
            </div>
          ))}
        </div>
      </div>


      {/* Detailed Monthly Tax Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="p-3 border-b border-slate-200 font-bold text-xs text-slate-900 flex justify-between items-center bg-slate-50">
          <span>Invoices Issued in {selectedMonth}</span>
          <span className="text-xs font-normal text-slate-500">{monthlyInvoices.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                <th className="p-2.5">Inv Date</th>
                <th className="p-2.5">Invoice No</th>
                <th className="p-2.5">Party Name</th>
                <th className="p-2.5">GSTIN</th>
                <th className="p-2.5">Type / Mechanism</th>
                <th className="p-2.5 text-right">Freight (₹)</th>
                <th className="p-2.5 text-right">CGST</th>
                <th className="p-2.5 text-right">SGST</th>
                <th className="p-2.5 text-right">IGST</th>
                <th className="p-2.5 text-right font-mono">Total (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {monthlyInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400">
                    No invoices recorded for month {selectedMonth}.
                  </td>
                </tr>
              ) : (
                monthlyInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono text-slate-600">{inv.invoiceDate}</td>
                    <td className="p-2.5">
                      <div className="font-mono font-bold text-blue-700">{inv.invoiceNumber}</div>
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">{inv.consignorName}</td>
                    <td className="p-2.5 font-mono text-slate-500">{inv.consignorGSTIN || 'URP'}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        inv.taxMechanism === 'rcm' ? 'bg-blue-100 text-blue-800' :
                        inv.invoiceType === 'tax_invoice' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inv.invoiceType === 'normal_bill' ? 'NON-TAX' : inv.taxMechanism.toUpperCase()} ({inv.taxSlab}%)
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-900">₹{formatINR(inv.subTotal)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-500">{inv.cgstAmount ? `₹${formatINR(inv.cgstAmount)}` : '-'}</td>
                    <td className="p-2.5 text-right font-mono text-slate-500">{inv.sgstAmount ? `₹${formatINR(inv.sgstAmount)}` : '-'}</td>
                    <td className="p-2.5 text-right font-mono text-slate-500">{inv.igstAmount ? `₹${formatINR(inv.igstAmount)}` : '-'}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-blue-900">₹{formatINR(inv.grandTotal)}</td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
