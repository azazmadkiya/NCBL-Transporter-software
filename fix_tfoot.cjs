const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

code = code.replace(/<\/tbody>\s*<tfoot>/g, '');
code = code.replace(/<\/tfoot>/g, '</tbody>');

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
