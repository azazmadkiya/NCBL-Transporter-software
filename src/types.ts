export type UserRole = 'admin' | 'accountant' | 'driver' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  truckNumber?: string;
  driverName?: string;
  transporterName?: string;
  photoURL?: string;
  username?: string;
}

export interface AppUserAccount {
  id: string;
  username: string;
  password: string;
  displayName: string;
  email: string;
  role: UserRole;
  phone?: string;
  truckNumber?: string;
  driverName?: string;
  transporterName?: string;
  updatedAt?: string;
}

export type InvoiceType = 'tax_invoice' | 'normal_bill';
export type TaxSlab = 0 | 5 | 12 | 18 | 28;
export type TaxType = 'intra_state' | 'inter_state';
export type TaxMechanism = 'forward_charge' | 'rcm' | 'exempt';
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'overdue';
export type PaymentMode = 'cash' | 'bank_neft' | 'upi' | 'cheque' | 'fuel_card';

export interface InvoiceItem {
  id: string;
  productId?: string;
  description: string;
  hsnCode?: string;
  packagesCount?: number;
  weightTons?: number;
  ratePerTon?: number;
  quantity: number;
  unit: string; // 'Tons', 'Kg', 'Trips', 'Boxes', 'Fixed', 'Bags', 'Pcs', 'Nos', 'MT', 'Ltr'
  rate?: number; // Unit rate
  discountPercent?: number;
  discountAmount?: number;
  taxableAmount?: number;
  gstRate?: TaxSlab; // 0, 5, 12, 18, 28
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  amount: number;
}

export interface ProductItem {
  id: string;
  name: string;
  code?: string; // SKU or item code
  hsnCode: string;
  category?: string;
  unit: string; // 'Bags', 'MT', 'Tons', 'Pcs', 'Kg', 'Nos', 'Boxes', 'Ltr'
  purchasePrice?: number;
  salePrice: number;
  gstRate: TaxSlab; // 0, 5, 12, 18, 28
  currentStock: number;
  minStockAlert?: number;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment' | 'sales_bill' | 'purchase_bill';
  quantity: number;
  unit: string;
  rate?: number;
  referenceNo?: string; // Sales Bill No / Purchase No / Note
  partyName?: string;
  date: string;
  notes?: string;
  createdAt: string;
}

export interface GSTSummaryItem {
  hsnCode: string;
  gstRate: TaxSlab;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  kasarAmount?: number; // Kasar / Discount / Settlement Concession given during payment
  mode: PaymentMode;
  referenceNo?: string;
  recordedBy?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  salesBillNumber?: string;
  salesBillDate?: string;
  purchaseBillNumber?: string;
  purchaseDate?: string;
  supplierInvoiceNumber?: string;
  supplierInvoiceDate?: string;
  lrNumber: string; // Bilty / Lorry Receipt Number
  lrDate: string;
  invoiceDate: string;
  dueDate: string;
  invoiceType: InvoiceType;
  billCategory?: 'income' | 'expense' | 'freight' | 'sales' | 'purchase'; // 'income' (Tax Income Bill), 'expense' (Tax Expense Bill), 'freight' (Standard Transport Invoice), 'sales' (GST Sales Bill), 'purchase' (GST Purchase Tax Invoice)
  expenseCategory?: string; // e.g. 'Unloading', 'Loading', 'Detention', 'Labour', 'Freight Expense', 'Commission', etc.
  ledgerImpact?: 'debit' | 'credit'; // 'debit' = increases receivable from party; 'credit' = increases payable / credits party
  
  // Consignor (Sender / Billing Party)
  partyId?: string;
  consignorName: string;
  consignorPartyUser?: string; // Party User (Sender Contact / Incharge)
  consignorGSTIN: string;
  consignorCity?: string;
  consignorMobile?: string;
  consignorPhone?: string;
  consignorAddress: string;
  consignorState: string;
  consignorStateCode: string;

  // Consignee (Receiver)
  consigneeName: string;
  consigneePartyUser?: string; // Party User (Receiver User / Site Contact)
  consigneeGSTIN: string;
  consigneeAddress: string;
  consigneeCity?: string;
  consigneeMobile?: string;
  consigneeState: string;

  // Ship To (Delivery Destination)
  shipToName?: string;
  shipToPartyUser?: string; // Party User for Delivery Site
  shipToAddress?: string;
  shipToCity?: string;
  shipToMobile?: string;
  shipToGSTIN?: string;
  shipToState?: string;

  // Dispatched Party / Loading Site (Shipped From / Dispatched From)
  dispatchedPartyName?: string;
  dispatchedPartyPartyUser?: string; // Party User (Loading Site Contact / Incharge)
  dispatchedPartyAddress?: string;
  dispatchedPartyCity?: string;
  dispatchedPartyMobile?: string;
  dispatchedPartyGSTIN?: string;
  dispatchedPartyState?: string;

  // Trip & Route details
  origin: string;
  destination: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  materialType: string;

