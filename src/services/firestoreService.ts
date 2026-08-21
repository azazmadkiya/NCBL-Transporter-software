import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Invoice, Party, Vehicle, Expense, CompanySettings, LedgerEntry, PaymentRecord, NoteReminder, AppUserAccount, ProductItem, StockTransaction } from '../types';
import { 
  initialCompanySettings, initialParties, initialVehicles, initialInvoices, initialExpenses, initialNotesReminders, initialAppUsers 
} from '../data/mockInitialData';

// Firestore collection names
const INVOICES_COL = 'invoices';
const PARTIES_COL = 'parties';
const VEHICLES_COL = 'vehicles';
const EXPENSES_COL = 'expenses';
const NOTES_REMINDERS_COL = 'notes_reminders';
const USERS_COL = 'app_users';
const PRODUCTS_COL = 'products';
const STOCK_TX_COL = 'stock_transactions';
const SETTINGS_DOC = 'settings/company_profile';

/**
 * Recursively removes keys with `undefined` values or functions from objects or arrays
 * so Firestore `setDoc` / `updateDoc` / `writeBatch` never receives `undefined`.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (typeof data === 'number') {
    if (!isFinite(data) || isNaN(data)) return 0 as unknown as T;
    return data;
  }
  if (typeof data === 'string' || typeof data === 'boolean') {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString() as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      const val = (data as Record<string, any>)[key];
      if (val !== undefined && typeof val !== 'function') {
        cleaned[key] = cleanForFirestore(val);
      }
    }
    return cleaned as T;
  }
  return data;
}

// Helper to clear old demo data and initialize clean company settings in Firestore
export async function seedInitialFirestoreData() {
  try {
    const SEED_KEY = 'ncbl_firestore_seed_v3';
    if (!localStorage.getItem(SEED_KEY)) {
      // Clear legacy demo IDs in parallel if present
      const legacyInvIds = ['inv-1001', 'inv-1002', 'inv-1003'];
      const legacyPtyIds = ['pty-1', 'pty-2', 'pty-3', 'pty-4'];
      const legacyVehIds = ['veh-1', 'veh-2', 'veh-3'];
      const legacyExpIds = ['exp-101', 'exp-102', 'exp-103', 'exp-104'];

      const deletePromises = [
        ...legacyInvIds.map(id => deleteDoc(doc(db, INVOICES_COL, id)).catch(() => {})),
        ...legacyPtyIds.map(id => deleteDoc(doc(db, PARTIES_COL, id)).catch(() => {})),
        ...legacyVehIds.map(id => deleteDoc(doc(db, VEHICLES_COL, id)).catch(() => {})),
        ...legacyExpIds.map(id => deleteDoc(doc(db, EXPENSES_COL, id)).catch(() => {}))
      ];

      await Promise.allSettled(deletePromises);

      const settingsSnap = await getDoc(doc(db, 'settings', 'company_profile'));
      if (!settingsSnap.exists()) {
        await setDoc(doc(db, 'settings', 'company_profile'), cleanForFirestore(initialCompanySettings));
      } else {
        const current = settingsSnap.data() as CompanySettings;
        if (!current.companyName || /nirmaladevi|nirmala|ncpl|nirmal/i.test(current.companyName)) {
          await setDoc(doc(db, 'settings', 'company_profile'), cleanForFirestore({
            ...current,
            companyName: 'NCBL Transport',
            email: current.email?.replace(/nirmalatransport\.com|nirmaltransport\.com/g, 'ncbltransport.com') || 'billing@ncbltransport.com'
          }), { merge: true });
        }
      }

      localStorage.setItem(SEED_KEY, 'true');
      console.log('Firestore initialization complete');
    }
  } catch (error) {
    console.warn('Firestore initialization note:', error);
  }
}

// Invoices CRUD
export function subscribeInvoices(callback: (invoices: Invoice[]) => void) {
  try {
    const q = query(collection(db, INVOICES_COL));
    return onSnapshot(q, (snapshot) => {
      const invoices: Invoice[] = [];
      snapshot.forEach((doc) => {
        invoices.push(doc.data() as Invoice);
      });
      // Sort newest first
      invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(invoices);
    }, (err) => {
      console.warn('Invoices subscription error, fallback to mock data', err);
      callback(initialInvoices);
    });
  } catch (err) {
    console.warn('Firestore query error', err);
    callback(initialInvoices);
    return () => {};
  }
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  try {
    const cleaned = cleanForFirestore(invoice);
    await setDoc(doc(db, INVOICES_COL, invoice.id), cleaned, { merge: true });
  } catch (error) {
    console.error('Error saving invoice:', error);
  }
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, INVOICES_COL, invoiceId));
  } catch (error) {
    console.error('Error deleting invoice:', error);
  }
}

// Record Payment against Invoice
export async function addInvoicePayment(
  invoice: Invoice, 
  payment: PaymentRecord
): Promise<void> {
  const updatedPayments = [...invoice.payments, payment];
  const newAmountPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaymentKasar = updatedPayments.reduce((sum, p) => sum + (p.kasarAmount || 0), 0);
  const newBalanceDue = Math.max(0, invoice.netPayable - (newAmountPaid + totalPaymentKasar));
  
  let newStatus: Invoice['paymentStatus'] = 'unpaid';
  if (newBalanceDue === 0) {
    newStatus = 'paid';
  } else if ((newAmountPaid + totalPaymentKasar) > 0) {
    newStatus = 'partial';
  }

  const updatedInvoice: Invoice = {
    ...invoice,
    payments: updatedPayments,
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    paymentStatus: newStatus,
    updatedAt: new Date().toISOString()
  };

  await saveInvoice(updatedInvoice);
}

export async function updateInvoicePayment(
  invoice: Invoice,
  updatedPayment: PaymentRecord
): Promise<void> {
  const updatedPayments = invoice.payments.map(p => p.id === updatedPayment.id ? updatedPayment : p);
  const newAmountPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaymentKasar = updatedPayments.reduce((sum, p) => sum + (p.kasarAmount || 0), 0);
  const newBalanceDue = Math.max(0, invoice.netPayable - (newAmountPaid + totalPaymentKasar));

  let newStatus: Invoice['paymentStatus'] = 'unpaid';
  if (newBalanceDue === 0) {
    newStatus = 'paid';
  } else if ((newAmountPaid + totalPaymentKasar) > 0) {
    newStatus = 'partial';
  }

  const updatedInvoice: Invoice = {
    ...invoice,
    payments: updatedPayments,
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    paymentStatus: newStatus,
    updatedAt: new Date().toISOString()
  };

  await saveInvoice(updatedInvoice);
}

export async function deleteInvoicePayment(
  invoice: Invoice,
  paymentId: string
): Promise<void> {
  const updatedPayments = invoice.payments.filter(p => p.id !== paymentId);
  const newAmountPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaymentKasar = updatedPayments.reduce((sum, p) => sum + (p.kasarAmount || 0), 0);
  const newBalanceDue = Math.max(0, invoice.netPayable - (newAmountPaid + totalPaymentKasar));

  let newStatus: Invoice['paymentStatus'] = 'unpaid';
  if (newBalanceDue === 0 && (newAmountPaid + totalPaymentKasar) > 0) {
    newStatus = 'paid';
  } else if ((newAmountPaid + totalPaymentKasar) > 0) {
    newStatus = 'partial';
  }

  const updatedInvoice: Invoice = {
    ...invoice,
    payments: updatedPayments,
    amountPaid: newAmountPaid,
    balanceDue: newBalanceDue,
    paymentStatus: newStatus,
    updatedAt: new Date().toISOString()
  };

  await saveInvoice(updatedInvoice);
}

// Parties CRUD
export function subscribeParties(callback: (parties: Party[]) => void) {
  try {
    const q = query(collection(db, PARTIES_COL));
    return onSnapshot(q, (snapshot) => {
      const parties: Party[] = [];
      snapshot.forEach((doc) => {
        parties.push(doc.data() as Party);
      });
      callback(parties);
    }, (err) => {
      console.warn('Parties subscription error', err);
      callback(initialParties);
    });
  } catch {
    callback(initialParties);
    return () => {};
  }
}

export async function saveParty(party: Party): Promise<void> {
  try {
    const cleaned = cleanForFirestore(party);
    await setDoc(doc(db, PARTIES_COL, party.id), cleaned, { merge: true });
  } catch (error) {
    console.error('Error saving party:', error);
  }
}

export async function deleteParty(partyId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PARTIES_COL, partyId));
  } catch (error) {
    console.error('Error deleting party:', error);
  }
}

// Vehicles CRUD
export function subscribeVehicles(callback: (vehicles: Vehicle[]) => void) {
  try {
    const q = query(collection(db, VEHICLES_COL));
    return onSnapshot(q, (snapshot) => {
      const vehicles: Vehicle[] = [];
      snapshot.forEach((doc) => {
        vehicles.push(doc.data() as Vehicle);
      });
      callback(vehicles);
    }, (err) => {
      console.warn('Vehicles subscription error', err);
      callback(initialVehicles);
    });
  } catch {
    callback(initialVehicles);
    return () => {};
  }
}

export async function saveVehicle(vehicle: Vehicle): Promise<void> {
  try {
    const cleaned = cleanForFirestore(vehicle);
    await setDoc(doc(db, VEHICLES_COL, vehicle.id), cleaned, { merge: true });
  } catch (error) {
    console.error('Error saving vehicle:', error);
  }
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, VEHICLES_COL, vehicleId));
  } catch (error) {
    console.error('Error deleting vehicle:', error);
  }
}

// Expenses CRUD
export function subscribeExpenses(callback: (expenses: Expense[]) => void) {
  try {
    const q = query(collection(db, EXPENSES_COL));
    return onSnapshot(q, (snapshot) => {
      const expenses: Expense[] = [];
      snapshot.forEach((doc) => {
        expenses.push(doc.data() as Expense);
      });
      expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      callback(expenses);
    }, (err) => {
      console.warn('Expenses subscription error', err);
      callback(initialExpenses);
    });
  } catch {
    callback(initialExpenses);
    return () => {};
  }
}

export async function saveExpense(expense: Expense): Promise<void> {
  try {
    const cleaned = cleanForFirestore(expense);
    await setDoc(doc(db, EXPENSES_COL, expense.id), cleaned, { merge: true });
  } catch (error) {
    console.error('Error saving expense:', error);
  }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, EXPENSES_COL, expenseId));
  } catch (error) {
    console.error('Error deleting expense:', error);
  }
}

// Notes & Reminders CRUD
export function subscribeNotesReminders(callback: (notes: NoteReminder[]) => void) {
  try {
    const q = query(collection(db, NOTES_REMINDERS_COL));
    return onSnapshot(q, (snapshot) => {
      const notes: NoteReminder[] = [];
      snapshot.forEach((doc) => {
        notes.push(doc.data() as NoteReminder);
      });
      notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(notes);
    }, (err) => {
      console.warn('NotesReminders subscription error', err);
      callback(initialNotesReminders);
    });
  } catch {
    callback(initialNotesReminders);
    return () => {};
  }
}

export async function saveNoteReminder(note: NoteReminder): Promise<void> {
  try {
    const cleaned = cleanForFirestore(note);
    await setDoc(doc(db, NOTES_REMINDERS_COL, note.id), cleaned, { merge: true });
  } catch (error) {
    console.error('Error saving note/reminder:', error);
  }
}

export async function deleteNoteReminder(noteId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, NOTES_REMINDERS_COL, noteId));
  } catch (error) {
    console.error('Error deleting note/reminder:', error);
  }
}

// Products CRUD
export function subscribeProducts(callback: (products: ProductItem[]) => void) {
  try {
    const q = query(collection(db, PRODUCTS_COL));
    return onSnapshot(q, (snapshot) => {
      const products: ProductItem[] = [];
      snapshot.forEach((doc) => {
        products.push(doc.data() as ProductItem);
      });
      products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      callback(products);
    }, (err) => {
      console.warn('Products subscription error', err);
      callback([]);
    });
  } catch {
    callback([]);
    return () => {};
  }
}

export async function saveProduct(product: ProductItem): Promise<void> {
  try {
    const cleaned = cleanForFirestore(product);
    await setDoc(doc(db, PRODUCTS_COL, product.id), cleaned, { merge: true });
  } catch (error) {
    console.error('Error saving product:', error);
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PRODUCTS_COL, productId));
  } catch (error) {
    console.error('Error deleting product:', error);
  }
}

// Adjust product stock & record transaction
export async function adjustProductStock(
  productId: string,
  deltaQty: number,
  transactionInfo: {
    productName: string;
    type: 'in' | 'out' | 'adjustment' | 'sales_bill' | 'purchase_bill';
    unit: string;
    rate?: number;
    referenceNo?: string;
    partyName?: string;
    date: string;
    notes?: string;
  }
): Promise<void> {
  try {
    const prodDocRef = doc(db, PRODUCTS_COL, productId);
    const prodSnap = await getDoc(prodDocRef);
    if (prodSnap.exists()) {
      const current = prodSnap.data() as ProductItem;
      const newStock = Math.max(0, (current.currentStock || 0) + deltaQty);
      await updateDoc(prodDocRef, {
        currentStock: newStock,
        updatedAt: new Date().toISOString()
      });
    }

    // Save stock transaction record
    const txId = `stk-tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const tx: StockTransaction = {
      id: txId,
      productId,
      productName: transactionInfo.productName,
      type: transactionInfo.type,
      quantity: Math.abs(deltaQty),
      unit: transactionInfo.unit,
      rate: transactionInfo.rate,
      referenceNo: transactionInfo.referenceNo,
      partyName: transactionInfo.partyName,
      date: transactionInfo.date || new Date().toISOString().split('T')[0],
      notes: transactionInfo.notes,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, STOCK_TX_COL, txId), cleanForFirestore(tx));
  } catch (error) {
    console.error('Error adjusting product stock:', error);
  }
}

// Stock Transactions CRUD
export function subscribeStockTransactions(callback: (txs: StockTransaction[]) => void) {
  try {
    const q = query(collection(db, STOCK_TX_COL));
    return onSnapshot(q, (snapshot) => {
      const txs: StockTransaction[] = [];
      snapshot.forEach((doc) => {
        txs.push(doc.data() as StockTransaction);
      });
      txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(txs);
    }, (err) => {
      console.warn('Stock Transactions subscription error', err);
      callback([]);
    });
  } catch {
    callback([]);
    return () => {};
  }
}

export async function deleteStockTransaction(txId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, STOCK_TX_COL, txId));
  } catch (error) {
    console.error('Error deleting stock transaction:', error);
  }
}

const LOCAL_SETTINGS_KEY = 'ncbl_transport_company_profile_v1';

export function getLocalCompanySettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.companyName) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse local company settings:', e);
  }
  return initialCompanySettings;
}

export function saveLocalCompanySettings(settings: CompanySettings): void {
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to cache local company settings:', e);
  }
}

// Company Settings
export function subscribeCompanySettings(callback: (settings: CompanySettings) => void) {
  try {
    const local = getLocalCompanySettings();
    callback(local);

    return onSnapshot(doc(db, 'settings', 'company_profile'), (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.data() as CompanySettings;
        // Sanitize legacy NIRMALADEVI / NIRMALADEVI CARE / Nirmala if present in Firestore
        let sanitized = { ...raw };
        if (!sanitized.companyName || /nirmaladevi|nirmala|ncpl|nirmal/i.test(sanitized.companyName)) {
          sanitized.companyName = 'NCBL Transport';
        }
        saveLocalCompanySettings(sanitized);
        callback(sanitized);
      } else {
        callback(getLocalCompanySettings());
      }
    }, (err) => {
      console.warn('Company settings subscription warning (using local fallback):', err);
      callback(getLocalCompanySettings());
    });
  } catch (e) {
    callback(getLocalCompanySettings());
    return () => {};
  }
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  saveLocalCompanySettings(settings);
  try {
    const cleaned = cleanForFirestore(settings);
    await setDoc(doc(db, 'settings', 'company_profile'), cleaned, { merge: true });
  } catch (error) {
    console.warn('Note on cloud settings sync (cached locally):', error);
  }
}

// Backup & Import
export interface TransportBackupData {
  version: string;
  exportedAt: string;
  companyName?: string;
  invoices?: Invoice[];
  bills?: Invoice[];
  parties?: Party[];
  transporters?: Party[];
  customers?: Party[];
  vehicles?: Vehicle[];
  trucks?: Vehicle[];
  expenses?: Expense[];
  products?: ProductItem[];
  stockProducts?: ProductItem[];
  stock_transactions?: StockTransaction[];
  stockTransactions?: StockTransaction[];
  notes_reminders?: NoteReminder[];
  notes?: NoteReminder[];
  reminders?: NoteReminder[];
  app_users?: AppUserAccount[];
  users?: AppUserAccount[];
  settings?: CompanySettings;
  [key: string]: any;
}

export async function exportFirestoreBackup(fallbackData?: {
  invoices?: Invoice[];
  parties?: Party[];
  vehicles?: Vehicle[];
  expenses?: Expense[];
  products?: ProductItem[];
  stockTransactions?: StockTransaction[];
  notesReminders?: NoteReminder[];
  appUsers?: AppUserAccount[];
  settings?: CompanySettings;
}): Promise<TransportBackupData> {
  try {
    const [invSnap, ptySnap, vehSnap, expSnap, prodSnap, stockSnap, notesSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, INVOICES_COL)).catch(() => null),
      getDocs(collection(db, PARTIES_COL)).catch(() => null),
      getDocs(collection(db, VEHICLES_COL)).catch(() => null),
      getDocs(collection(db, EXPENSES_COL)).catch(() => null),
      getDocs(collection(db, PRODUCTS_COL)).catch(() => null),
      getDocs(collection(db, STOCK_TX_COL)).catch(() => null),
      getDocs(collection(db, NOTES_REMINDERS_COL)).catch(() => null),
      getDocs(collection(db, USERS_COL)).catch(() => null)
    ]);

    const invoices: Invoice[] = [];
    invSnap?.forEach((doc) => invoices.push(doc.data() as Invoice));

    const parties: Party[] = [];
    ptySnap?.forEach((doc) => parties.push(doc.data() as Party));

    const vehicles: Vehicle[] = [];
    vehSnap?.forEach((doc) => vehicles.push(doc.data() as Vehicle));

    const expenses: Expense[] = [];
    expSnap?.forEach((doc) => expenses.push(doc.data() as Expense));

    const products: ProductItem[] = [];
    prodSnap?.forEach((doc) => products.push(doc.data() as ProductItem));

    const stockTransactions: StockTransaction[] = [];
    stockSnap?.forEach((doc) => stockTransactions.push(doc.data() as StockTransaction));

    const notesReminders: NoteReminder[] = [];
    notesSnap?.forEach((doc) => notesReminders.push(doc.data() as NoteReminder));

    const appUsers: AppUserAccount[] = [];
    usersSnap?.forEach((doc) => appUsers.push(doc.data() as AppUserAccount));

    let companySettings = fallbackData?.settings || initialCompanySettings;
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'company_profile'));
      if (settingsSnap.exists()) {
        companySettings = settingsSnap.data() as CompanySettings;
      }
    } catch {
      // Use fallback
    }

    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      companyName: companySettings.companyName || 'NCBL Transport',
      invoices: invoices.length > 0 ? invoices : (fallbackData?.invoices || []),
      parties: parties.length > 0 ? parties : (fallbackData?.parties || []),
      vehicles: vehicles.length > 0 ? vehicles : (fallbackData?.vehicles || []),
      expenses: expenses.length > 0 ? expenses : (fallbackData?.expenses || []),
      products: products.length > 0 ? products : (fallbackData?.products || []),
      stock_transactions: stockTransactions.length > 0 ? stockTransactions : (fallbackData?.stockTransactions || []),
      notes_reminders: notesReminders.length > 0 ? notesReminders : (fallbackData?.notesReminders || []),
      app_users: appUsers.length > 0 ? appUsers : (fallbackData?.appUsers || getLocalUserAccounts()),
      settings: companySettings,
    };
  } catch (err) {
    console.warn('Export from Firestore failed, using state fallback:', err);
    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      companyName: fallbackData?.settings?.companyName || 'NCBL Transport',
      invoices: fallbackData?.invoices || [],
      parties: fallbackData?.parties || [],
      vehicles: fallbackData?.vehicles || [],
      expenses: fallbackData?.expenses || [],
      products: fallbackData?.products || [],
      stock_transactions: fallbackData?.stockTransactions || [],
      notes_reminders: fallbackData?.notesReminders || [],
      app_users: fallbackData?.appUsers || getLocalUserAccounts(),
      settings: fallbackData?.settings || initialCompanySettings,
    };
  }
}

function makeSafeDocId(rawId: any, fallbackPrefix: string, index: number): string {
  if (rawId !== null && rawId !== undefined) {
    let str = String(rawId).trim();
    // Replace all slashes, backslashes, spaces, hashes, dots, colons, question marks with underscore
    str = str.replace(/[\/\\\s#\.\:\?~`!@\$%\^&\*\(\)\+=\{\}\[\]\|;'"<>,]/g, '_');
    str = str.replace(/_+/g, '_');
    str = str.replace(/^_+|_+$/g, '');
    if (str.length > 0 && str.length <= 500 && !str.startsWith('__')) {
      return str;
    }
  }
  return `${fallbackPrefix}_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Resilient batch and item writer for Firestore collections
 */
