const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicesList.tsx', 'utf8');

code = code.replace(
  'interface InvoicesListProps {\n  invoices: Invoice[];',
  'import { Party } from \'../types\';\n\ninterface InvoicesListProps {\n  invoices: Invoice[];\n  parties?: Party[];'
);

code = code.replace(
  'export const InvoicesList: React.FC<InvoicesListProps> = ({\n  invoices,\n  onNewInvoice,',
  'export const InvoicesList: React.FC<InvoicesListProps> = ({\n  invoices,\n  parties = [],\n  onNewInvoice,'
);

fs.writeFileSync('src/components/InvoicesList.tsx', code);
console.log("Success");
