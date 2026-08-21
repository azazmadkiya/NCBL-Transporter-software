const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

code = code.replace(
  /const pdf = new jsPDF\('p', 'pt', 'a4'\);/g,
  "const pdf = new jsPDF('l', 'pt', 'a4');"
);

code = code.replace(
  /max-w-\[840px\]/g,
  "max-w-[1122px]"
);

code = code.replace(
  /max-w-5xl/g,
  "max-w-7xl"
);

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
