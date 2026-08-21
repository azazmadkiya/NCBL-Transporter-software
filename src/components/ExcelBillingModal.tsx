import React, { useState, useRef } from 'react';
import { Invoice } from '../types';
import { 
  exportInvoicesToExcel, 
  downloadSampleExcelTemplate, 
  parseExcelBillingFile, 
  ParsedImportRow 
} from '../utils/excelUtils';
import { 
  FileSpreadsheet, Download, Upload, X, CheckCircle2, AlertTriangle, XCircle, 
  FileText, ArrowRight, Table, Info, RefreshCw, Check
} from 'lucide-react';

interface ExcelBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredInvoices: Invoice[];
  allInvoices: Invoice[];
  onImportInvoices: (importedInvoices: Invoice[], mode: 'add' | 'overwrite') => Promise<void>;
}

export const ExcelBillingModal: React.FC<ExcelBillingModalProps> = ({
  isOpen,
  onClose,
  filteredInvoices,
  allInvoices,
  onImportInvoices
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  
  // Export State
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>('filtered');
  
  // Import State
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importError, setImportError] = useState<string>('');
  const [duplicateMode, setDuplicateMode] = useState<'add' | 'overwrite'>('add');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string>('');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const targetExportInvoices = exportScope === 'filtered' ? filteredInvoices : allInvoices;

  const handleExport = () => {
    exportInvoicesToExcel(
      targetExportInvoices, 
      exportScope === 'filtered' ? 'Transport_Invoices_Filtered' : 'Transport_Invoices_Registry'
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = async (file: File) => {
    setFileName(file.name);
    setImportError('');
    setImportSuccessMsg('');
    setIsParsing(true);
    setParsedRows(null);

    try {
      const buffer = await file.arrayBuffer();
      const results = parseExcelBillingFile(buffer);
      setParsedRows(results);
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse Excel file. Please check file format.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;

    const validRows = parsedRows.filter(r => r.isValid || r.warnings.length > 0);
    if (validRows.length === 0) {
      setImportError('No valid billing rows found to import.');
      return;
    }

    setIsImporting(true);
    try {
      const invoicesToImport = validRows.map(r => r.invoice);
      await onImportInvoices(invoicesToImport, duplicateMode);
      setImportSuccessMsg(`Successfully imported ${invoicesToImport.length} billing records!`);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setImportError(`Import failed: ${err.message || 'Unknown database error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows?.filter(r => r.isValid).length || 0;
  const warningCount = parsedRows?.filter(r => r.warnings.length > 0 && r.isValid).length || 0;
  const errorCount = parsedRows?.filter(r => !r.isValid).length || 0;

  const displayedRows = parsedRows?.filter(r => {
    if (previewFilter === 'valid') return r.isValid;
    if (previewFilter === 'errors') return !r.isValid || r.warnings.length > 0;
    return true;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 rounded-lg text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-wide">Excel / CSV Data Exchange</h3>
              <p className="text-xs text-slate-300">Import or Export Transport Invoices & Bills Registry Data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2.5 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>EXPORT BILLING DATA</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 text-xs font-bold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'import'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span>IMPORT EXCEL / CSV</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              
              {/* Scope Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select Records to Export</label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setExportScope('filtered')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      exportScope === 'filtered'
                        ? 'border-emerald-600 bg-emerald-50/60 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 text-xs">Currently Filtered Registry</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                        {filteredInvoices.length} Bills
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Exports only the invoices matching your search terms, date ranges, and party filters.
                    </p>
                  </div>

                  <div
                    onClick={() => setExportScope('all')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      exportScope === 'all'
                        ? 'border-emerald-600 bg-emerald-50/60 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800 text-xs">Full Database Registry</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                        {allInvoices.length} Bills
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Exports every invoice recorded in your system across all parties and time periods.
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary Stats Box */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-700 flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-emerald-600" />
                  <span>Export Summary ({targetExportInvoices.length} Records)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-center">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Total Freight</span>
                    <span className="font-bold text-slate-800 text-xs">
                      ₹{targetExportInvoices.reduce((acc, inv) => acc + (inv.grossFreight || 0), 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Total Tax (GST)</span>
                    <span className="font-bold text-slate-800 text-xs">
                      ₹{targetExportInvoices.reduce((acc, inv) => acc + (inv.totalTax || 0), 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Net Freight Amount</span>
                    <span className="font-bold text-emerald-700 text-xs">
                      ₹{targetExportInvoices.reduce((acc, inv) => acc + (inv.netPayable || 0), 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Balance Pending</span>
                    <span className="font-bold text-red-600 text-xs">
                      ₹{targetExportInvoices.reduce((acc, inv) => acc + (inv.balanceDue || 0), 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={downloadSampleExcelTemplate}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 underline decoration-slate-300"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Download Sample Import Template (.xlsx)</span>
                </button>

                <button
                  onClick={handleExport}
                  disabled={targetExportInvoices.length === 0}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-lg text-xs flex items-center justify-center space-x-2 transition-all shadow-md active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>DOWNLOAD EXCEL FILE ({targetExportInvoices.length})</span>
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === 'import' && (
            <div className="space-y-5">
              
              {/* Top Banner / Sample Template Download */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-xl gap-2">
                <div className="flex items-center space-x-2.5">
                  <Info className="w-5 h-5 text-blue-700 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-blue-900 block">Batch Import Transport Invoices</span>
                    <span className="text-blue-700 text-[11px]">Upload Excel (.xlsx, .xls) or CSV with columns for Invoice #, LR #, Consignor, Freight, Tax, Amount.</span>
                  </div>
                </div>
                <button
                  onClick={downloadSampleExcelTemplate}
                  className="shrink-0 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 transition-all shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-blue-700" />
                  <span>Sample Template</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              {!parsedRows && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 ${
                    isDragging 
                      ? 'border-blue-600 bg-blue-50/80 scale-[0.99]' 
                      : 'border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />
                  
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>

                  <div>
                    <p className="font-bold text-slate-800 text-xs">
                      Click to upload or drag & drop Excel or CSV file
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Supports .xlsx, .xls, and .csv format up to 10MB
                    </p>
                  </div>
                </div>
              )}

              {/* Parsing Indicator */}
              {isParsing && (
                <div className="p-6 text-center space-y-2 bg-slate-50 rounded-xl border border-slate-200">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                  <p className="font-bold text-slate-700 text-xs">Reading and validating Excel rows...</p>
                </div>
              )}

              {/* Error Message */}
              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Success Message */}
              {importSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2 font-bold animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              {/* Parsed Preview Table & Configuration */}
              {parsedRows && !isParsing && (
                <div className="space-y-4">
                  
                  {/* File Info Bar & Reset Button */}
                  <div className="flex flex-wrap items-center justify-between bg-slate-100 p-3 rounded-xl border border-slate-200 gap-2">
                    <div className="flex items-center space-x-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold text-slate-800 text-xs">{fileName}</span>
                      <span className="text-[11px] text-slate-500">({parsedRows.length} total rows parsed)</span>
                    </div>

                    <button
                      onClick={() => {
                        setParsedRows(null);
                        setFileName('');
                        setImportError('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs font-bold text-slate-600 hover:text-red-600 flex items-center space-x-1 underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Choose Different File</span>
                    </button>
                  </div>

                  {/* Summary Badges & Filter */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-xs">
                      <button
                        onClick={() => setPreviewFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          previewFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All Rows ({parsedRows.length})
                      </button>

                      <button
                        onClick={() => setPreviewFilter('valid')}
                        className={`px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition-all ${
                          previewFilter === 'valid' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready ({validCount})</span>
                      </button>

                      {warningCount > 0 && (
                        <button
                          onClick={() => setPreviewFilter('errors')}
                          className={`px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition-all ${
                            previewFilter === 'errors' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Warnings ({warningCount})</span>
                        </button>
                      )}

                      {errorCount > 0 && (
                        <button
                          onClick={() => setPreviewFilter('errors')}
                          className={`px-2.5 py-1 rounded-lg font-bold flex items-center space-x-1 transition-all ${
                            previewFilter === 'errors' ? 'bg-red-700 text-white' : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Invalid ({errorCount})</span>
                        </button>
                      )}
                    </div>

                    {/* Mode selector */}
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-500 font-bold text-[11px]">Duplicates:</span>
                      <select
                        value={duplicateMode}
                        onChange={(e) => setDuplicateMode(e.target.value as 'add' | 'overwrite')}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-blue-600"
                      >
                        <option value="add">Add as New Records</option>
                        <option value="overwrite">Overwrite / Update Existing Invoices</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-60 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider font-bold text-[10px] sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Row</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Invoice #</th>
                          <th className="p-2.5">LR #</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Consignor</th>
                          <th className="p-2.5">Vehicle #</th>
                          <th className="p-2.5 text-right">Freight (₹)</th>
                          <th className="p-2.5 text-right">Net Payable (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-4 text-center text-slate-400">
                              No rows match the selected status filter.
                            </td>
                          </tr>
                        ) : (
                          displayedRows.map((item) => (
                            <tr key={item.rowIndex} className="hover:bg-slate-50/80">
                              <td className="p-2.5 font-bold text-slate-500">{item.rowIndex}</td>
                              <td className="p-2.5">
                                {!item.isValid ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800" title={item.errors.join(', ')}>
                                    <XCircle className="w-3 h-3 mr-0.5" />
                                    Invalid
                                  </span>
                                ) : item.warnings.length > 0 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800" title={item.warnings.join(', ')}>
                                    <AlertTriangle className="w-3 h-3 mr-0.5" />
                                    Notice
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                    Valid
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-bold text-slate-800">{item.invoice.invoiceNumber}</td>
                              <td className="p-2.5 text-slate-600">{item.invoice.lrNumber}</td>
                              <td className="p-2.5 text-slate-600">{item.invoice.invoiceDate}</td>
                              <td className="p-2.5 font-semibold text-slate-700">{item.invoice.consignorName}</td>
                              <td className="p-2.5 text-slate-600">{item.invoice.vehicleNumber}</td>
                              <td className="p-2.5 text-right font-semibold text-slate-800">
                                ₹{item.invoice.grossFreight?.toLocaleString('en-IN')}
                              </td>
                              <td className="p-2.5 text-right font-bold text-emerald-700">
                                ₹{item.invoice.netPayable?.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Submit Import Button */}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[11px] text-slate-500">
                      * Valid records will be written directly to Firestore and synced instantly across registry views.
                    </p>

                    <button
                      onClick={handleExecuteImport}
                      disabled={isImporting || validCount === 0}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-lg text-xs flex items-center space-x-2 transition-all shadow-md active:scale-95"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>SAVING TO FIRESTORE...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>IMPORT {validCount} VALID RECORDS</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
