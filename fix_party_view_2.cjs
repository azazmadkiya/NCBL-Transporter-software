const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

code = code.replace(
  /<button\n            onClick=\{\(\) => setShowAddPartyModal\(true\)\}/,
  "{['admin', 'accountant'].includes(userRole) && (<button\n            onClick={() => setShowAddPartyModal(true)}"
);

code = code.replace(
  /<span>Add New Party<\/span>\n          <\/button>\)\}/,
  "<span>Add New Party</span>\n          </button>)}"
);

fs.writeFileSync('src/components/PartyLedgerView.tsx', code);
console.log("Success");
