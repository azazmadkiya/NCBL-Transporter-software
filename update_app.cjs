const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '<InvoicesList\n              invoices={invoices}\n              onNewInvoice',
  '<InvoicesList\n              invoices={invoices}\n              parties={parties}\n              onNewInvoice'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Success");