async function writeCollectionInBatches<T extends Record<string, any>>(
  collectionName: string,
  items: T[],
  idFallbackPrefix: string
): Promise<number> {
  if (!Array.isArray(items) || items.length === 0) return 0;

  let successCount = 0;
  const CHUNK_SIZE = 25; // Smaller chunks to prevent batch size/timeout issues

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    
    // Try batch write first
    try {
      const batch = writeBatch(db);
      const docsInBatch: { ref: any; cleaned: any }[] = [];

      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        if (!item || typeof item !== 'object') continue;

        const rawId = item.id || item.invoiceNumber || item.partyCode || item.truckNumber || item.vehicleNumber || item.username;
        const safeDocId = makeSafeDocId(rawId, idFallbackPrefix, i + j);

        const cleaned = cleanForFirestore({
          ...item,
          id: item.id || safeDocId
        });

        const docRef = doc(db, collectionName, safeDocId);
        batch.set(docRef, cleaned, { merge: true });
        docsInBatch.push({ ref: docRef, cleaned });
      }

      if (docsInBatch.length > 0) {
        await batch.commit();
        successCount += docsInBatch.length;
      }
    } catch (batchErr) {
      console.warn(`Batch write failed for ${collectionName}, falling back to resilient individual doc writes:`, batchErr);
      
      // Fallback: Individual setDoc writes with isolated error catching per document
      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        if (!item || typeof item !== 'object') continue;
        try {
          const rawId = item.id || item.invoiceNumber || item.partyCode || item.truckNumber || item.vehicleNumber || item.username;
          const safeDocId = makeSafeDocId(rawId, idFallbackPrefix, i + j);
          
          const cleaned = cleanForFirestore({
            ...item,
            id: item.id || safeDocId
          });
          
          await setDoc(doc(db, collectionName, safeDocId), cleaned, { merge: true });
          successCount++;
        } catch (singleErr) {
          console.warn(`Warning: Could not save individual doc in ${collectionName}:`, singleErr);
        }
      }
    }
  }
  return successCount;
}

