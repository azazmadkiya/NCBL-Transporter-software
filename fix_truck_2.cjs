const fs = require('fs');
let code = fs.readFileSync('src/components/TruckLedgerView.tsx', 'utf8');

code = code.replace(
  /\{\[\'admin\', \'accountant\'\]\.includes\(userRole\) && \(\<button/,
  "<button"
);

// We want to hide both "Add Vehicle" and "Log Vehicle Expense" buttons.
const search = `<div className="flex items-center space-x-2">
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
        </div>`;

const repl = `<div className="flex items-center space-x-2">
          {['admin', 'accountant'].includes(userRole) && (<>
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
          </>)}
        </div>`;

code = code.replace(search, repl);
fs.writeFileSync('src/components/TruckLedgerView.tsx', code);
console.log("Success");
