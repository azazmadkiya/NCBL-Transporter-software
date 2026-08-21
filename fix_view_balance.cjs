const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

code = code.replace(
  /₹\{formatINR\(partyBalance\)\}/g,
  '₹{formatINR(Math.abs(partyBalance))} {partyBalance >= 0 ? "Dr" : "Cr"}'
);

code = code.replace(
  /₹\{formatINR\(netOutstanding\)\}/g,
  '₹{formatINR(Math.abs(netOutstanding))} {netOutstanding >= 0 ? "Dr" : "Cr"}'
);

code = code.replace(
  /₹\{formatINR\(selectedParty\.openingBalance\)\}/g,
  '₹{formatINR(Math.abs(selectedParty.openingBalance || 0))} {(selectedParty.openingBalance || 0) >= 0 ? "Dr" : "Cr"}'
);

code = code.replace(
  /₹\{formatINR\(row\.runningBalance\)\}/g,
  '₹{formatINR(Math.abs(row.runningBalance))} {row.runningBalance >= 0 ? "Dr" : "Cr"}'
);

fs.writeFileSync('src/components/PartyLedgerView.tsx', code);
console.log("Success");
