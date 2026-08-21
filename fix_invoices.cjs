const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicesList.tsx', 'utf8');

code = code.replace(/userRole !== 'driver'/g, "['admin', 'accountant'].includes(userRole)");

fs.writeFileSync('src/components/InvoicesList.tsx', code);
console.log("Success");
