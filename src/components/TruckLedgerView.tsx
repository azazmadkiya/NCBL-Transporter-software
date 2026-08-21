import React, { useState, useMemo } from 'react';
import { Vehicle, Expense, Invoice, formatINR } from '../types';
import { 
  Truck, Plus, Fuel, Wrench, Shield, DollarSign, TrendingUp, AlertCircle, FileText, CheckCircle2, Edit, Trash2 
} from 'lucide-react';

import { UserRole } from '../types';

interface TruckLedgerViewProps {
  userRole?: UserRole;
  vehicles: Vehicle[];
  expenses: Expense[];
  invoices: Invoice[];
  onAddVehicle: (vehicle: Vehicle) => void;
  onEditVehicle?: (vehicle: Vehicle) => void;
  onDeleteVehicle?: (vehicleId: string) => void;
  onAddExpense: (expense: Expense) => void;
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
}

export const TruckLedgerView: React.FC<TruckLedgerViewProps> = ({
  userRole = 'admin',
  vehicles,
  expenses,
  invoices,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
  onAddExpense,
  onEditExpense,
  onDeleteExpense
}) => {
  const [selectedVehicleNum, setSelectedVehicleNum] = useState<string>(
    vehicles[0]?.vehicleNumber || 'MH-12-PQ-9876'
  );

  // Modals
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // New Vehicle form state
  const [newVehNum, setNewVehNum] = useState('');
  const [newVehType, setNewVehType] = useState('14 Wheeler Truck');
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newCapacity, setNewCapacity] = useState(20);

  // New Expense form state
  const [expCategory, setExpCategory] = useState<Expense['category']>('fuel');
  const [expAmount, setExpAmount] = useState(1000);
  const [expMode, setExpMode] = useState<Expense['paidMode']>('fuel_card');
  const [expVendor, setExpVendor] = useState('');
  const [expLr, setExpLr] = useState('');
  const [expRemarks, setExpRemarks] = useState('');

  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.vehicleNumber === selectedVehicleNum) || vehicles[0];
  }, [vehicles, selectedVehicleNum]);

  // Invoices for this truck
  const truckInvoices = useMemo(() => {
    const vNum = (selectedVehicleNum || '').toLowerCase();
    return invoices.filter(inv => 
      (inv.vehicleNumber || '').toLowerCase() === vNum
    );
  }, [invoices, selectedVehicleNum]);

  // Expenses for this truck
  const truckExpenses = useMemo(() => {
    const vNum = (selectedVehicleNum || '').toLowerCase();
    return expenses.filter(exp => 
      (exp.vehicleNumber || '').toLowerCase() === vNum
    );
  }, [expenses, selectedVehicleNum]);

  const { totalFreightEarnings, totalExpensesAmount, netProfit } = useMemo(() => {
    const earnings = truckInvoices.reduce((sum, inv) => sum + (inv.grossFreight || 0), 0);
    const expTotal = truckExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    return {
      totalFreightEarnings: earnings,
      totalExpensesAmount: expTotal,
      netProfit: earnings - expTotal
    };
  }, [truckInvoices, truckExpenses]);

  // Save new vehicle
  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehNum) return;

    const vehicle: Vehicle = {
      id: `veh-${Date.now()}`,
      vehicleNumber: newVehNum.toUpperCase(),
      vehicleType: newVehType,
      driverName: newDriverName || 'Unassigned',
      driverPhone: newDriverPhone || '',
      ownerType: 'own',
      status: 'available',
      capacityTons: Number(newCapacity),
      totalFreightEarned: 0,
      totalExpenses: 0,
      createdAt: new Date().toISOString()
    };

    onAddVehicle(vehicle);
    setSelectedVehicleNum(vehicle.vehicleNumber);
    setShowAddVehicleModal(false);
    setNewVehNum('');
  };

  // Save new expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount) return;

    const expense: Expense = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      vehicleNumber: selectedVehicleNum,
      lrNumber: expLr || undefined,
      category: expCategory,
      amount: Number(expAmount),
      paidMode: expMode,
      vendorName: expVendor,
      remarks: expRemarks,
      createdAt: new Date().toISOString()
    };

    onAddExpense(expense);
    setShowAddExpenseModal(false);
    setExpAmount(1000);
    setExpRemarks('');
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <Truck className="w-4 h-4 text-blue-700" />
            <span>Truck & Vehicle Ledgers (Fleet P&L)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track per-vehicle freight revenues, diesel fuel logs, toll charges, driver bhatta & net trip profitability.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="flex items-center space-x-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-blue-700" />
            <span>Add Vehicle</span>
          </button>

          <button
            onClick={() => setShowAddExpenseModal(true)}
            className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs"
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>+ Log Vehicle Expense</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Fleet List Sidebar */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-lg p-3 space-y-2.5 shadow-xs">
          <div className="font-bold text-xs text-slate-700 uppercase tracking-wider">Select Fleet Truck</div>

          <div className="space-y-1.5">
            {vehicles.map(v => (
              <button
                key={v.id}
                onClick={() => setSelectedVehicleNum(v.vehicleNumber)}
                className={`w-full text-left p-2.5 rounded border text-xs transition-all ${
                  v.vehicleNumber === selectedVehicleNum
                    ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-blue-700 text-xs font-bold">{v.vehicleNumber}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold ${
                    v.status === 'in_transit' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {v.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">{v.vehicleType}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Driver: {v.driverName}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Truck Ledger Details & Profitability */}
        {selectedVehicle ? (
          <div className="lg:col-span-3 space-y-4">
            
            {/* Truck Summary Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase text-blue-700 tracking-wider">VEHICLE FINANCIAL LEDGER</span>
                  <h3 className="text-xl font-mono font-bold text-slate-900">{selectedVehicle.vehicleNumber}</h3>
                  <p className="text-xs text-slate-600">{selectedVehicle.vehicleType} • Capacity: {selectedVehicle.capacityTons} Tons</p>
                  <p className="text-xs text-slate-500 mt-0.5">Driver: <span className="text-blue-700 font-bold">{selectedVehicle.driverName}</span> ({selectedVehicle.driverPhone})</p>
                </div>

                {/* Net Profit Gauge & Actions */}
                <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded text-right min-w-[160px]">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Net Truck Profit</div>
                    <div className={`text-lg font-mono font-bold ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      ₹{formatINR(netProfit)}
                    </div>

                    <div className="text-[9px] text-slate-400 mt-0.5">
                      Freight Earnings - Expenses
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {onEditVehicle && (
                      <button
                        onClick={() => {
                          setEditingVehicle(selectedVehicle);
                          setNewVehNum(selectedVehicle.vehicleNumber);
                          setNewVehType(selectedVehicle.vehicleType);
                          setNewDriverName(selectedVehicle.driverName);
                          setNewDriverPhone(selectedVehicle.driverPhone || '');
                          setNewCapacity(selectedVehicle.capacityTons);
                        }}
                        className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 font-bold flex items-center space-x-1"
                        title="Edit Truck Details"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span className="text-xs">Edit</span>
                      </button>
                    )}
                    {onDeleteVehicle && (
                      <button
                        onClick={() => onDeleteVehicle(selectedVehicle.id)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 font-bold flex items-center space-x-1"
                        title="Delete Vehicle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-xs">Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 text-xs">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 uppercase text-[10px] font-bold">Total Freight Earnings</div>
                  <div className="text-xs font-bold text-slate-900 font-mono mt-0.5">
                    ₹{formatINR(totalFreightEarnings)}
                  </div>
                  <div className="text-[10px] text-slate-400">{truckInvoices.length} Trips / Invoices</div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                  <div className="text-slate-500 uppercase text-[10px] font-bold">Total Operating Expenses</div>
                  <div className="text-xs font-bold text-red-600 font-mono mt-0.5">
                    ₹{formatINR(totalExpensesAmount)}
                  </div>
                  <div className="text-[10px] text-slate-400">{truckExpenses.length} Expense Slips</div>
                </div>


                <div className="bg-blue-50 p-2.5 rounded border border-blue-200 col-span-2 sm:col-span-1">
                  <div className="text-blue-700 uppercase text-[10px] font-bold">Profit Margin %</div>
                  <div className="text-xs font-bold text-blue-900 font-mono mt-0.5">
                    {totalFreightEarnings > 0 
                      ? `${((netProfit / totalFreightEarnings) * 100).toFixed(1)}%` 
                      : '0%'}
                  </div>
                  <div className="text-[10px] text-blue-600">Margin per trip</div>
                </div>
              </div>
            </div>

            {/* Expenses List */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-slate-800 space-y-3 shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Logged Expenses (Fuel, Toll, Maintenance, Bhatta)
                </h4>

                <button
                  onClick={() => setShowAddExpenseModal(true)}
                  className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded border border-blue-200 font-bold"
                >
                  + Add Expense
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] border-b border-slate-200">
                      <th className="p-2">Date</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">LR / Ref</th>
                      <th className="p-2">Vendor / Notes</th>
                      <th className="p-2">Payment Mode</th>
                      <th className="p-2 text-right font-mono">Amount (₹)</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {truckExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          No expenses logged for this vehicle yet.
                        </td>
                      </tr>
                    ) : (
                      truckExpenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="p-2 font-mono text-slate-700">{exp.date}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              exp.category === 'fuel' ? 'bg-amber-100 text-amber-800' :
                              exp.category === 'toll' ? 'bg-blue-100 text-blue-800' :
                              exp.category === 'driver_bhatta' ? 'bg-purple-100 text-purple-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {exp.category.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-slate-500">{exp.lrNumber || '-'}</td>
                          <td className="p-2 text-slate-800">
                            {exp.vendorName || exp.remarks || 'General Slip'}
                          </td>
                          <td className="p-2 uppercase font-medium text-slate-600">{exp.paidMode}</td>
                          <td className="p-2 text-right font-mono font-bold text-red-600">
                            ₹{formatINR(exp.amount)}
                          </td>

                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {onEditExpense && (
                                <button
                                  onClick={() => {
                                    setEditingExpense(exp);
                                    setExpCategory(exp.category);
                                    setExpAmount(exp.amount);
                                    setExpMode(exp.paidMode);
                                    setExpVendor(exp.vendorName || '');
                                    setExpLr(exp.lrNumber || '');
                                    setExpRemarks(exp.remarks || '');
                                  }}
                                  title="Edit Expense Voucher"
                                  className="p-1 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onDeleteExpense && (
                                <button
                                  onClick={() => onDeleteExpense(exp.id)}
                                  title="Delete Expense Voucher"
                                  className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 shadow-xs">
            Select a vehicle from the fleet list to view its financial ledger.
          </div>
        )}

      </div>

      {/* Modal: Add Vehicle */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl">
            <h3 className="text-base font-bold mb-3 text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Truck className="w-4 h-4 text-blue-700" />
              <span>Register New Fleet Vehicle</span>
            </h3>

            <form onSubmit={handleSaveVehicle} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Truck / Vehicle Number *</label>
                <input
                  type="text"
                  required
                  placeholder="MH-12-AB-1234"
                  value={newVehNum}
                  onChange={e => setNewVehNum(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Vehicle Type</label>
                <select
                  value={newVehType}
                  onChange={e => setNewVehType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-blue-700 font-bold focus:outline-none"
                >
                  <option value="14 Wheeler Truck">14 Wheeler Truck</option>
                  <option value="10 Wheeler Taurus">10 Wheeler Taurus</option>
                  <option value="32ft Container">32ft Container</option>
                  <option value="Trailer 40ft">Trailer 40ft</option>
                  <option value="Eicher 17ft">Eicher 17ft</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Driver Name</label>
                <input
                  type="text"
                  placeholder="Driver Name"
                  value={newDriverName}
                  onChange={e => setNewDriverName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Driver Contact Phone</label>
                <input
                  type="text"
                  placeholder="+91 98..."
                  value={newDriverPhone}
                  onChange={e => setNewDriverPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Capacity (Tons)</label>
                <input
                  type="number"
                  step="any"
                  value={newCapacity}
                  onChange={e => setNewCapacity(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>


              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs"
                >
                  Register Truck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Expense */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl">
            <h3 className="text-base font-bold mb-3 text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Fuel className="w-4 h-4 text-blue-700" />
              <span>Log Vehicle Operating Expense</span>
            </h3>

            <form onSubmit={handleSaveExpense} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Vehicle Number</label>
                <input
                  type="text"
                  disabled
                  value={selectedVehicleNum}
                  className="w-full bg-slate-100 border border-slate-300 rounded p-1.5 text-blue-700 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Expense Category *</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value as Expense['category'])}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                >
                  <option value="fuel">Diesel / Fuel Slip</option>
                  <option value="toll">FASTag / Highway Toll</option>
                  <option value="driver_bhatta">Driver Bhatta / Trip Allowance</option>
                  <option value="maintenance">Maintenance / Spare Repair</option>
                  <option value="police_fine">Police Fine / Challan</option>
                  <option value="loading_unloading">Loading/Unloading Hamali</option>
                  <option value="office_other">Other Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={expAmount}
                  onChange={e => setExpAmount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>


              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Payment Mode</label>
                <select
                  value={expMode}
                  onChange={e => setExpMode(e.target.value as Expense['paidMode'])}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-blue-700 font-bold focus:outline-none"
                >
                  <option value="fuel_card">Fuel Card / HPCL / BPCL</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cash">Cash</option>
                  <option value="bank_neft">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Vendor / Petrol Pump Name</label>
                <input
                  type="text"
                  placeholder="e.g. HPCL Expressway Plaza"
                  value={expVendor}
                  onChange={e => setExpVendor(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">LR Number (Optional)</label>
                <input
                  type="text"
                  placeholder="NT-LR-8091"
                  value={expLr}
                  onChange={e => setExpLr(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Remarks</label>
                <input
                  type="text"
                  placeholder="150 Liters diesel filled"
                  value={expRemarks}
                  onChange={e => setExpRemarks(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Vehicle */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl">
            <h3 className="text-base font-bold mb-3 text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Truck className="w-4 h-4 text-blue-700" />
              <span>Modify Fleet Vehicle Record</span>
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!onEditVehicle || !editingVehicle) return;
              const updated: Vehicle = {
                ...editingVehicle,
                vehicleNumber: newVehNum.toUpperCase(),
                vehicleType: newVehType,
                driverName: newDriverName || 'Unassigned',
                driverPhone: newDriverPhone || '',
                capacityTons: Number(newCapacity)
              };
              onEditVehicle(updated);
              setSelectedVehicleNum(updated.vehicleNumber);
              setEditingVehicle(null);
            }} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Truck / Vehicle Number *</label>
                <input
                  type="text"
                  required
                  value={newVehNum}
                  onChange={e => setNewVehNum(e.target.value.toUpperCase())}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Vehicle Type</label>
                <select
                  value={newVehType}
                  onChange={e => setNewVehType(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-blue-700 font-bold focus:outline-none"
                >
                  <option value="14 Wheeler Truck">14 Wheeler Truck</option>
                  <option value="10 Wheeler Taurus">10 Wheeler Taurus</option>
                  <option value="32ft Container">32ft Container</option>
                  <option value="Trailer 40ft">Trailer 40ft</option>
                  <option value="Eicher 17ft">Eicher 17ft</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Driver Name</label>
                <input
                  type="text"
                  placeholder="Driver Name"
                  value={newDriverName}
                  onChange={e => setNewDriverName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Driver Mobile Phone</label>
                <input
                  type="text"
                  placeholder="9876543210"
                  value={newDriverPhone}
                  onChange={e => setNewDriverPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Capacity (Tons)</label>
                <input
                  type="number"
                  step="any"
                  value={newCapacity}
                  onChange={e => setNewCapacity(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-bold focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}

                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs"
                >
                  Update Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Expense */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md text-slate-800 shadow-xl">
            <h3 className="text-base font-bold mb-3 text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Fuel className="w-4 h-4 text-blue-700" />
              <span>Modify Expense Voucher</span>
            </h3>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!onEditExpense || !editingExpense) return;
              const updatedExp: Expense = {
                ...editingExpense,
                category: expCategory,
                amount: Number(expAmount),
                paidMode: expMode,
                vendorName: expVendor,
                lrNumber: expLr || undefined,
                remarks: expRemarks
              };
              onEditExpense(updatedExp);
              setEditingExpense(null);
            }} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Expense Category *</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value as Expense['category'])}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                >
                  <option value="fuel">Diesel / Fuel Slip</option>
                  <option value="toll">FASTag / Highway Toll</option>
                  <option value="driver_bhatta">Driver Bhatta / Trip Allowance</option>
                  <option value="maintenance">Maintenance / Spare Repair</option>
                  <option value="police_fine">Police Fine / Challan</option>
                  <option value="loading_unloading">Loading/Unloading Hamali</option>
                  <option value="office_other">Other Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={expAmount}
                  onChange={e => setExpAmount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>


              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Payment Mode</label>
                <select
                  value={expMode}
                  onChange={e => setExpMode(e.target.value as Expense['paidMode'])}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-blue-700 font-bold focus:outline-none"
                >
                  <option value="fuel_card">Fuel Card / HPCL / BPCL</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cash">Cash</option>
                  <option value="bank_neft">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Vendor / Petrol Pump Name</label>
                <input
                  type="text"
                  placeholder="e.g. HPCL Expressway Plaza"
                  value={expVendor}
                  onChange={e => setExpVendor(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">LR Number (Optional)</label>
                <input
                  type="text"
                  placeholder="NT-LR-8091"
                  value={expLr}
                  onChange={e => setExpLr(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-0.5">Remarks</label>
                <input
                  type="text"
                  placeholder="Details"
                  value={expRemarks}
                  onChange={e => setExpRemarks(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-xs"
                >
                  Update Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