  // Line items
  items: InvoiceItem[];

  // Calculation Breakdown
  grossFreight: number;
  loadingCharges: number;
  unloadingCharges: number;
  detentionCharges: number;
  otherCharges: number;
  subTotal: number;

  // Tax settings
  taxSlab: TaxSlab;
  taxType: TaxType; // Intra (CGST+SGST) or Inter (IGST)
  taxMechanism: TaxMechanism; // forward_charge, rcm (Reverse Charge Mechanism), exempt
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;

  roundOff?: number;
  grandTotal: number;
  
  // Advances & Deductions
  advancePaid: number;
  fuelDeduction: number;
  otherDeductions: number;
  kasarDeduction?: number; // Kasar / Lump-Sum Discount / Concession allowed on Invoice
  
  // TDS Settings (Section 194C)
  tdsApplicable?: boolean;
  tdsDeducteeType?: 'individual' | 'company' | 'custom'; // 'individual' (1%), 'company' (2%), 'custom'
  tdsRate?: number; // e.g. 1%, 2%, or custom %
  tdsAmount?: number; // calculated/entered TDS amount
  
  netPayable: number;
  
  // Payments recorded
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  payments: PaymentRecord[];

  notes?: string;
  remarks?: string;
  weightTons?: number;
  freightRate?: number;
  terms?: string;
  createdAt: string;
  updatedAt: string;
}

export type PartyAccountCategory = 'party' | 'transporter' | 'sales_party' | 'lifting_party';
export type AccountGroup = 'sundry_debtors' | 'sundry_creditors';

export interface Party {
  id: string;
  name: string;
  partyUser?: string; // Party User / Contact Person / Destination Receiver User / Loading Incharge
  gstin: string;
  pan?: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  partyType: 'consignor' | 'consignee' | 'both' | 'transporter' | 'sales_customer' | 'vendor' | 'supplier' | 'dispatched' | 'shipto';
  presetCategory?: 'consignee_shipto' | 'dispatched_party' | 'both' | 'all';
  accountCategory?: PartyAccountCategory; // 'party' | 'sales_party' (Party Ledgers), 'lifting_party' (Party Ledgers Lifting), 'transporter' (Transporter Accounts)
  accountGroup?: AccountGroup; // 'sundry_debtors' (Receivable/Customer) or 'sundry_creditors' (Payable/Vendor/Transporter)
  openingBalance: number;
  currentBalance: number; // positive = amount receivable from party, negative = advance/payable
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Vehicle {
  id: string;
  vehicleNumber: string;
  vehicleType: string; // '14 Wheeler', '10 Wheeler', 'Container 32ft', 'Trailer', 'Taurus'
  driverName: string;
  driverPhone: string;
  ownerType: 'own' | 'attached' | 'market';
  status: 'available' | 'in_transit' | 'maintenance';
  capacityTons: number;
  currentLocation?: string;
  totalFreightEarned: number;
  totalExpenses: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  vehicleNumber: string;
  lrNumber?: string;
  category: 'fuel' | 'toll' | 'driver_bhatta' | 'maintenance' | 'police_fine' | 'loading_unloading' | 'office_other';
  amount: number;
  paidMode: PaymentMode;
  vendorName?: string;
  remarks?: string;
  recordedBy?: string;
  receiptNumber?: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  entityId: string; // partyId or vehicleNumber
  entityType: 'party' | 'vehicle';
  date: string;
  description: string;
  referenceNo: string; // Invoice No / Expense ID / Payment ID
  debit: number;  // Increases party receivable or truck expense
  credit: number; // Decreases party receivable or truck freight income
  runningBalance: number;
  createdAt: string;
}

export const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman and Diu' },
  { code: '26', name: 'Dadra and Nagar Haveli' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' }
];

export interface CompanySettings {
  companyName: string;
  tagline: string;
  gstin: string;
  gstNumber?: string;
  pan: string;
  phone: string;
  alternatePhone?: string;
  email: string;
  address: string;
  city: string;
  state: string;
  stateCode?: string;
  pincode: string;
  bankName: string;
  bankAccountNo: string;
  bankIfsc: string;
  bankBranch: string;
  upiId?: string;
  termsAndConditions: string[];
}

export interface NoteReminder {
  id: string;
  title: string;
  category: 'bhada_rate' | 'reminder' | 'general';
  originCity?: string;
  destinationCity?: string;
  bhadaAmount?: number;
  ratePerTon?: number;
  vehicleType?: string;
  reminderDate?: string;
  partyName?: string;
  description?: string;
  isCompleted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Formats a numeric amount for currency display with proper Indian locale formatting.
 * Guarantees minimum 2 decimal places (e.g. 12.5 -> "12.50") 
 * and up to 4 decimal places if specified (e.g. 12.3456 -> "12.3456").
 */
export function formatINR(amount: number | undefined | null, minDecimals: number = 2, maxDecimals: number = 4): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals
  });
}

