const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

code = code.replace(
  /@media print \{/,
  `@media print {
                @page { size: A4 landscape; margin: 10mm; }`
);

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
