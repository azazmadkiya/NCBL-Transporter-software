const fs = require('fs');

// Print Modal
let printModal = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');
const printFooterTotals = `                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900 text-[9.5px]">`;
const printClosingRow = `                  <tr className="bg-slate-200 font-bold border-t border-slate-300 text-slate-900 text-[10px]">
                    <td colSpan={11} className="p-2 text-right uppercase tracking-wider font-extrabold text-blue-900">
                      Closing Balance Carried Forward:
                    </td>
                    <td className="p-1.5 text-right font-mono font-black text-blue-900 text-[11px]">
                      <span className="text-slate-600 mr-1">{closingBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(closingBalance))}
                    </td>
                  </tr>
`;
printModal = printModal.replace(printFooterTotals, printClosingRow + printFooterTotals);
fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', printModal);

// View Modal
let viewModal = fs.readFileSync('src/components/PartyLedgerView.tsx', 'utf8');
const viewTbodyEnd = `                </tbody>
              </table>`;
const viewClosingRow = `                  {/* Closing balance row */}
                  {ledgerRows.length > 0 && (
                    <tr className="bg-blue-50/60 font-bold text-blue-900 border-t-2 border-slate-200">
                      <td colSpan={8} className="p-3 text-right uppercase tracking-wider text-xs">
                        Closing Balance Carried Forward:
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        <span className="text-slate-500 mr-1 font-normal">{partyBalance >= 0 ? "Dr" : "Cr"}</span>₹{formatINR(Math.abs(partyBalance))}
                      </td>
                    </tr>
                  )}
`;
viewModal = viewModal.replace(viewTbodyEnd, viewClosingRow + viewTbodyEnd);
fs.writeFileSync('src/components/PartyLedgerView.tsx', viewModal);

console.log("Success");
