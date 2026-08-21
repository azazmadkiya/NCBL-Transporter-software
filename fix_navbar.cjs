const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace(
  /\{currentUser\?\.role !== 'driver' && \(/g,
  "{['admin', 'accountant'].includes(currentUser?.role || '') && ("
);

fs.writeFileSync('src/components/Navbar.tsx', code);
console.log("Success");
