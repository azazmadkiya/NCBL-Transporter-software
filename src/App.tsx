import React, { useState, useEffect } from 'react';
import { 
  Invoice, Party, Vehicle, Expense, CompanySettings, UserProfile, UserRole, PaymentRecord, NoteReminder, AppUserAccount, ProductItem, StockTransaction 
} from './types';
import { 
  subscribeInvoices, subscribeParties, subscribeVehicles, subscribeExpenses, 
  subscribeCompanySettings, subscribeNotesReminders, subscribeUserAccounts, subscribeProducts, subscribeStockTransactions,
  saveInvoice, deleteInvoice, saveParty, deleteParty, saveVehicle, deleteVehicle,
  saveExpense, deleteExpense, saveNoteReminder, deleteNoteReminder, saveCompanySettings, addInvoicePayment, updateInvoicePayment, deleteInvoicePayment,
  saveProduct, deleteProduct, adjustProductStock, deleteStockTransaction, seedInitialFirestoreData 
} from './services/firestoreService';
import { initialCompanySettings, demoProfiles } from './data/mockInitialData';

import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { InvoicesList } from './components/InvoicesList';
import { InvoiceBuilder } from './components/InvoiceBuilder';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { PartyLedgerView } from './components/PartyLedgerView';
import { TruckLedgerView } from './components/TruckLedgerView';
import { PaymentTracker } from './components/PaymentTracker';
import { KasarLedgerView } from './components/KasarLedgerView';
import { TaxReportsView } from './components/TaxReportsView';
import { NotesRemindersView } from './components/NotesRemindersView';
import { DriverMobileView } from './components/DriverMobileView';
import { SettingsView } from './components/SettingsView';
import { PartyPresetsManager } from './components/PartyPresetsManager';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { PaymentOptionsModal } from './components/PaymentOptionsModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { StockProductsView } from './components/StockProductsView';
import { SalesBillsView } from './components/SalesBillsView';
import { SalesBillBuilder } from './components/SalesBillBuilder';
import { PurchaseBillBuilder } from './components/PurchaseBillBuilder';

