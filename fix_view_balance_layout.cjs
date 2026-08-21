const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

code = code.replace(
  /₹\{formatINR\(Math\.abs\(partyBalance\)\)\} \{partyBalance >= 0 \? "Dr" : "Cr"\}/g,
  '<span className="text-slate-500 mr-1 font-normal">{partyBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(partyBalance))}'
);

code = code.replace(
  /₹\{formatINR\(Math\.abs\(netOutstanding\)\)\} \{netOutstanding >= 0 \? "Dr" : "Cr"\}/g,
  '<span className="text-blue-700 mr-1 font-normal">{netOutstanding >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(netOutstanding))}'
);

code = code.replace(
  /₹\{formatINR\(Math\.abs\(selectedParty\.openingBalance \|\| 0\)\)\} \{\(selectedParty\.openingBalance \|\| 0\) >= 0 \? "Dr" : "Cr"\}/g,
  '<span className="text-slate-500 mr-1 font-normal">{(selectedParty.openingBalance || 0) >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(selectedParty.openingBalance || 0))}'
);

code = code.replace(
  /₹\{formatINR\(Math\.abs\(row\.runningBalance\)\)\} \{row\.runningBalance >= 0 \? "Dr" : "Cr"\}/g,
  '<span className="text-slate-500 mr-1 font-normal">{row.runningBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(row.runningBalance))}'
);

fs.writeFileSync('src/components/PartyLedgerView.tsx', code);
console.log("Success");
