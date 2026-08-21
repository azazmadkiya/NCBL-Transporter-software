const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

// Top summary box
code = code.replace(
  /<span className="text-xs font-mono font-black">₹\{formatINR\(closingBalance\)\}<\/span>/g,
  '<span className="text-xs font-mono font-black">₹{formatINR(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}</span>'
);

// Opening Balance Row
code = code.replace(
  /₹\{formatINR\(party\.openingBalance \|\| 0\)\}/g,
  '₹{formatINR(Math.abs(party.openingBalance || 0))} {(party.openingBalance || 0) >= 0 ? "Dr" : "Cr"}'
);

// Running Balance row
code = code.replace(
  /₹\{formatINR\(row\.runningBalance\)\}/g,
  '₹{formatINR(Math.abs(row.runningBalance))} {row.runningBalance >= 0 ? "Dr" : "Cr"}'
);

// Footer Totals row
code = code.replace(
  /₹\{formatINR\(closingBalance\)\}/g,
  '₹{formatINR(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}'
);

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
