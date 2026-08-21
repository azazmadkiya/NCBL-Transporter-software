const fs = require('fs');
let code = fs.readFileSync('src/components/InvoicesList.tsx', 'utf8');

const target3 = `                    <td className="p-2.5 text-right text-slate-600">
                      ₹{formatINR(inv.subTotal)}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-900 text-xs">
                      ₹{formatINR(inv.netPayable)}
                    </td>`;

const replacement3 = `                    <td className="p-2.5 text-right text-slate-600">
                      ₹{formatINR(inv.subTotal)}
                    </td>
                    <td className="p-2.5 text-right text-red-600">
                      {inv.tdsAmount ? \`-₹\${formatINR(inv.tdsAmount)}\` : '—'}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-900 text-xs">
                      ₹{formatINR(inv.netPayable)}
                    </td>`;

code = code.replace(target3, replacement3);

fs.writeFileSync('src/components/InvoicesList.tsx', code);
console.log("Success");
