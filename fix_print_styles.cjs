const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

code = code.replace(
  /<style>\{`[\s\S]*?`\}<\/style>/,
  `<style>{\`
              @media print {
                @page { size: A4 landscape; margin: 10mm; }
                /* Ensure table rows don't break across pages */
                tr {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
              }
            \`}</style>`
);

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