export default function App() {
  // App initial loading splash screen
  const [showSplash, setShowSplash] = useState(true);

  // Current user & authentication state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('nirmala_logged_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Data states (synced with Firestore / mock fallback)
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [notesReminders, setNotesReminders] = useState<NoteReminder[]>([]);
  const [settings, setSettings] = useState<CompanySettings>(initialCompanySettings);
  const [appUsers, setAppUsers] = useState<AppUserAccount[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);

  // Modal & Selection states
  const [selectedPrintInvoice, setSelectedPrintInvoice] = useState<Invoice | null>(null);
  const [selectedEditInvoice, setSelectedEditInvoice] = useState<Invoice | null>(null);
  const [selectedEditSalesBill, setSelectedEditSalesBill] = useState<Invoice | null>(null);
  const [selectedSalesProduct, setSelectedSalesProduct] = useState<ProductItem | null>(null);
  const [selectedEditPurchaseBill, setSelectedEditPurchaseBill] = useState<Invoice | null>(null);
  const [selectedPurchaseProduct, setSelectedPurchaseProduct] = useState<ProductItem | null>(null);
  const [paymentOptionsInvoice, setPaymentOptionsInvoice] = useState<Invoice | null>(null);
  const [showChangePassModal, setShowChangePassModal] = useState(false);

  // Initialize Firestore listeners & seed initial data
  useEffect(() => {
    // Hide splash screen smoothly
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 250);

    seedInitialFirestoreData();

    const unsubInvoices = subscribeInvoices(setInvoices);
    const unsubParties = subscribeParties(setParties);
    const unsubVehicles = subscribeVehicles(setVehicles);
    const unsubExpenses = subscribeExpenses(setExpenses);
    const unsubNotes = subscribeNotesReminders(setNotesReminders);
    const unsubSettings = subscribeCompanySettings(setSettings);
    const unsubUsers = subscribeUserAccounts(setAppUsers);
    const unsubProducts = subscribeProducts(setProducts);
    const unsubStockTx = subscribeStockTransactions(setStockTransactions);

    return () => {
      unsubInvoices();
      unsubParties();
      unsubVehicles();
      unsubExpenses();
      unsubNotes();
      unsubSettings();
      unsubUsers();
      unsubProducts();
      unsubStockTx();
    };
  }, []);

  // Enforce driver mode if logged in as driver
  useEffect(() => {
    if (currentUser?.role === 'driver' && activeTab !== 'driver_mode' && activeTab !== 'notes_reminders') {
      setActiveTab('driver_mode');
    }
  }, [currentUser, activeTab]);

  // Handlers
  const handleSwitchRole = (role: UserRole) => {
    const matched = demoProfiles.find(p => p.role === role) || {
      uid: `user-${role}`,
      email: `${role}@ncbltransport.com`,
      displayName: `NCBL User (${role.toUpperCase()})`,
      role
    };
    setCurrentUser(matched);

    if (role === 'driver') {
      setActiveTab('driver_mode');
    }
  };

  const handleSaveInvoice = async (invoiceToSave: Invoice) => {
    await saveInvoice(invoiceToSave);
    setSelectedEditInvoice(null);
    setActiveTab('invoices');
  };

  // Product & Stock Handlers
  const handleSaveProduct = async (productToSave: ProductItem) => {
    await saveProduct(productToSave);
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
  };

  const handleAdjustStock = async (
    productId: string,
    deltaQty: number,
    transactionInfo: {
      productName: string;
      type: 'in' | 'out' | 'adjustment' | 'sales_bill';
      unit: string;
      rate?: number;
      referenceNo?: string;
      partyName?: string;
      date: string;
      notes?: string;
    }
  ) => {
    await adjustProductStock(productId, deltaQty, transactionInfo);
  };

  const handleDeleteStockTx = async (txId: string) => {
    await deleteStockTransaction(txId);
  };

  // Sales Bill Handlers (with stock inventory deduction and party ledger integration)
  const handleSaveSalesBill = async (
    bill: Invoice, 
    deductStock: boolean, 
    postToPartyLedger: boolean
  ) => {
    // 1. Save bill in Firestore invoices collection
    await saveInvoice(bill);

    // 2. Auto-deduct items from stock inventory if requested
    if (deductStock && bill.items && bill.items.length > 0) {
      for (const item of bill.items) {
        let matchedProd = products.find(p => p.id === item.productId);
        if (!matchedProd && item.description) {
          matchedProd = products.find(p => p.name.toLowerCase() === item.description.toLowerCase());
        }

        if (matchedProd && item.quantity > 0) {
          await adjustProductStock(matchedProd.id, -item.quantity, {
            productName: matchedProd.name,
            type: 'sales_bill',
            unit: item.unit || matchedProd.unit || 'Bags',
            rate: item.rate || matchedProd.salePrice || 0,
            referenceNo: bill.salesBillNumber || bill.invoiceNumber,
            partyName: bill.consignorName || bill.consigneeName,
            date: bill.salesBillDate || bill.invoiceDate,
            notes: `Deducted via Sales Bill #${bill.salesBillNumber || bill.invoiceNumber}`
          });
        }
      }
    }

    // 3. Ensure party exists and is saved
    if (postToPartyLedger && bill.consignorName) {
      const existingParty = parties.find(p => 
        (bill.partyId && p.id === bill.partyId) ||
        p.name.toLowerCase() === bill.consignorName.toLowerCase()
      );
      if (!existingParty) {
        const newParty: Party = {
          id: bill.partyId || `pty-${Date.now()}`,
          name: bill.consignorName,
          phone: '',
          gstin: bill.consignorGSTIN || '',
          address: bill.consignorAddress || '',
          state: bill.consignorState || 'Maharashtra',
          stateCode: bill.consignorStateCode || '27',
          city: 'Pune',
          partyType: 'sales_customer',
          accountCategory: 'party',
          accountGroup: 'sundry_debtors',
          openingBalance: 0,
          currentBalance: 0,
          createdAt: new Date().toISOString()
        };
        await saveParty(newParty);
      }
    }

    setSelectedEditSalesBill(null);
    setSelectedSalesProduct(null);
    setActiveTab('sales_bills');
  };

  // Purchase Bill Handlers (with stock inventory addition and vendor ledger integration)
  const handleSavePurchaseBill = async (
    bill: Invoice,
    addToStock: boolean,
    postToPartyLedger: boolean
  ) => {
    // 1. Save purchase bill in Firestore invoices collection
    await saveInvoice(bill);

    // 2. Auto-increase items in stock inventory if requested
    if (addToStock && bill.items && bill.items.length > 0) {
      for (const item of bill.items) {
        let matchedProd = products.find(p => p.id === item.productId);
        if (!matchedProd && item.description) {
          matchedProd = products.find(p => p.name.toLowerCase() === item.description.toLowerCase());
        }

        if (matchedProd && item.quantity > 0) {
          await adjustProductStock(matchedProd.id, item.quantity, {
            productName: matchedProd.name,
            type: 'purchase_bill',
            unit: item.unit || matchedProd.unit || 'Bags',
            rate: item.rate || matchedProd.purchasePrice || 0,
            referenceNo: bill.purchaseBillNumber || bill.supplierInvoiceNumber || bill.invoiceNumber,
            partyName: bill.consignorName || bill.consigneeName,
            date: bill.purchaseDate || bill.supplierInvoiceDate || bill.invoiceDate,
            notes: `Inward via Purchase Bill #${bill.purchaseBillNumber || bill.supplierInvoiceNumber}`
          });
        }
      }
    }

    // 3. Ensure vendor party exists and is saved
    if (postToPartyLedger && bill.consignorName) {
      const existingParty = parties.find(p => 
        (bill.partyId && p.id === bill.partyId) ||
        p.name.toLowerCase() === bill.consignorName.toLowerCase()
      );
      if (!existingParty) {
        const newParty: Party = {
          id: bill.partyId || `pty-vend-${Date.now()}`,
          name: bill.consignorName,
          phone: '',
          gstin: bill.consignorGSTIN || '',
          address: bill.consignorAddress || '',
          state: bill.consignorState || 'Maharashtra',
          stateCode: bill.consignorStateCode || '27',
          city: 'Pune',
          partyType: 'vendor',
          accountCategory: 'party',
          accountGroup: 'sundry_creditors',
          openingBalance: 0,
          currentBalance: 0,
          createdAt: new Date().toISOString()
        };
        await saveParty(newParty);
      }
    }

    setSelectedEditPurchaseBill(null);
    setSelectedPurchaseProduct(null);
    setActiveTab('sales_bills');
  };

  const handleImportInvoices = async (importedInvoices: Invoice[], mode: 'add' | 'overwrite') => {
    for (const inv of importedInvoices) {
      if (mode === 'overwrite') {
        const matched = invoices.find(existing => 
          (existing.invoiceNumber && inv.invoiceNumber && existing.invoiceNumber.toLowerCase() === inv.invoiceNumber.toLowerCase()) ||
          (existing.lrNumber && inv.lrNumber && existing.lrNumber.toLowerCase() === inv.lrNumber.toLowerCase())
        );
        if (matched) {
          inv.id = matched.id;
        }
      }
      await saveInvoice(inv);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      await deleteInvoice(invoiceId);
    }
  };

  const handleAddPayment = async (invoice: Invoice, payment: PaymentRecord) => {
    await addInvoicePayment(invoice, payment);
  };

  const handleUpdatePayment = async (invoice: Invoice, payment: PaymentRecord) => {
    await updateInvoicePayment(invoice, payment);
  };

  const handleDeletePayment = async (invoice: Invoice, paymentId: string, skipConfirm = false) => {
    if (skipConfirm || window.confirm('Are you sure you want to delete this payment voucher?')) {
      await deleteInvoicePayment(invoice, paymentId);
    }
  };

  const handleAddParty = async (party: Party) => {
    setParties(prev => [party, ...prev.filter(p => p.id !== party.id)]);
    await saveParty(party);
  };

  const handleEditParty = async (party: Party) => {
    setParties(prev => prev.map(p => p.id === party.id ? party : p));
    await saveParty(party);
  };

  const handleDeleteParty = async (partyId: string) => {
    setParties(prev => prev.filter(p => p.id !== partyId));
    await deleteParty(partyId);
  };

  const handleAddVehicle = async (vehicle: Vehicle) => {
    await saveVehicle(vehicle);
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (window.confirm('Are you sure you want to delete this vehicle record?')) {
      await deleteVehicle(vehicleId);
    }
  };

  const handleAddExpense = async (expense: Expense) => {
    await saveExpense(expense);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense voucher?')) {
      await deleteExpense(expenseId);
    }
  };

  const handleSaveSettings = async (updatedSettings: CompanySettings) => {
    await saveCompanySettings(updatedSettings);
  };

  const handleSaveNote = async (note: NoteReminder) => {
    await saveNoteReminder(note);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNoteReminder(noteId);
  };

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem('nirmala_logged_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('nirmala_logged_user');
  };

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center flex flex-col items-center border border-slate-200 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-56 h-auto mb-4">
            <img src="./logo.svg" alt="NCBL Transport" className="w-full h-full object-contain" />
          </div>
          <div className="text-slate-800 font-extrabold text-lg tracking-wide uppercase mt-1">NCBL Transport</div>
          <p className="text-slate-500 text-xs font-semibold mt-0.5 mb-6">Fleet Logistics & Tax Billing System</p>
          <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div className="h-full bg-blue-700 rounded-full animate-pulse w-3/4"></div>
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-3">Loading System...</span>
        </div>
      </div>
    );
  }

  // If not logged in, render the clean full-screen Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const currentRole = currentUser?.role || 'admin';

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white h-screen overflow-hidden">
      
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassModal(true)}
        onSwitchRole={handleSwitchRole}
        onNewInvoice={() => {
          setSelectedEditInvoice(null);
          setActiveTab('create_invoice');
        }}
        onToggleSidebarMobile={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        activeTab={activeTab}
      />

      {/* App Body with Sidebar */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto min-h-0 overflow-hidden">
        
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={currentRole}
          mobileOpen={mobileSidebarOpen}
          setMobileOpen={setMobileSidebarOpen}
        />

        {/* Main Workspace Area */}
        <main className="flex-1 p-3 sm:p-4 lg:p-5 overflow-y-auto w-full min-h-0">
          
          {activeTab === 'dashboard' && (
            <Dashboard
              invoices={invoices}
              vehicles={vehicles}
              parties={parties}
              userRole={currentRole}
              onNavigate={setActiveTab}
              onSelectInvoice={setSelectedPrintInvoice}
              onEditInvoice={(inv) => {
                setSelectedEditInvoice(inv);
                setActiveTab('create_invoice');
              }}
              onDeleteInvoice={handleDeleteInvoice}
            />
          )}

          {activeTab === 'sales_bills' && (
            <SalesBillsView
              invoices={invoices}
              parties={parties}
              settings={settings}
              userRole={currentRole}
              onNewSalesBill={() => {
                setSelectedEditSalesBill(null);
                setSelectedSalesProduct(null);
                setActiveTab('create_sales_bill');
              }}
              onNewPurchaseBill={() => {
                setSelectedEditPurchaseBill(null);
                setSelectedPurchaseProduct(null);
                setActiveTab('create_purchase_bill');
              }}
              onNewLiftingBill={() => {
                setSelectedEditInvoice(null);
                setActiveTab('create_invoice');
              }}
              onEditSalesBill={(bill) => {
                setSelectedEditSalesBill(bill);
                setActiveTab('create_sales_bill');
              }}
              onEditPurchaseBill={(bill) => {
                setSelectedEditPurchaseBill(bill);
                setActiveTab('create_purchase_bill');
              }}
              onEditLiftingBill={(bill) => {
                setSelectedEditInvoice(bill);
                setActiveTab('create_invoice');
              }}
              onDeleteBill={handleDeleteInvoice}
              onOpenPaymentModal={(bill) => {
                setPaymentOptionsInvoice(bill);
              }}
              onSaveInvoice={handleSaveInvoice}
            />
          )}

          {activeTab === 'create_sales_bill' && (
            <SalesBillBuilder
              initialBill={selectedEditSalesBill}
              preselectedProduct={selectedSalesProduct}
              parties={parties}
              products={products}
              vehicles={vehicles}
              settings={settings}
              onSave={handleSaveSalesBill}
              onAddParty={handleAddParty}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onCancel={() => {
                setSelectedEditSalesBill(null);
                setSelectedSalesProduct(null);
                setActiveTab('sales_bills');
              }}
            />
          )}

          {activeTab === 'create_purchase_bill' && (
            <PurchaseBillBuilder
              initialBill={selectedEditPurchaseBill}
              preselectedProduct={selectedPurchaseProduct}
              parties={parties}
              products={products}
              vehicles={vehicles}
              settings={settings}
              onSave={handleSavePurchaseBill}
              onAddParty={handleAddParty}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onCancel={() => {
                setSelectedEditPurchaseBill(null);
                setSelectedPurchaseProduct(null);
                setActiveTab('sales_bills');
              }}
            />
          )}

          {activeTab === 'stock_products' && (
            <StockProductsView
              products={products}
              transactions={stockTransactions}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onAdjustStock={handleAdjustStock}
              onDeleteTransaction={handleDeleteStockTx}
              onNavigateToSalesBill={(prod) => {
                setSelectedEditSalesBill(null);
                setSelectedSalesProduct(prod || null);
                setActiveTab('create_sales_bill');
              }}
              onNavigateToPurchaseBill={(prod) => {
                setSelectedEditPurchaseBill(null);
                setSelectedPurchaseProduct(prod || null);
                setActiveTab('create_purchase_bill');
              }}
              userRole={currentRole}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesList
              invoices={invoices}
              parties={parties}
              settings={settings}
              onNewInvoice={() => {
                setSelectedEditInvoice(null);
                setActiveTab('create_invoice');
              }}
              onSelectInvoice={setSelectedPrintInvoice}
              onEditInvoice={(inv) => {
                setSelectedEditInvoice(inv);
                setActiveTab('create_invoice');
              }}
              onDeleteInvoice={handleDeleteInvoice}
              onOpenPaymentModal={(inv) => {
                setPaymentOptionsInvoice(inv);
              }}
              onOpenPaymentOptions={(inv) => setPaymentOptionsInvoice(inv)}
              onImportInvoices={handleImportInvoices}
              userRole={currentRole}
            />
          )}

          {activeTab === 'create_invoice' && (
            <InvoiceBuilder
              initialInvoice={selectedEditInvoice}
              parties={parties}
              vehicles={vehicles}
              invoices={invoices}
              notesReminders={notesReminders}
              onSave={handleSaveInvoice}
              onAddParty={handleAddParty}
              onCancel={() => {
                setSelectedEditInvoice(null);
                setActiveTab('invoices');
              }}
            />
          )}

          {activeTab === 'party_presets' && (
            <PartyPresetsManager
              userRole={currentRole}
              parties={parties}
              onAddParty={handleAddParty}
              onEditParty={handleEditParty}
              onDeleteParty={handleDeleteParty}
              onUseInInvoice={(party, targetSection) => {
                const fullAddr = party.address ? (party.city ? `${party.address}, ${party.city}` : party.address) : party.city || '';
                if (targetSection === 'consignee') {
                  setSelectedEditInvoice({
                    id: '',
                    consigneeName: party.name,
                    consigneePartyUser: party.partyUser || '',
                    consigneeGSTIN: party.gstin || '',
                    consigneeAddress: fullAddr,
                    consigneeState: party.state || 'GUJARAT',
                    consigneeStateCode: party.stateCode || '24',
                  } as any);
                } else if (targetSection === 'shipto') {
                  setSelectedEditInvoice({
                    id: '',
                    shipToName: party.name,
                    shipToPartyUser: party.partyUser || '',
                    shipToGSTIN: party.gstin || '',
                    shipToAddress: fullAddr,
                    shipToState: party.state || 'GUJARAT',
                  } as any);
                } else if (targetSection === 'dispatched') {
                  setSelectedEditInvoice({
                    id: '',
                    dispatchedPartyName: party.name,
                    dispatchedPartyPartyUser: party.partyUser || '',
                    dispatchedPartyGSTIN: party.gstin || '',
                    dispatchedPartyAddress: fullAddr,
                    dispatchedPartyState: party.state || 'GUJARAT',
                  } as any);
                }
                setActiveTab('create_invoice');
              }}
            />
          )}

          {(activeTab === 'party_ledger_regular' || activeTab === 'party_ledger' || activeTab === 'parties') && (
            <PartyLedgerView
              userRole={currentRole}
              categoryFilter="party"
              parties={parties}
              invoices={invoices}
              settings={settings}
              onAddParty={handleAddParty}
              onEditParty={handleEditParty}
              onDeleteParty={handleDeleteParty}
              onRecordPaymentModal={() => setActiveTab('payments')}
              onAddPayment={handleAddPayment}
              onSaveInvoice={handleSaveInvoice}
              onEditInvoice={(inv) => {
                setSelectedEditInvoice(inv);
                setActiveTab('create_invoice');
              }}
              onDeleteInvoice={handleDeleteInvoice}
              onEditPayment={handleUpdatePayment}
              onDeletePayment={handleDeletePayment}
            />
          )}

          {activeTab === 'transporter_ledger' && (
            <PartyLedgerView
              userRole={currentRole}
              categoryFilter="transporter"
              parties={parties}
              invoices={invoices}
              settings={settings}
              onAddParty={handleAddParty}
              onEditParty={handleEditParty}
              onDeleteParty={handleDeleteParty}
              onRecordPaymentModal={() => setActiveTab('payments')}
              onAddPayment={handleAddPayment}
              onSaveInvoice={handleSaveInvoice}
              onCreateNewInvoice={(partyId) => {
                if (partyId) {
                  const pty = parties.find(p => p.id === partyId);
                  if (pty) {
                    setSelectedEditInvoice({
                      id: '',
                      partyId: pty.id,
                      consignorName: pty.name,
                      consignorGSTIN: pty.gstin || '',
                      consignorAddress: pty.address || '',
                      consignorState: pty.state || 'Maharashtra',
                      consignorStateCode: pty.stateCode || '27',
                      consigneeName: pty.name,
                      consigneeGSTIN: pty.gstin || '',
                      consigneeAddress: pty.address || '',
                      consigneeState: pty.state || 'Maharashtra',
                    } as any);
                    setActiveTab('create_invoice');
                    return;
                  }
                }
                setSelectedEditInvoice(null);
                setActiveTab('create_invoice');
              }}
              onEditInvoice={(inv) => {
                setSelectedEditInvoice(inv);
                setActiveTab('create_invoice');
              }}
              onDeleteInvoice={handleDeleteInvoice}
              onEditPayment={handleUpdatePayment}
              onDeletePayment={handleDeletePayment}
            />
          )}

          {activeTab === 'truck_ledger' && (
            <TruckLedgerView
              userRole={currentRole}
              vehicles={vehicles}
              expenses={expenses}
              invoices={invoices}
              onAddVehicle={handleAddVehicle}
              onEditVehicle={saveVehicle}
              onDeleteVehicle={handleDeleteVehicle}
              onAddExpense={handleAddExpense}
              onEditExpense={saveExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentTracker
              userRole={currentRole}
              invoices={invoices}
              parties={parties}
              settings={settings}
              onAddPayment={handleAddPayment}
              onUpdatePayment={handleUpdatePayment}
              onDeletePayment={handleDeletePayment}
              onOpenPaymentOptions={(inv) => setPaymentOptionsInvoice(inv)}
            />
          )}

          {activeTab === 'kasar_ledger' && (
            <KasarLedgerView
              userRole={currentRole}
              parties={parties}
              invoices={invoices}
              onNavigate={setActiveTab}
              onAddPayment={handleAddPayment}
              onEditInvoice={(inv) => {
                setSelectedEditInvoice(inv);
                setActiveTab('create_invoice');
              }}
            />
          )}

          {activeTab === 'tax_reports' && (
            <TaxReportsView
              userRole={currentRole}
              invoices={invoices}
              settings={settings}
            />
          )}

          {activeTab === 'notes_reminders' && (
            <NotesRemindersView
              userRole={currentRole}
              notes={notesReminders}
              parties={parties}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
              onNavigateToCreateInvoice={(orig, dest, bhada) => {
                setSelectedEditInvoice(null);
                setActiveTab('create_invoice');
              }}
            />
          )}

          {activeTab === 'driver_mode' && (
            <DriverMobileView
              vehicles={vehicles}
              invoices={invoices}
              expenses={expenses}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              currentUser={currentUser}
              userRole={currentRole}
              driverTruckNumber={currentUser?.truckNumber || vehicles[0]?.vehicleNumber || ''}
              driverName={currentUser?.driverName || currentUser?.displayName || 'Fleet Driver'}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              currentUser={currentUser}
              allUsers={appUsers}
              invoices={invoices}
              parties={parties}
              vehicles={vehicles}
              expenses={expenses}
            />
          )}

        </main>

      </div>

      {/* System Status Footer Bar */}
      <footer className="h-7 bg-slate-800 text-white flex items-center justify-between px-4 text-[10px] shrink-0 font-mono tracking-tight border-t border-slate-700">
        <div className="flex items-center space-x-4">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
            <span>SYSTEM READY: <strong className="text-green-400">ONLINE</strong></span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
            <span>FIRESTORE: <strong className="text-blue-300">LIVE SYNCED</strong></span>
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="opacity-70">NCBL TRANSPORT V3.2</span>
          <span className="text-blue-400 font-bold uppercase">{currentRole.toUpperCase()} SESSION</span>
        </div>
      </footer>

      {/* Change Password Modal */}
      {showChangePassModal && (
        <ChangePasswordModal
          isOpen={showChangePassModal}
          onClose={() => setShowChangePassModal(false)}
          currentUser={currentUser}
          allUsers={appUsers}
        />
      )}

      {/* Invoice Print & PDF Modal */}
      {selectedPrintInvoice && (
        <InvoicePrintModal
          invoice={selectedPrintInvoice}
          settings={settings}
          onClose={() => setSelectedPrintInvoice(null)}
        />
      )}

      {/* Payment Options & UPI QR Code Modal */}
      {paymentOptionsInvoice && (
        <PaymentOptionsModal
          invoice={paymentOptionsInvoice}
          settings={settings}
          onClose={() => setPaymentOptionsInvoice(null)}
          onRecordPayment={handleAddPayment}
        />
      )}

      {/* Auth & Role Switcher Modal */}
      {showAuthModal && (
        <AuthModal
          onLoginSuccess={(user) => setCurrentUser(user)}
          onClose={() => setShowAuthModal(false)}
        />
      )}

    </div>
  );
}
