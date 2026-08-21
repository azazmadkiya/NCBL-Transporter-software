const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace(
  /id: 'dashboard',[\s\S]*?roles: \['admin', 'accountant', 'driver'\]/,
  "id: 'dashboard',\n      label: 'Dashboard',\n      icon: LayoutDashboard,\n      roles: ['admin', 'accountant', 'driver', 'viewer']"
);
code = code.replace(
  /id: 'invoices',[\s\S]*?roles: \['admin', 'accountant'\]/,
  "id: 'invoices',\n      label: 'Invoices & Bills',\n      icon: FileText,\n      roles: ['admin', 'accountant', 'viewer']"
);
code = code.replace(
  /id: 'party_ledger',[\s\S]*?roles: \['admin', 'accountant'\]/,
  "id: 'party_ledger',\n      label: 'Party Ledgers',\n      icon: Users,\n      roles: ['admin', 'accountant', 'viewer']"
);
code = code.replace(
  /id: 'truck_ledger',[\s\S]*?roles: \['admin', 'accountant', 'driver'\]/,
  "id: 'truck_ledger',\n      label: 'Truck Ledger & Vouchers',\n      icon: Truck,\n      roles: ['admin', 'accountant', 'driver', 'viewer']"
);
code = code.replace(
  /id: 'payments',[\s\S]*?roles: \['admin', 'accountant'\]/,
  "id: 'payments',\n      label: 'Payment Tracker',\n      icon: CreditCard,\n      roles: ['admin', 'accountant', 'viewer']"
);
code = code.replace(
  /id: 'tax_reports',[\s\S]*?roles: \['admin', 'accountant'\]/,
  "id: 'tax_reports',\n      label: 'GST & Tax Reports',\n      icon: BarChart3,\n      roles: ['admin', 'accountant', 'viewer']"
);

code = code.replace(
  /\{userRole === 'accountant' && 'Invoicing, party ledgers & payment entries\.'\}/,
  "{userRole === 'accountant' && 'Invoicing, party ledgers & payment entries.'}\n              {userRole === 'viewer' && 'Read-only access to view reports and data.'}"
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log("Success");
