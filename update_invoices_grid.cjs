const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicesList.tsx', 'utf8');

code = code.replace(
  '<div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3">',
  '<div className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-3">'
);

fs.writeFileSync('src/components/InvoicesList.tsx', code);
console.log("Success");
