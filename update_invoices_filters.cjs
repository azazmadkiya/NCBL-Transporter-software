const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicesList.tsx', 'utf8');

code = code.replace(
  "  const [partyFilter, setPartyFilter] = useState('all');",
  "  const [partyFilter, setPartyFilter] = useState('all');\n  const [ledgerPartyFilter, setLedgerPartyFilter] = useState('all');"
);

code = code.replace(
  "    partyFilter !== 'all' ||",
  "    partyFilter !== 'all' || \n    ledgerPartyFilter !== 'all' ||"
);

code = code.replace(
  "    setPartyFilter('all');",
  "    setPartyFilter('all');\n    setLedgerPartyFilter('all');"
);

const filterLogic = `    if (partyFilter && partyFilter !== 'all') {
      const pTerm = partyFilter.toLowerCase();
      const matchParty = 
        (inv.consignorName && inv.consignorName.toLowerCase().includes(pTerm)) ||
        (inv.consigneeName && inv.consigneeName.toLowerCase().includes(pTerm));
      if (!matchParty) return false;
    }`;

const newFilterLogic = `    if (partyFilter && partyFilter !== 'all') {
      const pTerm = partyFilter.toLowerCase();
      const matchParty = 
        (inv.consignorName && inv.consignorName.toLowerCase().includes(pTerm)) ||
        (inv.consigneeName && inv.consigneeName.toLowerCase().includes(pTerm));
      if (!matchParty) return false;
    }
    
    if (ledgerPartyFilter && ledgerPartyFilter !== 'all') {
      if (inv.partyId !== ledgerPartyFilter) return false;
    }`;

code = code.replace(filterLogic, newFilterLogic);

// Now update the UI. Let's make it a 3 column grid if it was 2 column.
code = code.replace(
  '<div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3">',
  '<div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3">'
);

const ledgerPartyUI = `          {/* Ledger Party Filter */}
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={ledgerPartyFilter}
              onChange={e => setLedgerPartyFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none transition-all"
            >
              <option value="all">All Ledger Parties</option>
              {parties.map(party => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
          </div>
        </div>`;

code = code.replace(
  /<\/select>\s*<\/div>\s*<\/div>/,
  `</select>\n          </div>\n${ledgerPartyUI}`
);

fs.writeFileSync('src/components/InvoicesList.tsx', code);
console.log("Success");
