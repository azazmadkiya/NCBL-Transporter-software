const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

code = code.replace(
  /<button\n                  onClick=\{\(\) => setShowLumpSumModal\(true\)\}/,
  "{['admin', 'accountant'].includes(userRole) && (<>\n                <button\n                  onClick={() => setShowLumpSumModal(true)}"
);

code = code.replace(
  /<span>\+ Record Payment<\/span>\n                <\/button>/,
  "<span>+ Record Payment</span>\n                </button>\n                </>)}"
);

fs.writeFileSync('src/components/PartyLedgerView.tsx', code);
console.log("Success");
