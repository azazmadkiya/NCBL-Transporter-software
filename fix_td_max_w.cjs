const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

code = code.replace(/max-w-\[125px\]/g, 'max-w-[180px]');
code = code.replace(/max-w-\[120px\]/g, 'max-w-[160px]');
code = code.replace(/max-w-\[110px\]/g, 'max-w-[150px]');

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
