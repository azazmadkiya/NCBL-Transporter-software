const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicesList.tsx', 'utf8');

const regex = /<td className="p-2\.5 text-right text-slate-600">\s*₹\{formatINR\(inv\.subTotal\)\}\s*<\/td>\s*<td className="p-2\.5 text-right font-bold text-slate-900 text-xs">/g;

code = code.replace(regex, `<td className="p-2.5 text-right text-slate-600">
                      ₹{formatINR(inv.subTotal)}
                    </td>
                    <td className="p-2.5 text-right text-red-600">
                      {inv.tdsAmount ? \`-₹\${formatINR(inv.tdsAmount)}\` : '—'}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-900 text-xs">`);

fs.writeFileSync('src/components/InvoicesList.tsx', code);
console.log("Success");
