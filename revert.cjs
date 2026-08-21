const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

const regex = /<div className="grid grid-cols-2 gap-2 mt-2\.5">\s*<div>\s*<label className="block text-slate-500 font-bold mb-0\.5">State \*<\/label>\s*<select[\s\S]*?<\/select>\s*<\/div>\s*<div>\s*<label className="block text-slate-500 font-bold mb-0\.5">State Code<\/label>\s*<input[\s\S]*?\/>\s*<\/div>\s*<\/div>/g;

let count = 0;
code = code.replace(regex, () => {
    count++;
    return `<div className="grid grid-cols-2 gap-2 mt-2.5">
                <div>
                  <label className="block text-slate-500 font-bold mb-0.5">State *</label>
                  <input
                    type="text"
                    required
                    placeholder="Maharashtra"
                    value={newState}
                    onChange={e => setNewState(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold mb-0.5">State Code</label>
                  <input
                    type="text"
                    required
                    placeholder="27"
                    value={newStateCode}
                    onChange={e => setNewStateCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-slate-800 font-mono focus:outline-none"
                  />
                </div>
              </div>`;
});

fs.writeFileSync('src/components/PartyLedgerView.tsx', code);
console.log("Reverted " + count + " instances.");
