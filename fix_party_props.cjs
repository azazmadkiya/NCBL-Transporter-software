const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /<PartyLedgerView\n              parties=\{parties\}/,
  "<PartyLedgerView\n              userRole={currentRole}\n              parties={parties}"
);

code = code.replace(
  /<TruckLedgerView\n              vehicles=\{vehicles\}/,
  "<TruckLedgerView\n              userRole={currentRole}\n              vehicles={vehicles}"
);

code = code.replace(
  /<PaymentTracker\n              invoices=\{invoices\}/,
  "<PaymentTracker\n              userRole={currentRole}\n              invoices={invoices}"
);

code = code.replace(
  /<TaxReportsView\n              invoices=\{invoices\}/,
  "<TaxReportsView\n              userRole={currentRole}\n              invoices={invoices}"
);

fs.writeFileSync('src/App.tsx', code);
console.log("Success");
