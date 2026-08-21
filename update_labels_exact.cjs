const fs = require('fs');

let printModal = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');
printModal = printModal.replace(
  '<span className="text-[8.5px] font-bold text-slate-500 uppercase block">Total Credit (Received)</span>',
  '<span className="text-[8.5px] font-bold text-slate-500 uppercase block">Total Credit</span>'
);
printModal = printModal.replace(
  '<span className="text-[8.5px] font-bold text-blue-200 uppercase block">Closing Balance</span>',
  '<span className="text-[8.5px] font-bold text-blue-200 uppercase block">Closing Amount</span>'
);
fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', printModal);

let viewModal = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');
viewModal = viewModal.replace(
  '<div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Credit (Received)</div>',
  '<div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Credit</div>'
);
viewModal = viewModal.replace(
  '<div className="text-[10px] uppercase font-bold text-blue-500 mb-1">Closing Balance</div>',
  '<div className="text-[10px] uppercase font-bold text-blue-500 mb-1">Closing Amount</div>'
);
fs.writeFileSync('src/components/PartyLedgerView.tsx', viewModal);

console.log("Success");
