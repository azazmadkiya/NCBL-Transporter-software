const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

const regexToReplace = /\{\/\* Consignee & Ship To \(Receiver at Destination\) \*\/\}[\s\S]*?(?=\{\/\* Total \/ Debit \*\/\})/g;

const replacement = `{row.type === 'invoice' ? (
                          <>
                            {/* Consignee & Ship To (Receiver at Destination) */}
                            <td className="p-1.5 border-r text-slate-900 font-semibold text-[9.5px] leading-tight max-w-[180px]">
                              <div>
                                <div className="font-bold text-slate-900 truncate" title={row.consigneeName}>
                                  {row.consigneeName || '—'}
                                </div>
                                {(row.shipToName || row.shipToAddress) && (
                                  <div className="text-[8.5px] text-blue-900 font-semibold truncate mt-0.5" title={\`\${row.shipToName} \${row.shipToAddress ? '(' + row.shipToAddress + ')' : ''}\`}>
                                    <span className="text-blue-700 font-extrabold">Ship To:</span> {row.shipToName || row.shipToAddress}
                                  </div>
                                )}
                              </div>
                            </td>
                            {/* Route (Origin City to Destination City) */}
                            <td className="p-1.5 border-r text-slate-800 text-[9.5px] leading-tight max-w-[160px]">
                              <div className="font-bold text-slate-900">
                                <span>{row.origin}</span>{' '}
                                <span className="text-blue-700 font-black">➔</span>{' '}
                                <span>{row.destination}</span>
                              </div>
                            </td>
                            {/* Vehicle No & Material / Goods */}
                            <td className="p-1.5 border-r text-slate-800 text-[9.5px] leading-tight max-w-[150px]">
                              <div>
                                <div className="font-mono font-bold text-slate-900 truncate">{row.vehicleNumber || '—'}</div>
                                <div className="text-slate-600 text-[8.5px] truncate">{row.materialType || 'General'}</div>
                              </div>
                            </td>
                            {/* Qty / Weight */}
                            <td className="p-1.5 border-r text-right font-mono text-slate-800 font-semibold text-[9.5px]">
                              {row.qtyWeight || '—'}
                            </td>
                            {/* Rate */}
                            <td className="p-1.5 border-r text-right font-mono text-slate-800 font-semibold text-[9.5px]">
                              {row.rate ? \`₹\${formatINR(row.rate, 2, 2)}\` : '—'}
                            </td>
                            {/* Basic Amount */}
                            <td className="p-1.5 border-r text-right font-mono text-slate-800 font-semibold text-[9.5px]">
                              {row.basicAmount ? \`₹\${formatINR(row.basicAmount)}\` : '—'}
                            </td>
                            {/* Tax Amount */}
                            <td className="p-1.5 border-r text-right font-mono text-slate-700 text-[9.5px]">
                              {row.taxAmount && row.taxAmount > 0 ? (
                                <span className="font-semibold text-slate-900">₹{formatINR(row.taxAmount)}</span>
                              ) : (
                                <span className="text-slate-500 text-[8.5px]">₹0.00</span>
                              )}
                            </td>
                            {/* TDS Amount */}
                            <td className="p-1.5 border-r text-right font-mono text-slate-700 text-[9.5px]">
                              {row.tdsAmount && row.tdsAmount > 0 ? (
                                <span className="font-semibold text-slate-900">₹{formatINR(row.tdsAmount)}</span>
                              ) : (
                                <span className="text-slate-500 text-[8.5px]">₹0.00</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <td colSpan={8} className="p-1.5 border-r text-slate-700 text-[9.5px] leading-relaxed max-w-[600px] whitespace-normal">
                            <span className="text-emerald-700 font-bold block mb-0.5">Payment Received</span>
                            <span className="italic text-slate-600">{row.description}</span>
                          </td>
                        )}
                        `;

code = code.replace(regexToReplace, replacement);
fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success print");
