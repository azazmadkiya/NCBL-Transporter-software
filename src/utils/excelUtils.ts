import * as XLSX from 'xlsx';
import { Invoice, InvoiceType, PaymentStatus, TaxMechanism, TaxSlab, TaxType } from '../types';

/**
 * Converts JS Date or Excel Date serial number or String date to YYYY-MM-DD format
 */
export function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];

  // Excel serial number (e.g. 45200)
  if (typeof val === 'number') {
    const parsedDate = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();
  if (!str) return new Date().toISOString().split('T')[0];

  // Check DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // ISO string or standard date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Clean numeric values from string inputs like "₹ 15,000.00" or "15000"
 */
export function parseExcelNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Export invoices list to Excel (.xlsx) file
 */
export function exportInvoicesToExcel(invoices: Invoice[], filenamePrefix: string = 'Transport_Invoices_Registry'): void {
  const exportData = invoices.map((inv, index) => ({
    'Sr No': index + 1,
    'Invoice Number': inv.invoiceNumber || '',
    'Invoice Date': inv.invoiceDate || '',
    'LR / Bilty No': inv.lrNumber || '',
    'LR Date': inv.lrDate || '',
    'Bill Type': inv.invoiceType === 'tax_invoice' ? 'Tax Invoice' : 'Freight Bill',
    'Consignor (Billing Party)': inv.consignorName || '',
    'Consignor GSTIN': inv.consignorGSTIN || '',
    'Consignor Address': inv.consignorAddress || '',
    'Consignor State': inv.consignorState || '',
    'Consignee (Receiver)': inv.consigneeName || '',
    'Consignee GSTIN': inv.consigneeGSTIN || '',
    'Consignee Address': inv.consigneeAddress || '',
    'Dispatched Party (Shipped From)': inv.dispatchedPartyName || '',
    'Ship To (Destination Site)': inv.shipToName || '',
    'Origin Location': inv.origin || '',
    'Destination Location': inv.destination || '',
    'Vehicle Number': inv.vehicleNumber || '',
    'Driver Name': inv.driverName || '',
    'Driver Phone': inv.driverPhone || '',
    'Material Type': inv.materialType || '',
    'Weight (Tons)': inv.items?.[0]?.weightTons || inv.items?.[0]?.quantity || 0,
    'Rate per Ton': inv.items?.[0]?.ratePerTon || 0,
    'Gross Freight (₹)': inv.grossFreight || 0,
    'Loading Charges (₹)': inv.loadingCharges || 0,
    'Unloading Charges (₹)': inv.unloadingCharges || 0,
    'Detention Charges (₹)': inv.detentionCharges || 0,
    'Other Charges (₹)': inv.otherCharges || 0,
    'Sub Total (₹)': inv.subTotal || 0,
    'GST Rate (%)': inv.taxSlab || 0,
    'CGST Amount (₹)': inv.cgstAmount || 0,
    'SGST Amount (₹)': inv.sgstAmount || 0,
    'IGST Amount (₹)': inv.igstAmount || 0,
    'Total Tax (₹)': inv.totalTax || 0,
    'Grand Total (₹)': inv.grandTotal || 0,
    'Advance Paid (₹)': inv.advancePaid || 0,
    'Fuel Deduction (₹)': inv.fuelDeduction || 0,
    'Other Deductions (₹)': inv.otherDeductions || 0,
    'Kasar Concession (₹)': inv.kasarDeduction || 0,
    'TDS Amount (₹)': inv.tdsAmount || 0,
    'Net Payable Amount (₹)': inv.netPayable || 0,
    'Amount Received (₹)': inv.amountPaid || 0,
    'Balance Due (₹)': inv.balanceDue || 0,
    'Payment Status': (inv.paymentStatus || 'unpaid').toUpperCase(),
    'Remarks / Notes': inv.notes || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Set column widths automatically
  const colWidths = Object.keys(exportData[0] || {}).map(key => ({
    wch: Math.max(key.length + 3, 14)
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transport Invoices');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filenamePrefix}_${todayStr}.xlsx`);
}

/**
 * Downloads a sample formatted Excel import template for users
 */
export function downloadSampleExcelTemplate(): void {
  const sampleData = [
    {
      'Invoice Number': 'INV/2025/001',
      'Invoice Date': '2025-04-10',
      'LR Number': 'LR-9001',
      'LR Date': '2025-04-09',
      'Bill Type': 'Tax Invoice',
      'Consignor Name': 'UltraTech Cement Ltd',
      'Consignor GSTIN': '24AABCU9603R1ZM',
      'Consignor Address': 'GIDC Industrial Area, Vadodara',
      'Consignor State': 'GUJARAT',
      'Consignee Name': 'Ambuja Trading Corp',
      'Consignee GSTIN': '24AAACA1234F1Z2',
      'Consignee Address': 'Transport Nagar, Ahmedabad',
      'Dispatched Party': 'UltraTech Plant 1',
      'Ship To': 'Ambuja Depot Site 2',
      'Origin': 'Vadodara',
      'Destination': 'Ahmedabad',
      'Vehicle Number': 'GJ-06-ZZ-4321',
      'Driver Name': 'Ramesh Kumar',
      'Driver Phone': '9876543210',
      'Material Description': 'Bag Cement',
      'Weight Tons': 25.5,
      'Rate Per Ton': 1200,
      'Gross Freight': 30600,
      'Loading Charges': 500,
      'Unloading Charges': 500,
      'Detention Charges': 0,
      'Other Charges': 0,
      'Tax Slab': 5,
      'Tax Type': 'intra_state',
      'Advance Paid': 5000,
      'Fuel Deduction': 0,
      'Amount Paid': 5000,
      'Notes': 'Sample billing row 1'
    },
    {
      'Invoice Number': 'BILL/2025/002',
      'Invoice Date': '2025-04-12',
      'LR Number': 'LR-9002',
      'LR Date': '2025-04-11',
      'Bill Type': 'Freight Bill',
      'Consignor Name': 'Reliance Industries Ltd',
      'Consignor GSTIN': '27AABCR5432E1Z8',
      'Consignor Address': 'Hazira Complex, Surat',
      'Consignor State': 'GUJARAT',
      'Consignee Name': 'Shree Logistics',
      'Consignee GSTIN': '27AAACS9876K1Z1',
      'Consignee Address': 'Bhiwandi, Thane',
      'Dispatched Party': 'Surat Dispatch Gate',
      'Ship To': 'Bhiwandi Central Godown',
      'Origin': 'Surat',
      'Destination': 'Mumbai',
      'Vehicle Number': 'MH-04-AB-9876',
      'Driver Name': 'Suresh Patel',
      'Driver Phone': '9123456789',
      'Material Description': 'Polymer Bags',
      'Weight Tons': 18.0,
      'Rate Per Ton': 1500,
      'Gross Freight': 27000,
      'Loading Charges': 0,
      'Unloading Charges': 0,
      'Detention Charges': 1000,
      'Other Charges': 0,
      'Tax Slab': 0,
      'Tax Type': 'inter_state',
      'Advance Paid': 10000,
      'Fuel Deduction': 2000,
      'Amount Paid': 10000,
      'Notes': 'Sample non-tax freight bill'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  worksheet['!cols'] = Object.keys(sampleData[0]).map(key => ({ wch: Math.max(key.length + 4, 15) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Template');
  XLSX.writeFile(workbook, 'Transport_Billing_Import_Template.xlsx');
}

export interface ParsedImportRow {
  rowIndex: number;
  invoice: Invoice;
  isValid: boolean;
  warnings: string[];
  errors: string[];
  rawRow: Record<string, any>;
}

/**
 * Parses uploaded Excel/CSV binary buffer into clean Invoice objects with validation
 */
export function parseExcelBillingFile(fileBuffer: ArrayBuffer): ParsedImportRow[] {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded file contains no sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('The uploaded Excel sheet contains no data rows.');
  }

  const parsedRows: ParsedImportRow[] = [];

  rawRows.forEach((row, index) => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Map headers flexibly by lowercasing keys and stripping spaces/special chars
    const normalizedMap: Record<string, any> = {};
    Object.keys(row).forEach(key => {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      normalizedMap[cleanKey] = row[key];
    });

    const getVal = (...possibleKeys: string[]): any => {
      for (const k of possibleKeys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedMap[cleanK] !== undefined && normalizedMap[cleanK] !== '') {
          return normalizedMap[cleanK];
        }
      }
      return '';
    };

    // Extract Invoice & LR numbers
    let invoiceNumber = getVal('invoicenumber', 'invoiceno', 'invoice', 'billnumber', 'billno', 'bill', 'srno', 'sr');
    let lrNumber = getVal('lrnumber', 'lrno', 'lr', 'biltynumber', 'biltyno', 'bilty', 'grno', 'gr');

    if (!invoiceNumber && !lrNumber) {
      errors.push('Row is missing both Invoice Number and LR/Bilty Number.');
      invoiceNumber = `INV-IMP-${Date.now()}-${index + 1}`;
      lrNumber = `LR-${index + 101}`;
    } else if (!invoiceNumber) {
      invoiceNumber = `INV-${lrNumber}`;
      warnings.push(`Invoice number auto-assigned as ${invoiceNumber}`);
    } else if (!lrNumber) {
      lrNumber = `LR-${invoiceNumber.replace(/[^0-9]/g, '') || (index + 1000)}`;
      warnings.push(`LR number auto-assigned as ${lrNumber}`);
    }

    // Dates
    const invoiceDate = parseExcelDate(getVal('invoicedate', 'billdate', 'date'));
    const lrDate = parseExcelDate(getVal('lrdate', 'biltydate')) || invoiceDate;

    // Type
    const typeStr = String(getVal('billtype', 'invoicetype', 'type')).toLowerCase();
    const invoiceType: InvoiceType = (typeStr.includes('tax') || typeStr.includes('gst')) ? 'tax_invoice' : 'normal_bill';

    // Consignor (Billing Party)
    let consignorName = String(getVal('consignorname', 'consignor', 'sender', 'billingparty', 'partyname', 'party')).trim();
    if (!consignorName) {
      consignorName = 'General Transport Party';
      warnings.push('Consignor name missing; set to "General Transport Party"');
    }
    const consignorGSTIN = String(getVal('consignorgstin', 'sendergstin', 'gstin')).trim().toUpperCase();
    const consignorAddress = String(getVal('consignoraddress', 'senderaddress', 'address')).trim() || 'Transport Hub';
    const consignorState = String(getVal('consignorstate', 'senderstate', 'state')).trim().toUpperCase() || 'GUJARAT';

    // Consignee
    const consigneeName = String(getVal('consigneename', 'consignee', 'receivername', 'receiver')).trim() || consignorName;
    const consigneeGSTIN = String(getVal('consigneegstin', 'receivergstin')).trim().toUpperCase();
    const consigneeAddress = String(getVal('consigneeaddress', 'receiveraddress')).trim();
    const consigneeState = String(getVal('consigneestate', 'receiverstate')).trim().toUpperCase() || consignorState;

    // Dispatched & Ship To
    const dispatchedPartyName = String(getVal('dispatchedpartyname', 'dispatchedparty', 'shippedfrom', 'loadingsite')).trim();
    const shipToName = String(getVal('shiptoname', 'shipto', 'deliverysite', 'destination')).trim();

    // Trip details
    const origin = String(getVal('originlocation', 'origin', 'from', 'source', 'loadingplace')).trim() || 'Origin Location';
    const destination = String(getVal('destinationlocation', 'destination', 'to', 'unloadingplace')).trim() || 'Destination Location';
    const vehicleNumber = String(getVal('vehiclenumber', 'vehicleno', 'trucknumber', 'truckno', 'vehicle')).trim().toUpperCase() || 'GJ-01-XX-0000';
    const driverName = String(getVal('drivername', 'driver')).trim();
    const driverPhone = String(getVal('driverphone', 'drivermobile', 'contact')).trim();
    const materialType = String(getVal('materialtype', 'materialdescription', 'material', 'goods', 'description', 'commodity')).trim() || 'General Freight Goods';

    // Quantities & Rates
    const weightTons = parseExcelNumber(getVal('weighttons', 'weight', 'tons', 'quantity', 'qty'));
    const ratePerTon = parseExcelNumber(getVal('rateperton', 'rate', 'freightrate'));
    
    // Freight amounts
    let grossFreight = parseExcelNumber(getVal('grossfreight', 'freightamount', 'freight', 'grossamount', 'amount'));
    if (grossFreight === 0 && weightTons > 0 && ratePerTon > 0) {
      grossFreight = weightTons * ratePerTon;
    }

    const loadingCharges = parseExcelNumber(getVal('loadingcharges', 'loading'));
    const unloadingCharges = parseExcelNumber(getVal('unloadingcharges', 'unloading'));
    const detentionCharges = parseExcelNumber(getVal('detentioncharges', 'detention'));
    const otherCharges = parseExcelNumber(getVal('othercharges', 'others'));

    let subTotal = parseExcelNumber(getVal('subtotal', 'subtotalamount'));
    if (subTotal === 0) {
      subTotal = grossFreight + loadingCharges + unloadingCharges + detentionCharges + otherCharges;
    }

    // Tax settings
    const taxSlabVal = parseExcelNumber(getVal('gstrate', 'taxslab', 'taxrate', 'gstratepct'));
    const taxSlab: TaxSlab = [0, 5, 12, 18, 28].includes(taxSlabVal) ? (taxSlabVal as TaxSlab) : (invoiceType === 'tax_invoice' ? 5 : 0);
    
    const taxTypeStr = String(getVal('taxtype', 'gsttype')).toLowerCase();
    const taxType: TaxType = taxTypeStr.includes('inter') || taxTypeStr.includes('igst') ? 'inter_state' : 'intra_state';
    const taxMechanism: TaxMechanism = (invoiceType === 'tax_invoice') ? 'forward_charge' : 'exempt';

    let cgstAmount = parseExcelNumber(getVal('cgstamount', 'cgst'));
    let sgstAmount = parseExcelNumber(getVal('sgstamount', 'sgst'));
    let igstAmount = parseExcelNumber(getVal('igstamount', 'igst'));
    let totalTax = parseExcelNumber(getVal('totaltax', 'gstamount', 'taxamount'));

    if (totalTax === 0 && taxSlab > 0 && invoiceType === 'tax_invoice') {
      totalTax = Math.round((subTotal * taxSlab) / 100);
      if (taxType === 'intra_state') {
        cgstAmount = Math.round(totalTax / 2);
        sgstAmount = totalTax - cgstAmount;
        igstAmount = 0;
      } else {
        cgstAmount = 0;
        sgstAmount = 0;
        igstAmount = totalTax;
      }
    }

    let grandTotal = parseExcelNumber(getVal('grandtotal', 'totalamount', 'total'));
    if (grandTotal === 0) {
      grandTotal = subTotal + totalTax;
    }

    // Deductions & Payments
    const advancePaid = parseExcelNumber(getVal('advancepaid', 'advance'));
    const fuelDeduction = parseExcelNumber(getVal('fueldeduction', 'fuel'));
    const otherDeductions = parseExcelNumber(getVal('otherdeductions'));
    const kasarDeduction = parseExcelNumber(getVal('kasarconcession', 'kasar'));
    const tdsAmount = parseExcelNumber(getVal('tdsamount', 'tds'));

    let netPayable = parseExcelNumber(getVal('netpayableamount', 'netpayable', 'netamount'));
    if (netPayable === 0) {
      netPayable = Math.max(0, grandTotal - advancePaid - fuelDeduction - otherDeductions - kasarDeduction - tdsAmount);
    }

    let amountPaid = parseExcelNumber(getVal('amountreceived', 'amountpaid', 'paidamount', 'paid'));
    if (amountPaid === 0 && advancePaid > 0) {
      amountPaid = advancePaid;
    }

    let balanceDue = parseExcelNumber(getVal('balancedue', 'pendingbalance', 'balance'));
    if (balanceDue === 0 && netPayable > amountPaid) {
      balanceDue = netPayable - amountPaid;
    }

    // Status
    let paymentStatus: PaymentStatus = 'unpaid';
    const statusStr = String(getVal('paymentstatus', 'status')).toLowerCase();
    if (['paid', 'unpaid', 'partial', 'overdue'].includes(statusStr)) {
      paymentStatus = statusStr as PaymentStatus;
    } else {
      if (balanceDue <= 0 && netPayable > 0) {
        paymentStatus = 'paid';
      } else if (amountPaid > 0) {
        paymentStatus = 'partial';
      } else {
        paymentStatus = 'unpaid';
      }
    }

    const notes = String(getVal('remarksnotes', 'remarks', 'notes')).trim();

    // Line items
    const lineItemDescription = materialType || 'Transport Freight Services';
    const itemAmount = grossFreight || subTotal;

    const invoice: Invoice = {
      id: `inv-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
      invoiceNumber,
      lrNumber,
      lrDate,
      invoiceDate,
      dueDate: invoiceDate,
      invoiceType,
      consignorName,
      consignorGSTIN,
      consignorAddress,
      consignorState,
      consignorStateCode: '24',
      consigneeName,
      consigneeGSTIN,
      consigneeAddress,
      consigneeState,
      dispatchedPartyName: dispatchedPartyName || undefined,
      shipToName: shipToName || undefined,
      origin,
      destination,
      vehicleNumber,
      driverName,
      driverPhone,
      materialType,
      items: [
        {
          id: `item-1`,
          description: lineItemDescription,
          weightTons: weightTons > 0 ? weightTons : undefined,
          ratePerTon: ratePerTon > 0 ? ratePerTon : undefined,
          quantity: weightTons > 0 ? weightTons : 1,
          unit: weightTons > 0 ? 'Tons' : 'Fixed',
          amount: itemAmount
        }
      ],
      grossFreight,
      loadingCharges,
      unloadingCharges,
      detentionCharges,
      otherCharges,
      subTotal,
      taxSlab,
      taxType,
      taxMechanism,
      cgstRate: taxType === 'intra_state' ? taxSlab / 2 : 0,
      sgstRate: taxType === 'intra_state' ? taxSlab / 2 : 0,
      igstRate: taxType === 'inter_state' ? taxSlab : 0,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      roundOff: 0,
      grandTotal,
      advancePaid,
      fuelDeduction,
      otherDeductions,
      kasarDeduction,
      tdsAmount,
      netPayable,
      amountPaid,
      balanceDue,
      paymentStatus,
      payments: amountPaid > 0 ? [
        {
          id: `pmt-imp-${Date.now()}-${index}`,
          date: invoiceDate,
          amount: amountPaid,
          mode: 'bank_neft',
          referenceNo: 'IMPORT-ADV-RECORD',
          notes: 'Auto-recorded during Excel import'
        }
      ] : [],
      notes: notes || 'Imported via Excel Batch Import',
      terms: 'Standard Transport Freight Payment Terms.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    parsedRows.push({
      rowIndex: index + 2, // Header row is row 1
      invoice,
      isValid: errors.length === 0,
      warnings,
      errors,
      rawRow: row
    });
  });

  return parsedRows;
}
