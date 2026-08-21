const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');

code = code.replace(
  /interface PartyLedgerViewProps \{/,
  "import { UserRole } from '../types';\n\ninterface PartyLedgerViewProps {\n  userRole?: UserRole;"
);

code = code.replace(
  /export const PartyLedgerView: React\.FC<PartyLedgerViewProps> = \(\{/,
  "export const PartyLedgerView: React.FC<PartyLedgerViewProps> = ({\n  userRole = 'admin',"
);

// We need to hide Add Party button
code = code.replace(
  /<button\n            onClick=\{\(\) => \{/,
  "{['admin', 'accountant'].includes(userRole) && (<button\n            onClick={() => {"
);
code = code.replace(
  /<span>Add New Party<\/span>\n          <\/button>/,
  "<span>Add New Party</span>\n          </button>)}"
);

// We need to hide Edit / Delete buttons in Party Card
code = code.replace(
  /<div className="flex space-x-2">\n                    <button\n                      onClick=\{\(\) => \{/,
  '<div className="flex space-x-2">\n                    {[\'admin\', \'accountant\'].includes(userRole) && (<>\n                    <button\n                      onClick={() => {'
);
code = code.replace(
  /<Trash2 className="w-4 h-4 text-red-500" \/>\n                    <\/button>\n                  <\/div>/,
  '<Trash2 className="w-4 h-4 text-red-500" />\n                    </button>\n                    </>)}\n                  </div>'
);

// Hide Receive Payment / Record Advance
code = code.replace(
  /<div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">\n                <button\n                  onClick=\{\(\) => onRecordPaymentModal\(party.id\)\}/,
  '<div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">\n                {[\'admin\', \'accountant\'].includes(userRole) && (<button\n                  onClick={() => onRecordPaymentModal(party.id)}'
);
code = code.replace(
  /<span>Record Advance<\/span>\n                <\/button>\n              <\/div>/,
  "<span>Record Advance</span>\n                </button>)}\n              </div>"
);

// Hide Delete Invoice button
code = code.replace(
  /<button\n                                onClick=\{\(\) => \{/,
  "{['admin', 'accountant'].includes(userRole) && (<button\n                                onClick={() => {"
);
code = code.replace(
  /<Trash2 className="w-4 h-4" \/>\n                              <\/button>/,
  "<Trash2 className=\"w-4 h-4\" />\n                              </button>)}"
);

fs.writeFileSync('src/components/PartyLedgerView.tsx', code);
console.log("Success");
