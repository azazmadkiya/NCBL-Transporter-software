const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

code = code.replace(
  /className="bg-white text-slate-900 p-5 sm:p-7 rounded shadow-lg w-\[1122px\] min-w-\[1122px\] shrink-0 text-xs font-sans border border-slate-200 print:w-full print:min-w-0 print:shadow-none print:border-none print:p-0"/,
  'className="bg-white text-slate-900 p-5 sm:p-7 rounded shadow-lg w-[1122px] min-w-[1122px] shrink-0 text-xs font-sans border border-slate-200 print:w-[1122px] print:shadow-none print:border-none print:p-0"'
);

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
