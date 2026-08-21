import React, { useState, useMemo } from 'react';
import { Vehicle, Invoice, Expense, formatINR, UserProfile, UserRole } from '../types';
import { 
  Truck, Fuel, MapPin, CheckCircle2, Plus, Clock, Phone, Navigation, ShieldCheck,
  Receipt, DollarSign, Wrench, AlertTriangle, Utensils, CreditCard, Trash2, Calendar,
  FileText, ArrowRight, UserCheck, ShieldAlert
} from 'lucide-react';

interface DriverMobileViewProps {
  vehicles: Vehicle[];
  invoices: Invoice[];
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
  currentUser?: UserProfile | null;
  userRole?: UserRole;
  driverTruckNumber?: string;
  driverName?: string;
}

export const DriverMobileView: React.FC<DriverMobileViewProps> = ({
  vehicles = [],
  invoices = [],
  expenses = [],
  onAddExpense,
  onDeleteExpense,
  currentUser = null,
  userRole = 'driver',
  driverTruckNumber,
  driverName
}) => {
  // Determine if this session is strictly a locked driver user session
  const isDriverRole = userRole === 'driver' || currentUser?.role === 'driver';

  // Resolved locked driver vehicle and driver name
  const effectiveTruckNumber = (
    currentUser?.truckNumber || 
    driverTruckNumber || 
    vehicles[0]?.vehicleNumber || 
    'TRUCK-01'
  ).toUpperCase();

  const effectiveDriverName = (
    currentUser?.driverName || 
    currentUser?.displayName || 
    driverName || 
    'Fleet Driver'
  ).toUpperCase();

  // Selected truck state (admin can switch; driver is locked)
  const [selectedTruck, setSelectedTruck] = useState<string>(effectiveTruckNumber);
  const activeTruckNumber = isDriverRole ? effectiveTruckNumber : selectedTruck;

  // Active sub-tab in Driver Portal
  const [activeTab, setActiveTab] = useState<'current_trip' | 'all_trips' | 'expenses'>('current_trip');

  // Expense Modal States
  const [showLogExpenseModal, setShowLogExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<Expense['category']>('fuel');
  const [liters, setLiters] = useState(150);
  const [ratePerLiter, setRatePerLiter] = useState(92);
  const [pumpVendor, setPumpVendor] = useState('Indian Oil Highway');
  const [slipNumber, setSlipNumber] = useState('');
  const [miscAmount, setMiscAmount] = useState<number>(500);
  const [paymentMode, setPaymentMode] = useState<Expense['paidMode']>('fuel_card');
  const [expenseRemarks, setExpenseRemarks] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  // Match vehicle details from fleet
  const assignedVehicle = useMemo(() => {
    return vehicles.find(v => v.vehicleNumber.toUpperCase() === activeTruckNumber.toUpperCase()) || {
      id: `veh-${activeTruckNumber}`,
      vehicleNumber: activeTruckNumber,
      vehicleType: '14 Wheeler Truck',
      driverName: effectiveDriverName,
      driverPhone: currentUser?.phone || '+91 98765 43210',
      ownerType: 'own' as const,
      status: 'in_transit' as const,
      capacityTons: 25,
      totalFreightEarned: 0,
      totalExpenses: 0,
      createdAt: new Date().toISOString()
    };
  }, [vehicles, activeTruckNumber, effectiveDriverName, currentUser?.phone]);

  // Filter trips strictly for this vehicle only
  const assignedInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const vNum = inv.vehicleNumber?.trim().toUpperCase();
      const targetV = activeTruckNumber.trim().toUpperCase();
      if (vNum === targetV) return true;
      // Also match by driver/transporter name if available
      if (inv.driverName && effectiveDriverName) {
        return inv.driverName.toUpperCase().includes(effectiveDriverName.toUpperCase());
      }
      return false;
    });
  }, [invoices, activeTruckNumber, effectiveDriverName]);

  // Current newest trip
  const currentTrip = assignedInvoices[0] || null;

  // Filter expenses strictly for this vehicle only
  const truckExpenses = useMemo(() => {
    return expenses.filter(exp => 
      exp.vehicleNumber?.trim().toUpperCase() === activeTruckNumber.trim().toUpperCase()
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, activeTruckNumber]);

  // Statistics calculation for this truck
  const stats = useMemo(() => {
    const totalFreight = assignedInvoices.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
    const totalAdvance = assignedInvoices.reduce((sum, i) => sum + (i.advancePaid || 0), 0);
    const totalFuelDeduction = assignedInvoices.reduce((sum, i) => sum + (i.fuelDeduction || 0), 0);
    const totalLoggedExpenses = truckExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      tripsCount: assignedInvoices.length,
      totalFreight,
      totalAdvance,
      totalFuelDeduction,
      totalLoggedExpenses
    };
  }, [assignedInvoices, truckExpenses]);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();

    let finalAmount = miscAmount;
    let finalRemarks = expenseRemarks.trim();

    if (expenseCategory === 'fuel') {
      finalAmount = Math.round(liters * ratePerLiter);
      finalRemarks = `${liters} Ltr Diesel @ ₹${ratePerLiter}/L • ${pumpVendor} ${slipNumber ? `(Slip: ${slipNumber})` : ''} ${expenseRemarks ? `• ${expenseRemarks}` : ''}`.trim();
    }

    const newExp: Expense = {
      id: `exp-drv-${Date.now()}`,
      date: expenseDate,
      vehicleNumber: activeTruckNumber,
      lrNumber: currentTrip?.lrNumber || '',
      category: expenseCategory,
      amount: finalAmount,
      paidMode: paymentMode,
      vendorName: expenseCategory === 'fuel' ? pumpVendor : (pumpVendor || 'Highway Vendor'),
      receiptNumber: slipNumber,
      remarks: finalRemarks,
      recordedBy: effectiveDriverName,
      createdAt: new Date().toISOString()
    };

    onAddExpense(newExp);
    setShowLogExpenseModal(false);
    
    // Reset form
    setSlipNumber('');
    setExpenseRemarks('');
  };

  return (
    <div className="max-w-xl mx-auto space-y-3 pb-12 px-1">
      
      {/* Mobile Driver Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-800 shadow-sm space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-lg bg-blue-700 text-white font-black flex items-center justify-center text-base shadow-xs shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wider font-extrabold text-blue-700 flex items-center space-x-1">
                <span>DRIVER TRIPS PORTAL</span>
                <span className="bg-emerald-100 text-emerald-800 text-[9.5px] px-1.5 py-0.2 rounded font-bold">LIVE</span>
              </div>
              <div className="text-lg font-mono font-black text-slate-900 leading-tight">
                {activeTruckNumber}
              </div>
              <div className="text-xs font-bold text-slate-600 flex items-center space-x-1 mt-0.5">
                <span className="text-slate-400">Driver:</span>
                <span className="text-blue-900 font-extrabold">{effectiveDriverName}</span>
              </div>
            </div>
          </div>

          {/* Admin Switcher or Driver Lock Badge */}
          {isDriverRole ? (
            <div className="text-right">
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-1 rounded-lg shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Locked Account</span>
              </span>
            </div>
          ) : (
            <div className="text-right space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Switch Vehicle:</span>
              <select
                value={selectedTruck}
                onChange={e => setSelectedTruck(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-blue-700 font-mono font-bold text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 shadow-2xs"
              >
                {vehicles.map(v => (
                  <option key={v.id} value={v.vehicleNumber}>
                    {v.vehicleNumber} ({v.driverName || 'Driver'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Security & Access Level Notice */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block font-bold uppercase">Assigned Truck</span>
            <span className="font-mono font-bold text-slate-900">{activeTruckNumber}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-bold uppercase">Vehicle Type</span>
            <span className="font-bold text-slate-800">{assignedVehicle?.vehicleType || 'Standard Truck'}</span>
          </div>
        </div>

        {/* Strict Data Isolation Indicator */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-lg p-2 text-[11px] text-blue-950 flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
          <span className="font-medium">
            Showing only data for <strong>{activeTruckNumber}</strong> ({effectiveDriverName}). Financial & customer ledgers are isolated.
          </span>
        </div>
      </div>

      {/* Driver Summary Metrics */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs text-center space-y-0.5">
          <span className="text-[10px] text-slate-500 block font-bold uppercase">Total Trips</span>
          <span className="text-base font-mono font-black text-blue-900">{stats.tripsCount}</span>
        </div>
        <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs text-center space-y-0.5">
          <span className="text-[10px] text-slate-500 block font-bold uppercase">Advances</span>
          <span className="text-base font-mono font-black text-emerald-700">₹{formatINR(stats.totalAdvance)}</span>
        </div>
        <div className="bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs text-center space-y-0.5">
          <span className="text-[10px] text-slate-500 block font-bold uppercase">Expenses</span>
          <span className="text-base font-mono font-black text-red-700">₹{formatINR(stats.totalLoggedExpenses)}</span>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-2xs text-xs font-bold">
        <button
          onClick={() => setActiveTab('current_trip')}
          className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center space-x-1.5 ${
            activeTab === 'current_trip'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Active Trip</span>
        </button>

        <button
          onClick={() => setActiveTab('all_trips')}
          className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center space-x-1.5 ${
            activeTab === 'all_trips'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>All Trips ({assignedInvoices.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 py-2 rounded-lg transition-all text-center flex items-center justify-center space-x-1.5 ${
            activeTab === 'expenses'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Fuel className="w-3.5 h-3.5" />
          <span>Expenses ({truckExpenses.length})</span>
        </button>
      </div>

      {/* TAB 1: CURRENT ACTIVE TRIP */}
      {activeTab === 'current_trip' && (
        <div className="space-y-3">
          {currentTrip ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-800 space-y-3 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-blue-900 uppercase">
                  <Navigation className="w-4 h-4 text-blue-700" />
                  <span>Current Assigned Trip / LR Details</span>
                </div>
                <span className="font-mono text-xs font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                  LR: {currentTrip.lrNumber}
                </span>
              </div>

              {/* Route Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200/80 p-3 rounded-lg space-y-2 text-xs">
                <div className="flex items-center space-x-2 font-black text-blue-950 text-sm">
                  <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>{currentTrip.origin}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{currentTrip.destination}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-100 text-slate-700 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">Consignor / Sender</span>
                    <span className="font-semibold">{currentTrip.consignorName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">Consignee / Destination</span>
                    <span className="font-semibold">{currentTrip.shipToName || currentTrip.consigneeName}</span>
                  </div>
                </div>

                <div className="text-slate-700 text-xs flex items-center justify-between pt-1 border-t border-blue-100">
                  <div>
                    <span className="text-slate-500 font-bold">Material:</span> {currentTrip.materialType || 'Industrial Load'}
                  </div>
                  <div className="font-mono font-bold text-blue-900">
                    Weight: {currentTrip.items[0]?.quantity || 10} {currentTrip.items[0]?.unit || 'MT'}
                  </div>
                </div>
              </div>

              {/* Trip Financials */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-[9.5px] text-slate-500 block uppercase font-bold">Trip Freight</span>
                  <span className="font-mono font-black text-slate-900 text-xs">₹{formatINR(currentTrip.grandTotal)}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-[9.5px] text-slate-500 block uppercase font-bold">Advance Paid</span>
                  <span className="font-mono font-black text-emerald-700 text-xs">₹{formatINR(currentTrip.advancePaid)}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
                  <span className="text-[9.5px] text-slate-500 block uppercase font-bold">Diesel Cut</span>
                  <span className="font-mono font-black text-blue-900 text-xs">₹{formatINR(currentTrip.fuelDeduction)}</span>
                </div>
              </div>

              {/* Quick Action Button to Log Expense */}
              <button
                onClick={() => {
                  setExpenseCategory('fuel');
                  setShowLogExpenseModal(true);
                }}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 rounded-lg text-xs transition-all shadow-xs flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ Log Fuel / Trip Expense Slip</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs space-y-2 shadow-sm">
              <Truck className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-slate-700 text-sm">No Active Trips Assigned</div>
              <p className="text-slate-400 max-w-xs mx-auto">
                No active transport trips found for vehicle <strong>{activeTruckNumber}</strong>. When a new invoice is billed, it will appear here.
              </p>
              <button
                onClick={() => {
                  setExpenseCategory('fuel');
                  setShowLogExpenseModal(true);
                }}
                className="mt-3 inline-flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Vehicle Fuel / Expense</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALL TRIPS FOR THIS VEHICLE */}
      {activeTab === 'all_trips' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-800 space-y-3 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Receipt className="w-4 h-4 text-blue-700" />
              <span>Assigned Trips History ({assignedInvoices.length})</span>
            </h4>
            <span className="font-mono text-xs font-bold text-slate-500">{activeTruckNumber}</span>
          </div>

          {assignedInvoices.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              No trip history recorded for truck {activeTruckNumber}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {assignedInvoices.map((inv) => (
                <div key={inv.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-blue-800">LR: {inv.lrNumber}</span>
                      <span className="text-[10px] text-slate-500 ml-2">Inv #{inv.invoiceNumber}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{inv.invoiceDate || inv.lrDate}</span>
                  </div>

                  <div className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs">
                    <span>{inv.origin}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span>{inv.destination}</span>
                  </div>

                  <div className="text-[11px] text-slate-600">
                    <span className="text-slate-400">Party:</span> {inv.consignorName}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-200/60 text-[11px] font-mono">
                    <div>
                      <span className="text-[9.5px] text-slate-400 block font-sans">Freight:</span>
                      <strong className="text-slate-900">₹{formatINR(inv.grandTotal)}</strong>
                    </div>
                    <div>
                      <span className="text-[9.5px] text-slate-400 block font-sans">Advance:</span>
                      <strong className="text-emerald-700">₹{formatINR(inv.advancePaid)}</strong>
                    </div>
                    <div>
                      <span className="text-[9.5px] text-slate-400 block font-sans">Diesel:</span>
                      <strong className="text-blue-900">₹{formatINR(inv.fuelDeduction)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXPENSES LOGGED */}
      {activeTab === 'expenses' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-800 space-y-3 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Fuel className="w-4 h-4 text-blue-700" />
              <span>Logged Expenses ({truckExpenses.length})</span>
            </h4>
            <button
              onClick={() => {
                setExpenseCategory('fuel');
                setShowLogExpenseModal(true);
              }}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-2.5 py-1 rounded text-xs transition-all shadow-xs flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Expense</span>
            </button>
          </div>

          {truckExpenses.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs space-y-2">
              <Fuel className="w-8 h-8 text-slate-300 mx-auto" />
              <div>No fuel or trip expenses logged for {activeTruckNumber} yet.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {truckExpenses.map(exp => (
                <div key={exp.id} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center text-xs hover:bg-slate-100/80 transition-colors">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 capitalize flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span>{exp.category.replace(/_/g, ' ')}</span>
                      {exp.lrNumber && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1.5 py-0.2 rounded font-semibold">
                          LR: {exp.lrNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {exp.remarks || exp.vendorName || 'Highway Expense'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {exp.date} • Mode: {exp.paidMode?.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                  <div className="text-right flex items-center space-x-2">
                    <span className="font-mono font-bold text-red-700 text-xs">
                      ₹{formatINR(exp.amount)}
                    </span>
                    {onDeleteExpense && (
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.id)}
                        className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Comprehensive Driver Expense Logging */}
      {showLogExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 w-full max-w-md text-slate-800 shadow-2xl space-y-3.5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Fuel className="w-4 h-4 text-blue-700" />
                <span>Log Expense for {activeTruckNumber}</span>
              </h3>
              <span className="text-[10px] font-mono bg-blue-50 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                Driver: {effectiveDriverName}
              </span>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              
              {/* Category Selector */}
              <div>
                <label className="block text-slate-600 font-bold mb-1">Expense Category *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'fuel', label: 'Diesel / Fuel' },
                    { id: 'toll', label: 'Toll Tax' },
                    { id: 'driver_bhatta', label: 'Food / Bhatta' },
                    { id: 'loading_unloading', label: 'Hamali / Unload' },
                    { id: 'police_fine', label: 'Police / Fine' },
                    { id: 'maintenance', label: 'Tyre / Repair' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setExpenseCategory(cat.id as any)}
                      className={`p-2 rounded-lg border text-center font-bold text-[11px] transition-all ${
                        expenseCategory === cat.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fuel Specific Fields */}
              {expenseCategory === 'fuel' ? (
                <div className="space-y-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                  <div>
                    <label className="block text-slate-600 font-bold mb-0.5">Petrol Pump / Vendor Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Indian Oil Highway Pump"
                      value={pumpVendor}
                      onChange={e => setPumpVendor(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-semibold focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-bold mb-0.5">Liters Filled *</label>
                      <input
                        type="number"
                        required
                        step="any"
                        value={liters}
                        onChange={e => setLiters(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-0.5">Rate / Liter (₹) *</label>
                      <input
                        type="number"
                        required
                        step="any"
                        value={ratePerLiter}
                        onChange={e => setRatePerLiter(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-100/70 border border-blue-200 p-2 rounded text-center font-mono font-extrabold text-blue-950 text-xs">
                    Calculated Diesel Amount: ₹{formatINR(liters * ratePerLiter)}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={miscAmount}
                    onChange={e => setMiscAmount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-mono font-bold text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">Payment Method *</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-semibold focus:outline-none"
                  >
                    <option value="fuel_card">Fuel Card</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / Online</option>
                    <option value="bank_neft">Bank NEFT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">Slip / Receipt No.</label>
                  <input
                    type="text"
                    placeholder="e.g. SLIP-9812"
                    value={slipNumber}
                    onChange={e => setSlipNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-0.5">Remarks / Details</label>
                  <input
                    type="text"
                    placeholder="e.g. Surat toll plaza"
                    value={expenseRemarks}
                    onChange={e => setExpenseRemarks(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLogExpenseModal(false)}
                  className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold shadow-xs flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Expense</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
