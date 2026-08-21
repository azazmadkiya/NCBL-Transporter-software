const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicesList.tsx', 'utf8');

// Add sortOrder state
code = code.replace(
  /const \[statusFilter, setStatusFilter\] = useState<\'all\' \| \'paid\' \| \'unpaid\' \| \'partial\'>\(\'all\'\);/,
  "const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'partial'>('all');\n  const [sortOrder, setSortOrder] = useState<'new_first' | 'old_first'>('new_first');"
);

// Add sorting logic
code = code.replace(
  /const filteredInvoices = invoices\.filter\(inv => \{/,
  "let filteredInvoices = invoices.filter(inv => {"
);

code = code.replace(
  /return true;\n  \}\);/,
  "return true;\n  });\n\n  filteredInvoices.sort((a, b) => {\n    const dateA = new Date(a.invoiceDate).getTime();\n    const dateB = new Date(b.invoiceDate).getTime();\n    if (sortOrder === 'new_first') {\n      return dateB - dateA;\n    } else {\n      return dateA - dateB;\n    }\n  });"
);

// Add Sort dropdown UI
const filterHtml = `{/* Status Filter */}`;

const sortHtml = `{/* Sort Order */}
            <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                onClick={() => setSortOrder('new_first')}
                className={\`px-2.5 py-1 rounded font-bold text-[11px] transition-all \${
                  sortOrder === 'new_first' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }\`}
              >
                New First
              </button>
              <button
                onClick={() => setSortOrder('old_first')}
                className={\`px-2.5 py-1 rounded font-bold text-[11px] transition-all \${
                  sortOrder === 'old_first' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }\`}
              >
                Old First
              </button>
            </div>
            
            {/* Status Filter */}`;

code = code.replace(filterHtml, sortHtml);

fs.writeFileSync('src/components/InvoicesList.tsx', code);
console.log("Success");
