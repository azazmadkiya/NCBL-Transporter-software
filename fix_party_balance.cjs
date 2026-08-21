const fs = require('fs');

let viewModal = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

viewModal = viewModal.replace(
  /<span className="text-slate-500 mr-1 font-normal">\{partyBalance >= 0 \? "Dr" : "Cr"\}<\/span>₹\{formatINR\(Math\.abs\(partyBalance\)\)\}/g,
  '<span className="text-slate-500 mr-1 font-normal">{netOutstanding >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(netOutstanding))}'
);

fs.writeFileSync('src/components/PartyLedgerView.tsx', viewModal);

console.log("Success");
