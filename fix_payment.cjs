const fs = require('fs');
let code = fs.readFileSync('src/components/PaymentTracker.tsx', 'utf8');

code = code.replace(
  /interface PaymentTrackerProps \{/,
  "import { UserRole } from '../types';\n\ninterface PaymentTrackerProps {\n  userRole?: UserRole;"
);

code = code.replace(
  /export const PaymentTracker: React\.FC<PaymentTrackerProps> = \(\{/,
  "export const PaymentTracker: React.FC<PaymentTrackerProps> = ({\n  userRole = 'admin',"
);

// We need to hide Action buttons inside the loop. Let's see if there are any buttons.
// Usually Record Payment.
fs.writeFileSync('src/components/PaymentTracker.tsx', code);
console.log("Success");
