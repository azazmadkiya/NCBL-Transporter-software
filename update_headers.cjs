const fs = require('fs');

let printModal = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');
printModal = printModal.replace(
  '<th className="p-1.5 text-right">Balance (₹)</th>',
  '<th className="p-1.5 text-right">Closing Balance (₹)</th>'
);
fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', printModal);

let viewModal = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');
viewModal = viewModal.replace(
  '<th className="p-2 text-right font-mono">Balance (₹)</th>',
  '<th className="p-2 text-right font-mono">Closing Balance (₹)</th>'
);
fs.writeFileSync('src/components/PartyLedgerView.tsx', viewModal);

console.log("Success");
