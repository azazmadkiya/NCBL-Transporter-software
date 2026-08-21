const fs = require('fs');
let code = fs.readFileSync('src/components/TruckLedgerView.tsx', 'utf8');

code = code.replace(
  /interface TruckLedgerViewProps \{/,
  "import { UserRole } from '../types';\n\ninterface TruckLedgerViewProps {\n  userRole?: UserRole;"
);

code = code.replace(
  /export const TruckLedgerView: React\.FC<TruckLedgerViewProps> = \(\{/,
  "export const TruckLedgerView: React.FC<TruckLedgerViewProps> = ({\n  userRole = 'admin',"
);

// We need to hide Add Vehicle button
code = code.replace(
  /<button\n            onClick=\{\(\) => setShowAddVehicleModal\(true\)\}/,
  "{['admin', 'accountant'].includes(userRole) && (<button\n            onClick={() => setShowAddVehicleModal(true)}"
);
code = code.replace(
  /<span>Add New Vehicle<\/span>\n          <\/button>/,
  "<span>Add New Vehicle</span>\n          </button>)}"
);

fs.writeFileSync('src/components/TruckLedgerView.tsx', code);
console.log("Success");
