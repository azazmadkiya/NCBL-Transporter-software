const fs = require('fs');
let code = fs.readFileSync('src/components/PaymentTracker.tsx', 'utf8');

code = code.replace(
  /<button\n            type="button"\n            onClick=\{\(\) => setShowLumpSumModal\(true\)\}/,
  "{['admin', 'accountant'].includes(userRole) && (<button\n            type=\"button\"\n            onClick={() => setShowLumpSumModal(true)}"
);
code = code.replace(
  /<span>\+ Record Lump Sum Payment<\/span>\n          <\/button>/,
  "<span>+ Record Lump Sum Payment</span>\n          </button>)}"
);

code = code.replace(
  /\{inv\.balanceDue > 0 \? \(\n                          <button\n                            onClick=\{\(\) => openPaymentModal\(inv\)\}/,
  "{inv.balanceDue > 0 ? (\n                          ['admin', 'accountant'].includes(userRole) && <button\n                            onClick={() => openPaymentModal(inv)}"
);

code = code.replace(
  /<div className="flex items-center justify-end space-x-1">\n                        <button\n                          onClick=\{\(\) => openEditPaymentModal\(item\)\}/,
  '<div className="flex items-center justify-end space-x-1">\n                        {[\'admin\', \'accountant\'].includes(userRole) && (<>\n                        <button\n                          onClick={() => openEditPaymentModal(item)}'
);

code = code.replace(
  /<Trash2 className="w-3\.5 h-3\.5" \/>\n                          <\/button>\n                        \)\}/,
  '<Trash2 className="w-3.5 h-3.5" />\n                          </button>\n                        )}\n                        </>)}'
);


fs.writeFileSync('src/components/PaymentTracker.tsx', code);
console.log("Success");