export async function restoreFirestoreBackup(data: Partial<TransportBackupData>): Promise<{
  invoicesCount: number;
  partiesCount: number;
  vehiclesCount: number;
  expensesCount: number;
  productsCount: number;
  stockTxCount: number;
  notesCount: number;
  usersCount: number;
  settingsUpdated: boolean;
}> {
  try {
    // Normalize root data if wrapped inside { data: ... }
    const raw: any = data && typeof data === 'object' && 'data' in data && typeof (data as any).data === 'object' 
      ? (data as any).data 
      : (data || {});

    // Extract arrays with flexible property aliases
    const invoicesList = Array.isArray(raw.invoices) ? raw.invoices : (Array.isArray(raw.bills) ? raw.bills : (Array.isArray(raw.salesBills) ? raw.salesBills : []));
    const partiesList = Array.isArray(raw.parties) ? raw.parties : (Array.isArray(raw.transporters) ? raw.transporters : (Array.isArray(raw.customers) ? raw.customers : (Array.isArray(raw.vendors) ? raw.vendors : [])));
    const vehiclesList = Array.isArray(raw.vehicles) ? raw.vehicles : (Array.isArray(raw.trucks) ? raw.trucks : (Array.isArray(raw.fleet) ? raw.fleet : []));
    const expensesList = Array.isArray(raw.expenses) ? raw.expenses : (Array.isArray(raw.tripExpenses) ? raw.tripExpenses : []);
    const productsList = Array.isArray(raw.products) ? raw.products : (Array.isArray(raw.stockProducts) ? raw.stockProducts : (Array.isArray(raw.items) ? raw.items : []));
    const stockTxList = Array.isArray(raw.stock_transactions) ? raw.stock_transactions : (Array.isArray(raw.stockTransactions) ? raw.stockTransactions : (Array.isArray(raw.transactions) ? raw.transactions : []));
    const notesList = Array.isArray(raw.notes_reminders) ? raw.notes_reminders : (Array.isArray(raw.notes) ? raw.notes : (Array.isArray(raw.reminders) ? raw.reminders : []));
    const usersList = Array.isArray(raw.app_users) ? raw.app_users : (Array.isArray(raw.users) ? raw.users : (Array.isArray(raw.accounts) ? raw.accounts : []));

    // Run batch restoration across collections in parallel with individual error protection
    const [
      invoicesCount,
      partiesCount,
      vehiclesCount,
      expensesCount,
      productsCount,
      stockTxCount,
      notesCount,
      usersCount
    ] = await Promise.all([
      writeCollectionInBatches(INVOICES_COL, invoicesList, 'inv').catch(() => 0),
      writeCollectionInBatches(PARTIES_COL, partiesList, 'pty').catch(() => 0),
      writeCollectionInBatches(VEHICLES_COL, vehiclesList, 'veh').catch(() => 0),
      writeCollectionInBatches(EXPENSES_COL, expensesList, 'exp').catch(() => 0),
      writeCollectionInBatches(PRODUCTS_COL, productsList, 'prod').catch(() => 0),
      writeCollectionInBatches(STOCK_TX_COL, stockTxList, 'stx').catch(() => 0),
      writeCollectionInBatches(NOTES_REMINDERS_COL, notesList, 'note').catch(() => 0),
      writeCollectionInBatches(USERS_COL, usersList, 'user').catch(() => 0)
    ]);

    // Sync users locally if app_users were restored
    if (usersList.length > 0) {
      try {
        const existingLocal = getLocalUserAccounts();
        const mergedMap = new Map<string, AppUserAccount>();
        existingLocal.forEach(u => mergedMap.set(u.id || u.username, u));
        usersList.forEach((u: any) => {
          if (u && (u.id || u.username)) {
            mergedMap.set(u.id || u.username, u);
          }
        });
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(Array.from(mergedMap.values())));
      } catch {
        // Local sync fallback
      }
    }

    // Restore Company Settings
    let settingsUpdated = false;
    const settingsObj = raw.settings || raw.companySettings || raw.company_profile;
    if (settingsObj && typeof settingsObj === 'object') {
      try {
        saveLocalCompanySettings(settingsObj);
        await setDoc(doc(db, 'settings', 'company_profile'), cleanForFirestore(settingsObj), { merge: true });
        settingsUpdated = true;
      } catch (setErr) {
        console.warn('Note: Settings restored locally with Firestore sync notice:', setErr);
        settingsUpdated = true;
      }
    }

    return {
      invoicesCount,
      partiesCount,
      vehiclesCount,
      expensesCount,
      productsCount,
      stockTxCount,
      notesCount,
      usersCount,
      settingsUpdated,
    };
  } catch (err) {
    console.error('Error during database restoration:', err);
    return {
      invoicesCount: 0,
      partiesCount: 0,
      vehiclesCount: 0,
      expensesCount: 0,
      productsCount: 0,
      stockTxCount: 0,
      notesCount: 0,
      usersCount: 0,
      settingsUpdated: false,
    };
  }
}

