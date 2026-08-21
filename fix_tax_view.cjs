const fs = require('fs');
let code = fs.readFileSync('src/components/TaxReportsView.tsx', 'utf8');

code = code.replace(
  /interface TaxReportsViewProps \{/,
  "import { UserRole } from '../types';\n\ninterface TaxReportsViewProps {\n  userRole?: UserRole;"
);

code = code.replace(
  /export const TaxReportsView: React\.FC<TaxReportsViewProps> = \(\{/,
  "export const TaxReportsView: React.FC<TaxReportsViewProps> = ({\n  userRole = 'admin',"
);

fs.writeFileSync('src/components/TaxReportsView.tsx', code);
console.log("Success");
