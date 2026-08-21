const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

const targetLines = [
'                  value={newGstin}',
'                  onChange={e => setNewGstin(e.target.value.toUpperCase())}',
'                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono font-bold focus:outline-none"',
'                />',
'              </div>',
'              <div className="grid grid-cols-2 gap-2">',
'                <div>',
'                  <label className="block text-slate-500 font-bold mb-0.5">City *</label>',
'                  <input',
'                    type="text"',
'                    required',
'                    placeholder="Pune"',
'                    value={newCity}',
'                    onChange={e => setNewCity(e.target.value)}',
'                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"',
'                  />',
'                </div>',
'                <div>',
'                  <label className="block text-slate-500 font-bold mb-0.5">Phone</label>',
'                  <input',
'                    type="text"',
'                    placeholder="+91 98..."',
'                    value={newPhone}',
'                    onChange={e => setNewPhone(e.target.value)}',
'                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"',
'                  />',
'                </div>',
'              </div>'
];

let target = targetLines.join('\\n');
// Handle possible CRLF
let re = new RegExp(targetLines.map(l => l.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('\\r?\\n'));

const replacement = targetLines.join('\\n') + `
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div>
                  <label className="block text-slate-500 font-bold mb-0.5">State *</label>
                  <select
                    value={newState}
                    onChange={e => {
                      const st = e.target.value;
                      setNewState(st);
                      const found = INDIAN_STATES.find(s => s.name === st);
                      if (found) setNewStateCode(found.code);
                    }}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s.code} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-0.5">State Code</label>
                  <input
                    type="text"
                    value={newStateCode}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-500 font-mono focus:outline-none cursor-not-allowed"
                  />
                </div>
              </div>`;

if (re.test(code)) {
  code = code.replace(re, replacement);
  fs.writeFileSync('src/components/PartyLedgerView.tsx', code);
  console.log("Success");
} else {
  console.log("Target not found");
}