// ==========================================
// User Accounts & Password Management
// ==========================================

const LOCAL_USERS_KEY = 'nirmala_app_users_v1';
const REMOVED_USERNAMES = new Set(['parthroadlince', 'nileshpoojara', 'tarundesai']);
const REMOVED_USER_IDS = new Set(['user-parthroadlince', 'user-nileshpoojara', 'user-tarundesai']);

export function getLocalUserAccounts(): AppUserAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = parsed.filter((u: any) => 
          u && 
          !REMOVED_USER_IDS.has(u.id) && 
          !REMOVED_USERNAMES.has(String(u.username || '').toLowerCase().trim())
        );
        if (sanitized.length !== parsed.length) {
          saveLocalUserAccounts(sanitized);
        }
        return sanitized.length > 0 ? sanitized : initialAppUsers;
      }
    }
  } catch (e) {
    console.warn('Failed to parse local user accounts:', e);
  }
  return initialAppUsers;
}

export function saveLocalUserAccounts(users: AppUserAccount[]): void {
  try {
    const cleaned = (users || []).filter(u => 
      u && 
      !REMOVED_USER_IDS.has(u.id) && 
      !REMOVED_USERNAMES.has(String(u.username || '').toLowerCase().trim())
    );
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.warn('Failed to cache local user accounts:', e);
  }
}

