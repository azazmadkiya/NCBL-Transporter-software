import React, { useMemo } from 'react';
import { Invoice, Vehicle, Party, UserRole, formatINR } from '../types';
import { 
  Truck, FileText, CreditCard, Users, TrendingUp, PlusCircle, ArrowUpRight, BarChart3, Edit, Trash2, Printer 
} from 'lucide-react';

interface DashboardProps {
  invoices: Invoice[];
  vehicles: Vehicle[];
  parties: Party[];
  userRole: UserRole;
  onNavigate: (tab: string) => void;
  onSelectInvoice: (invoice: Invoice) => void;
  onEditInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoiceId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  invoices,
  vehicles,
  parties,
  userRole,
  onNavigate,
  onSelectInvoice,
  onEditInvoice,
  onDeleteInvoice
}) => {
  const { totalTurnover, totalOutstanding, totalCollected, activeTrucksCount, rcmTurnover, recentInvoices } = useMemo(() => {
    let turnover = 0;
    let outstanding = 0;
    let collected = 0;
    let rcm = 0;

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      turnover += inv.subTotal || 0;
      outstanding += inv.balanceDue || 0;
      collected += inv.amountPaid || 0;
      if (inv.invoiceType === 'tax_invoice' && inv.taxMechanism === 'rcm') {
        rcm += inv.subTotal || 0;
      }
    }

    const activeTrucks = vehicles.filter(v => v.status === 'in_transit' || v.status === 'available').length;
    const recent = invoices.slice(0, 5);

    return {
      totalTurnover: turnover,
      totalOutstanding: outstanding,
      totalCollected: collected,
      activeTrucksCount: activeTrucks,
      rcmTurnover: rcm,
      recentInvoices: recent
    };
  }, [invoices, vehicles]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      
      {/* Top Welcome Banner */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <div className="inline-block bg-blue-50 text-blue-700 border border-blue-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded mb-1">
            NCBL TRANSPORT MANAGEMENT SYSTEM
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Logistics & Transport Invoicing Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time control for Tax Invoices, Normal Freight Bills, Transporter Party Ledgers & Fleet Profitability.
          </p>
        </div>

        {['admin', 'accountant'].includes(userRole) && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('create_invoice')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded text-xs transition-all shadow-xs flex items-center space-x-1.5 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>CREATE NEW INVOICE</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        
        {/* Card 1: Gross Freight */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Gross Freight Turnover</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-slate-800">₹{formatINR(totalTurnover)}</span>
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">{invoices.length} Total Bills</p>
        </div>

        {/* Card 2: Pending Receivables */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs border-l-4 border-l-red-500">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Outstanding Party Dues</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-red-600">₹{formatINR(totalOutstanding)}</span>
            <span className="p-1.5 bg-red-50 text-red-600 rounded"><CreditCard className="w-4 h-4" /></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Collected: <strong className="text-green-600 font-bold">₹{formatINR(totalCollected)}</strong></p>
        </div>

        {/* Card 3: Active Fleet */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Active Fleet Vehicles</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-slate-800">{activeTrucksCount} / {vehicles.length}</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded"><Truck className="w-4 h-4" /></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Trucks in Transit & Ready</p>
        </div>

        {/* Card 4: RCM Reverse Charge */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase">RCM Transport Turnover</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold font-mono text-slate-800">₹{formatINR(rcmTurnover)}</span>
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded"><BarChart3 className="w-4 h-4" /></span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Recipient GST under RCM</p>
        </div>


      </div>

      {/* Quick Action Hub & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Quick Shortcuts */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-xs">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quick Module Actions</h3>

          <div className="space-y-1.5 text-xs">
            {['admin', 'accountant'].includes(userRole) && (
              <>
                <button
                  onClick={() => onNavigate('create_invoice')}
                  className="w-full text-left bg-slate-50 hover:bg-blue-50 p-2.5 rounded border border-slate-200 flex items-center justify-between transition-colors font-semibold text-slate-800 hover:text-blue-700"
                >
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Create Tax Invoice / Bilty</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('transporter_ledger')}
                  className="w-full text-left bg-slate-50 hover:bg-blue-50 p-2.5 rounded border border-slate-200 flex items-center justify-between transition-colors font-semibold text-slate-800 hover:text-blue-700"
                >
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Transporter Party Ledgers</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  onClick={() => onNavigate('payments')}
                  className="w-full text-left bg-slate-50 hover:bg-blue-50 p-2.5 rounded border border-slate-200 flex items-center justify-between transition-colors font-semibold text-slate-800 hover:text-blue-700"
                >
                  <div className="flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-red-500" />
                    <span>Record Payment Received</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </>
            )}

            <button
              onClick={() => onNavigate('truck_ledger')}
              className="w-full text-left bg-slate-50 hover:bg-blue-50 p-2.5 rounded border border-slate-200 flex items-center justify-between transition-colors font-semibold text-slate-800 hover:text-blue-700"
            >
              <div className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-purple-600" />
                <span>Truck Operating Expenses & P&L</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={() => onNavigate('driver_mode')}
              className="w-full text-left bg-slate-50 hover:bg-blue-50 p-2.5 rounded border border-slate-200 flex items-center justify-between transition-colors font-semibold text-slate-800 hover:text-blue-700"
            >
              <div className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-slate-600" />
                <span>Driver Mobile Portal</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-3.5 space-y-3 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Recent Ledger Transactions
            </h3>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs text-blue-700 hover:underline font-bold"
            >
              View All ➔
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Inv #</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Party Name</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Type</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-right">Net Bill (₹)</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-center">Status</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {recentInvoices.map(inv => (
                  <tr 
                    key={inv.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-bold text-blue-700 cursor-pointer" onClick={() => onSelectInvoice(inv)}>
                      {inv.invoiceNumber}
                      <div className="text-[10px] text-slate-400 font-normal">{inv.invoiceDate}</div>
                    </td>
                    <td className="px-3 py-2.5 font-sans font-bold text-slate-800">{inv.consignorName}</td>
                    <td className="px-3 py-2.5">
                      {inv.invoiceType === 'tax_invoice' ? (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold font-sans">TAX BILL</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold font-sans">NORMAL</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                      ₹{formatINR(inv.netPayable)}
                    </td>

                    <td className="px-3 py-2.5 text-center font-sans font-bold">
                      {inv.paymentStatus === 'paid' && <span className="text-green-600">PAID</span>}
                      {inv.paymentStatus === 'partial' && <span className="text-orange-500">PARTIAL</span>}
                      {inv.paymentStatus === 'unpaid' && <span className="text-red-600">UNPAID</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-sans">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onSelectInvoice(inv)}
                          title="Print / View PDF"
                          className="p-1 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {onEditInvoice && ['admin', 'accountant'].includes(userRole) && (
                          <button
                            onClick={() => onEditInvoice(inv)}
                            title="Edit Invoice"
                            className="p-1 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteInvoice && ['admin', 'accountant'].includes(userRole) && (
                          <button
                            onClick={() => onDeleteInvoice(inv.id)}
                            title="Delete Invoice"
                            className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
