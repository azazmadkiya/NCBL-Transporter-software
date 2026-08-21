const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

code = code.replace(
  /₹\{formatINR\(Math\.abs\(closingBalance\)\)\} \{closingBalance >= 0 \? "Dr" : "Cr"\}/g,
  '<span className="text-slate-500 mr-1">{closingBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(closingBalance))}'
);

code = code.replace(
  /₹\{formatINR\(Math\.abs\(party\.openingBalance \|\| 0\)\)\} \{\(party\.openingBalance \|\| 0\) >= 0 \? "Dr" : "Cr"\}/g,
  '<span className="text-slate-500 mr-1">{(party.openingBalance || 0) >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(party.openingBalance || 0))}'
);

code = code.replace(
  /₹\{formatINR\(Math\.abs\(row\.runningBalance\)\)\} \{row\.runningBalance >= 0 \? "Dr" : "Cr"\}/g,
  '<span className="text-slate-500 mr-1">{row.runningBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(row.runningBalance))}'
);

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