export function subscribeUserAccounts(callback: (users: AppUserAccount[]) => void) {
  // Always emit local cache immediately
  const localCache = getLocalUserAccounts();
  callback(localCache);

  try {
    const q = query(collection(db, USERS_COL));
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // If Firestore collection is empty, seed initial users
        initialAppUsers.forEach((u) => {
          setDoc(doc(db, USERS_COL, u.id), cleanForFirestore(u), { merge: true }).catch(() => {});
        });
        saveLocalUserAccounts(initialAppUsers);
        callback(initialAppUsers);
        return;
      }

      const usersList: AppUserAccount[] = [];
      snapshot.forEach((docSnap) => {
        const uData = docSnap.data() as AppUserAccount;
        const rawId = docSnap.id || uData?.id;
        const rawUname = String(uData?.username || '').toLowerCase().trim();

        // If it matches one of the removed users, delete it from Firestore
        if (REMOVED_USER_IDS.has(rawId) || REMOVED_USERNAMES.has(rawUname)) {
          deleteDoc(doc(db, USERS_COL, docSnap.id)).catch(() => {});
        } else {
          usersList.push(uData);
        }
      });

      // Merge with initial users to ensure default admin always present
      for (const initU of initialAppUsers) {
        const found = usersList.find(u => u.username.toLowerCase() === initU.username.toLowerCase());
        if (!found) {
          usersList.push(initU);
        } else if (found.username.toLowerCase() === 'azazmadkiya' && (!found.email || found.email.includes('ncbltransport.com'))) {
          found.email = 'azazmadkiya@gmail.com';
          setDoc(doc(db, USERS_COL, found.id || 'user-azazmadkiya'), cleanForFirestore(found), { merge: true }).catch(() => {});
        }
      }

      saveLocalUserAccounts(usersList);
      callback(usersList);
    }, (err) => {
      console.warn('Users subscription fallback to local cache:', err);
      callback(getLocalUserAccounts());
    });
  } catch (err) {
    console.warn('Firestore query error for users:', err);
    callback(getLocalUserAccounts());
    return () => {};
  }
}

