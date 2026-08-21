const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

code = code.replace(
  /\{userRole !== 'driver' && \(/g,
  "{['admin', 'accountant'].includes(userRole) && ("
);

code = code.replace(
  /\{onEditInvoice && \(\n                          <button/,
  "{onEditInvoice && ['admin', 'accountant'].includes(userRole) && (\n                          <button"
);

code = code.replace(
  /\{onDeleteInvoice && \(\n                          <button/,
  "{onDeleteInvoice && ['admin', 'accountant'].includes(userRole) && (\n                          <button"
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log("Success");
