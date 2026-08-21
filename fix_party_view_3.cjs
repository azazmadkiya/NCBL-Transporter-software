const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

const search = `<button
                  onClick={() => setShowLumpSumModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded font-bold transition-all flex items-center space-x-1 shadow-xs"
                  title="Record a single bulk lump sum payment and distribute across pending bills"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>+ Lump Sum Payment</span>
                </button>
                <button
                  onClick={() => onRecordPaymentModal(selectedParty.id)}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1 rounded font-bold transition-all flex items-center space-x-1 shadow-xs"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>+ Record Payment</span>
                </button>`;

const repl = `{['admin', 'accountant'].includes(userRole) && (<>
                <button
                  onClick={() => setShowLumpSumModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded font-bold transition-all flex items-center space-x-1 shadow-xs"
                  title="Record a single bulk lump sum payment and distribute across pending bills"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>+ Lump Sum Payment</span>
                </button>
                <button
                  onClick={() => onRecordPaymentModal(selectedParty.id)}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1 rounded font-bold transition-all flex items-center space-x-1 shadow-xs"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>+ Record Payment</span>
                </button>
                </>)}
`;

code = code.replace(search, repl);
fs.writeFileSync('src/components/PartyLedgerView.tsx', code);
console.log("Success");