export async function saveUserAccount(user: AppUserAccount): Promise<void> {
  const currentUsers = getLocalUserAccounts();
  const existingIdx = currentUsers.findIndex(u => u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase());
  
  const updatedUser: AppUserAccount = {
    ...user,
    updatedAt: new Date().toISOString()
  };

  let updatedList: AppUserAccount[];
  if (existingIdx >= 0) {
    updatedList = [...currentUsers];
    updatedList[existingIdx] = updatedUser;
  } else {
    updatedList = [...currentUsers, updatedUser];
  }

  saveLocalUserAccounts(updatedList);

  try {
    await setDoc(doc(db, USERS_COL, user.id), cleanForFirestore(updatedUser), { merge: true });
  } catch (err) {
    console.warn('Firestore user save note (cached locally):', err);
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const currentUsers = getLocalUserAccounts();
  const filtered = currentUsers.filter(u => u.id !== userId);
  saveLocalUserAccounts(filtered);

  try {
    await deleteDoc(doc(db, USERS_COL, userId));
  } catch (err) {
    console.warn('Firestore user delete note:', err);
  }
}

/**
 * Changes a user's password with validation against current password if supplied.
 */
export async function changeUserPassword(
  usernameOrId: string,
  newPassword: string,
  currentPassword?: string
): Promise<{ success: boolean; message: string; user?: AppUserAccount }> {
  const cleanTarget = usernameOrId.trim().toLowerCase();
  const users = getLocalUserAccounts();
  
  const targetUser = users.find(u => 
    u.id.toLowerCase() === cleanTarget || 
    u.username.toLowerCase() === cleanTarget
  );

  if (!targetUser) {
    return {
      success: false,
      message: `User account "${usernameOrId}" was not found.`
    };
  }

  if (currentPassword !== undefined && currentPassword.trim() !== targetUser.password.trim()) {
    return {
      success: false,
      message: 'Current password does not match. Please verify and try again.'
    };
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return {
      success: false,
      message: 'New password must be at least 4 characters long.'
    };
  }

  const updatedUser: AppUserAccount = {
    ...targetUser,
    password: newPassword.trim(),
    updatedAt: new Date().toISOString()
  };

  await saveUserAccount(updatedUser);

  return {
    success: true,
    message: `Password for "${targetUser.displayName}" (${targetUser.username}) updated successfully!`,
    user: updatedUser
  };
}

