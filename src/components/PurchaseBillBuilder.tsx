import React, { useState, useEffect, useMemo } from 'react';
import { 
  Invoice, Party, ProductItem, Vehicle, CompanySettings, TaxSlab, TaxType, InvoiceItem, 
  GSTSummaryItem, formatINR, INDIAN_STATES, PaymentMode 
} from '../types';
import { 
  ArrowDownLeft, Plus, Trash2, Save, Printer, ArrowLeft, Building2, 
  Boxes, Percent, Calculator, CheckCircle2, AlertCircle, RefreshCw, X, Truck, ShieldCheck,
  Edit2, Sparkles
} from 'lucide-react';
import { QuickProductModal } from './QuickProductModal';
import { autoDetectHsn } from '../data/hsnCodes';

interface PurchaseBillBuilderProps {
  initialBill?: Invoice | null;
  parties: Party[];
  products: ProductItem[];
  vehicles?: Vehicle[];
  settings: CompanySettings;
  preselectedProduct?: ProductItem | null;
  onSave: (bill: Invoice, addToStock: boolean, postToPartyLedger: boolean) => Promise<void>;
  onAddParty: (party: Party) => Promise<void>;
  onSaveProduct?: (product: ProductItem) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
  onCancel: () => void;
}

const GST_SLABS: TaxSlab[] = [0, 5, 12, 18, 28];

export const PurchaseBillBuilder: React.FC<PurchaseBillBuilderProps> = ({
  initialBill,
  parties,
  products,
  vehicles = [],
  settings,
  preselectedProduct,
  onSave,
  onAddParty,
  onSaveProduct,
  onDeleteProduct,
  onCancel
}) => {
  // Quick Product Modal (Add / Edit / Delete)
  const [showProductModal, setShowProductModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductItem | null>(null);
  const [targetRowForProduct, setTargetRowForProduct] = useState<string | null>(null);

  // Vendor / Supplier parties (exclude pure client parties if needed, or allow all)
  const vendorParties = useMemo(() => {
    return parties;
  }, [parties]);

  // Form State
  const [billNumber, setBillNumber] = useState<string>(() => {
    if (initialBill?.purchaseBillNumber) return initialBill.purchaseBillNumber;
    if (initialBill?.supplierInvoiceNumber) return initialBill.supplierInvoiceNumber;
    if (initialBill?.invoiceNumber) return initialBill.invoiceNumber;
    return `PUR-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;
  });

  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState<string>(() => {
    return initialBill?.supplierInvoiceNumber || initialBill?.purchaseBillNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`;
  });

  const [billDate, setBillDate] = useState<string>(() => {
    return initialBill?.purchaseDate || initialBill?.supplierInvoiceDate || initialBill?.invoiceDate || new Date().toISOString().split('T')[0];
  });

  const [dueDate, setDueDate] = useState<string>(() => {
    if (initialBill?.dueDate) return initialBill.dueDate;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Selected Vendor / Supplier
  const [selectedPartyId, setSelectedPartyId] = useState<string>(() => {
    return initialBill?.partyId || vendorParties[0]?.id || '';
  });

  const [vendorName, setVendorName] = useState(initialBill?.consignorName || '');
  const [vendorGSTIN, setVendorGSTIN] = useState(initialBill?.consignorGSTIN || '');
  const [vendorAddress, setVendorAddress] = useState(initialBill?.consignorAddress || '');
  const [vendorState, setVendorState] = useState(initialBill?.consignorState || 'Maharashtra');
  const [vendorStateCode, setVendorStateCode] = useState(initialBill?.consignorStateCode || '27');

  // Transport & vehicle info
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    if (initialBill?.vehicleNumber && vehicles.length > 0) {
      const match = vehicles.find(v => v.vehicleNumber.toLowerCase().replace(/\s+/g, '') === initialBill.vehicleNumber.toLowerCase().replace(/\s+/g, ''));
      return match ? match.id : '';
    }
    return '';
  });
  const [vehicleNumber, setVehicleNumber] = useState(initialBill?.vehicleNumber || '');
  const [lrNumber, setLrNumber] = useState(initialBill?.lrNumber || '');
  const [driverName, setDriverName] = useState(initialBill?.driverName || '');
  const [driverPhone, setDriverPhone] = useState(initialBill?.driverPhone || '');
  const [placeOfSupply, setPlaceOfSupply] = useState(initialBill?.consigneeState || settings.state || 'Maharashtra');

  // Handle vehicle selection from fleet dropdown
  const handleSelectVehicle = (vehId: string) => {
    setSelectedVehicleId(vehId);
    if (!vehId) return;
    const veh = vehicles.find(v => v.id === vehId);
    if (veh) {
      setVehicleNumber(veh.vehicleNumber);
      if (veh.driverName) setDriverName(veh.driverName);
      if (veh.driverPhone) setDriverPhone(veh.driverPhone);
    }
  };

  // Handle manual typing of vehicle number with auto-detection from fleet
  const handleVehicleNumberChange = (inputVal: string) => {
    const val = inputVal.toUpperCase();
    setVehicleNumber(val);
    const clean = val.replace(/[^A-Z0-9]/g, '');
    if (clean && vehicles.length > 0) {
      const match = vehicles.find(v => v.vehicleNumber.replace(/[^A-Z0-9]/g, '') === clean);
      if (match) {
        setSelectedVehicleId(match.id);
        if (!driverName && match.driverName) setDriverName(match.driverName);
        if (!driverPhone && match.driverPhone) setDriverPhone(match.driverPhone);
      } else {
        setSelectedVehicleId('');
      }
    } else {
      setSelectedVehicleId('');
    }
  };

  // Tax Type: intra_state (CGST+SGST) or inter_state (IGST)
  const isInterStateDefault = useMemo(() => {
    const compState = (settings.state || 'Maharashtra').toLowerCase().trim();
    const vendState = (vendorState || 'Maharashtra').toLowerCase().trim();
    return compState !== vendState;
  }, [settings.state, vendorState]);

  const [taxType, setTaxType] = useState<TaxType>(initialBill?.taxType || (isInterStateDefault ? 'inter_state' : 'intra_state'));

  useEffect(() => {
    if (!initialBill) {
      setTaxType(isInterStateDefault ? 'inter_state' : 'intra_state');
    }
  }, [isInterStateDefault, initialBill]);

  // Line items state
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    if (initialBill?.items && initialBill.items.length > 0) {
      return initialBill.items;
    }
    if (preselectedProduct) {
      const buyRate = preselectedProduct.purchasePrice || Math.round(preselectedProduct.salePrice * 0.85);
      return [{
        id: `item-${Date.now()}`,
        productId: preselectedProduct.id,
        description: preselectedProduct.name,
        hsnCode: preselectedProduct.hsnCode || '252329',
        quantity: 50,
        unit: preselectedProduct.unit || 'Bags',
        rate: buyRate,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 50 * buyRate,
        gstRate: preselectedProduct.gstRate || 18,
        amount: 50 * buyRate
      }];
    }
    return [
      {
        id: `item-${Date.now()}`,
        description: 'UltraTech OPC 50kg Cement (Raw Material)',
        hsnCode: '252329',
        quantity: 200,
        unit: 'Bags',
        rate: 310,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 62000,
        gstRate: 28,
        amount: 62000
      }
    ];
  });

  // Settings & Toggles
  const [addToStockInventory, setAddToStockInventory] = useState(true);
  const [postToPartyLedger, setPostToPartyLedger] = useState(true);
  const [initialPaymentMade, setInitialPaymentMade] = useState<number>(initialBill?.amountPaid || 0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('bank_neft');
  const [paymentRefNo, setPaymentRefNo] = useState('');
  const [notes, setNotes] = useState(initialBill?.remarks || 'Received in good condition and stock updated.');

  // Quick Add Party Modal
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyGSTIN, setNewPartyGSTIN] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyState, setNewPartyState] = useState('Maharashtra');

  // Party Selection Sync
  const handleSelectParty = (partyId: string) => {
    setSelectedPartyId(partyId);
    if (partyId === 'new_custom') {
      setShowAddPartyModal(true);
      return;
    }
    const found = parties.find(p => p.id === partyId);
    if (found) {
      setVendorName(found.name);
      setVendorGSTIN(found.gstin || '');
      setVendorAddress(found.address || '');
      setVendorState(found.state || 'Maharashtra');
      setVendorStateCode(found.stateCode || '27');
    }
  };

  // Populate vendor if party is present
  useEffect(() => {
    if (selectedPartyId && !initialBill) {
      const found = parties.find(p => p.id === selectedPartyId);
      if (found) {
        setVendorName(found.name);
        setVendorGSTIN(found.gstin || '');
        setVendorAddress(found.address || '');
        setVendorState(found.state || 'Maharashtra');
        setVendorStateCode(found.stateCode || '27');
      }
    }
  }, [selectedPartyId, parties, initialBill]);

  // Handle Quick Add Party
  const handleQuickAddParty = async () => {
    if (!newPartyName.trim()) {
      alert('Please enter Vendor / Supplier Name');
      return;
    }
    const stateObj = INDIAN_STATES.find(s => s.name.toLowerCase() === newPartyState.toLowerCase());
    const stateCode = stateObj?.code || '27';

    const newParty: Party = {
      id: `party-vend-${Date.now()}`,
      name: newPartyName.trim(),
      gstin: newPartyGSTIN.trim().toUpperCase(),
      phone: newPartyPhone.trim(),
      address: newPartyAddress.trim(),
      city: 'Pune',
      state: newPartyState,
      stateCode: stateCode,
      partyType: 'vendor',
      accountCategory: 'party',
      accountGroup: 'sundry_creditors',
      openingBalance: 0,
      currentBalance: 0,
      createdAt: new Date().toISOString()
    };

    await onAddParty(newParty);
    setSelectedPartyId(newParty.id);
    setVendorName(newParty.name);
    setVendorGSTIN(newParty.gstin || '');
    setVendorAddress(newParty.address || '');
    setVendorState(newParty.state || 'Maharashtra');
    setVendorStateCode(newParty.stateCode || '27');
    setShowAddPartyModal(false);
  };

  // Line Item Handlers
  const handleAddItem = () => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}`,
      description: '',
      hsnCode: '',
      quantity: 1,
      unit: 'Bags',
      rate: 0,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: 0,
      gstRate: 18,
      amount: 0
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      alert('A purchase invoice must have at least one line item.');
      return;
    }
    setItems(items.filter(it => it.id !== id));
  };

  // Open Product Modal to Add new Product
  const handleOpenAddProduct = (rowId?: string) => {
    setProductToEdit(null);
    setTargetRowForProduct(rowId !== undefined ? rowId : null);
    setShowProductModal(true);
  };

  // Open Product Modal to Edit existing Product
  const handleOpenEditProduct = (prod: ProductItem, rowId: string) => {
    setProductToEdit(prod);
    setTargetRowForProduct(rowId);
    setShowProductModal(true);
  };

  // Handle save from QuickProductModal
  const handleSaveProductFromModal = async (savedProd: ProductItem) => {
    if (onSaveProduct) {
      await onSaveProduct(savedProd);
    }
    // Update target row with new product details
    if (targetRowForProduct) {
      handleItemChange(targetRowForProduct, 'productId', savedProd.id);
    }
  };

  // Handle delete product from modal / inline
  const handleDeleteProductFromModal = async (productId: string) => {
    if (onDeleteProduct) {
      await onDeleteProduct(productId);
    }
    // Reset product selection in matching rows
    setItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, productId: undefined };
      }
      return item;
    }));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    // Intercept Add New Product from dropdown
    if (field === 'productId' && value === '__ADD_NEW_PRODUCT__') {
      handleOpenAddProduct(id);
      return;
    }

    setItems(prevItems => {
      return prevItems.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // If product was selected from catalog
        if (field === 'productId') {
          const matched = products.find(p => p.id === value);
          if (matched) {
            updated.productId = matched.id;
            updated.description = matched.name;
            updated.hsnCode = matched.hsnCode || updated.hsnCode;
            updated.unit = matched.unit || updated.unit;
            updated.rate = matched.purchasePrice || Math.round((matched.salePrice || 0) * 0.85) || updated.rate;
            updated.gstRate = matched.gstRate !== undefined ? matched.gstRate : updated.gstRate;
          } else if (!value) {
            updated.productId = undefined;
          }
        }

        // Auto-detect HSN & GST when typing item description
        if (field === 'description' && typeof value === 'string') {
          const matchedCatalogProd = products.find(p => p.name.toLowerCase() === value.toLowerCase().trim());
          if (matchedCatalogProd) {
            updated.productId = matchedCatalogProd.id;
            updated.hsnCode = matchedCatalogProd.hsnCode;
            updated.unit = matchedCatalogProd.unit;
            updated.rate = matchedCatalogProd.purchasePrice || Math.round((matchedCatalogProd.salePrice || 0) * 0.85) || updated.rate;
            updated.gstRate = matchedCatalogProd.gstRate;
          } else {
            const detected = autoDetectHsn(value);
            if (detected) {
              if (!updated.hsnCode || updated.hsnCode === '252329' || updated.hsnCode === '') {
                updated.hsnCode = detected.code;
              }
              if (updated.gstRate === undefined || updated.gstRate === 18) {
                updated.gstRate = detected.defaultGst;
              }
              if (!updated.unit || updated.unit === 'Bags') {
                updated.unit = detected.defaultUnit;
              }
            }
          }
        }

        // Calculations
        const qty = Number(updated.quantity) || 0;
        const rate = Number(updated.rate) || 0;
        const discPct = Number(updated.discountPercent) || 0;

        const gross = qty * rate;
        const discAmount = (gross * discPct) / 100;
        const taxable = Math.max(0, gross - discAmount);

        updated.discountAmount = discAmount;
        updated.taxableAmount = taxable;
        updated.amount = taxable;

        return updated;
      });
    });
  };

  // Grand Calculation
  const calculation = useMemo(() => {
    let subTotalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    const isInter = taxType === 'inter_state';

    const hsnMap = new Map<string, GSTSummaryItem>();

    items.forEach(item => {
      const taxable = item.taxableAmount || 0;
      const slab: TaxSlab = (item.gstRate !== undefined ? item.gstRate : 18) as TaxSlab;
      subTotalTaxable += taxable;

      const key = `${item.hsnCode || 'HSN'}_${slab}`;
      if (!hsnMap.has(key)) {
        hsnMap.set(key, {
          hsnCode: item.hsnCode || '—',
          gstRate: slab,
          taxableValue: 0,
          cgstRate: isInter ? 0 : slab / 2,
          cgstAmount: 0,
          sgstRate: isInter ? 0 : slab / 2,
          sgstAmount: 0,
          igstRate: isInter ? slab : 0,
          igstAmount: 0,
          totalTax: 0
        });
      }

      const entry = hsnMap.get(key)!;
      entry.taxableValue += taxable;

      if (isInter) {
        const tax = (taxable * slab) / 100;
        totalIGST += tax;
        entry.igstAmount += tax;
        entry.totalTax += tax;
      } else {
        const halfTax = (taxable * (slab / 2)) / 100;
        totalCGST += halfTax;
        totalSGST += halfTax;
        entry.cgstAmount += halfTax;
        entry.sgstAmount += halfTax;
        entry.totalTax += halfTax * 2;
      }
    });

    const totalTax = totalCGST + totalSGST + totalIGST;
    const exactTotal = subTotalTaxable + totalTax;
    const roundedGrandTotal = Math.round(exactTotal);
    const roundOff = Number((roundedGrandTotal - exactTotal).toFixed(2));

    const paid = Number(initialPaymentMade) || 0;
    const balanceDue = Math.max(0, roundedGrandTotal - paid);

    let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (paid >= roundedGrandTotal && roundedGrandTotal > 0) {
      paymentStatus = 'paid';
    } else if (paid > 0) {
      paymentStatus = 'partial';
    }

    return {
      subTotalTaxable,
      totalCGST,
      totalSGST,
      totalIGST,
      totalTax,
      roundOff,
      grandTotal: roundedGrandTotal,
      paid,
      balanceDue,
      paymentStatus,
      hsnSummaries: Array.from(hsnMap.values())
    };
  }, [items, taxType, initialPaymentMade]);

  // Handle Save
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorName.trim()) {
      alert('Please select or specify Vendor / Supplier Name');
      return;
    }

    if (items.length === 0 || items.some(i => !i.description.trim() || i.quantity <= 0)) {
      alert('Please ensure all items have a valid description and positive quantity.');
      return;
    }

    setIsSaving(true);
    try {
      const invoiceData: Invoice = {
        id: initialBill?.id || `pur-${Date.now()}`,
        invoiceNumber: billNumber.trim(),
        purchaseBillNumber: billNumber.trim(),
        supplierInvoiceNumber: supplierInvoiceNo.trim(),
        supplierInvoiceDate: billDate,
        purchaseDate: billDate,
        invoiceDate: billDate,
        dueDate: dueDate,
        invoiceType: 'tax_invoice',
        billCategory: 'purchase',
        ledgerImpact: 'credit', // Credit vendor balance (Payable)
        lrNumber: lrNumber.trim() || supplierInvoiceNo.trim(),
        lrDate: billDate,
        
        // Vendor / Supplier details (Consignor)
        partyId: selectedPartyId || `vend-${Date.now()}`,
        consignorName: vendorName.trim(),
        consignorGSTIN: vendorGSTIN.trim().toUpperCase(),
        consignorAddress: vendorAddress.trim(),
        consignorState: vendorState,
        consignorStateCode: vendorStateCode,

        // Purchaser / Buyer details (NCBL Transport / Consignee)
        consigneeName: settings.companyName || 'NCBL Transport',
        consigneeGSTIN: settings.gstin || settings.gstNumber || '27AABCU9603R1ZM',
        consigneeAddress: settings.address || '',
        consigneeState: settings.state || 'Maharashtra',

        // Transport details
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        origin: vendorAddress || vendorState,
        destination: settings.city || 'Pune',
        materialType: items.map(i => i.description).join(', ').substring(0, 80),

        // Items and taxes
        items: items.map(item => ({
          ...item,
          cgstRate: taxType === 'intra_state' ? (item.gstRate || 0) / 2 : 0,
          cgstAmount: taxType === 'intra_state' ? ((item.taxableAmount || 0) * (item.gstRate || 0) / 2) / 100 : 0,
          sgstRate: taxType === 'intra_state' ? (item.gstRate || 0) / 2 : 0,
          sgstAmount: taxType === 'intra_state' ? ((item.taxableAmount || 0) * (item.gstRate || 0) / 2) / 100 : 0,
          igstRate: taxType === 'inter_state' ? (item.gstRate || 0) : 0,
          igstAmount: taxType === 'inter_state' ? ((item.taxableAmount || 0) * (item.gstRate || 0)) / 100 : 0,
        })),
        grossFreight: 0,
        loadingCharges: 0,
        unloadingCharges: 0,
        detentionCharges: 0,
        otherCharges: 0,
        subTotal: calculation.subTotalTaxable,
        taxType: taxType,
        taxSlab: items[0]?.gstRate || 18,
        taxMechanism: 'forward_charge',
        cgstRate: taxType === 'intra_state' ? (items[0]?.gstRate ? items[0].gstRate / 2 : 9) : 0,
        sgstRate: taxType === 'intra_state' ? (items[0]?.gstRate ? items[0].gstRate / 2 : 9) : 0,
        igstRate: taxType === 'inter_state' ? (items[0]?.gstRate || 18) : 0,
        cgstAmount: calculation.totalCGST,
        sgstAmount: calculation.totalSGST,
        igstAmount: calculation.totalIGST,
        totalTax: calculation.totalTax,
        roundOff: calculation.roundOff,
        grandTotal: calculation.grandTotal,
        advancePaid: calculation.paid,
        fuelDeduction: 0,
        otherDeductions: 0,
        kasarDeduction: 0,
        netPayable: calculation.grandTotal,
        amountPaid: calculation.paid,
        balanceDue: calculation.balanceDue,
        paymentStatus: calculation.paymentStatus,
        payments: calculation.paid > 0 ? [
          {
            id: `pay-${Date.now()}`,
            date: billDate,
            amount: calculation.paid,
            mode: paymentMode,
            referenceNo: paymentRefNo || supplierInvoiceNo || 'Purchase Advance',
            recordedBy: 'Admin',
            notes: 'Recorded on purchase invoice entry'
          }
        ] : [],
        notes: notes,
        createdAt: initialBill?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(invoiceData, addToStockInventory, postToPartyLedger);
    } catch (err) {
      console.error('Error saving purchase bill:', err);
      alert('Failed to save purchase tax invoice. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
              <span>{initialBill ? 'Edit Purchase Tax Invoice' : 'Create GST Purchase Tax Invoice (Inward)'}</span>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                Stock Inward (+)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Record supplier inward tax bills with HSN/GST breakdown, auto-increase product inventory, and post to Vendor Ledger.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving Inward Bill...' : 'Save Purchase Bill'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Section 1: Bill Reference & Dates */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>1. Inward Invoice & Supplier Reference</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Purchase Entry No (Internal) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Purchase Entry No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={billNumber}
                onChange={e => setBillNumber(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                placeholder="PUR-2026-001"
              />
            </div>

            {/* Supplier Bill / Invoice No */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier Bill / Invoice No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={supplierInvoiceNo}
                onChange={e => setSupplierInvoiceNo(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                placeholder="INV-98214"
              />
            </div>

            {/* Invoice Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Bill Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={billDate}
                onChange={e => setBillDate(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Vendor / Supplier Details & Tax Mechanism */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>2. Supplier / Vendor Details</span>
            </h3>

            <div className="flex items-center space-x-2">
              <label className="text-xs font-medium text-slate-600">Select Existing Vendor:</label>
              <select
                value={selectedPartyId}
                onChange={e => handleSelectParty(e.target.value)}
                className="text-xs px-2.5 py-1 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                <option value="">-- Choose Vendor / Supplier --</option>
                {vendorParties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.gstin ? `(${p.gstin})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowAddPartyModal(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Quick Add Vendor</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Vendor Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                required
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium"
                placeholder="e.g. UltraTech Cement Limited"
              />
            </div>

            {/* Vendor GSTIN */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier GSTIN
              </label>
              <input
                type="text"
                value={vendorGSTIN}
                onChange={e => setVendorGSTIN(e.target.value.toUpperCase())}
                maxLength={15}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 uppercase font-mono"
                placeholder="27AAACU1234F1Z1"
              />
            </div>

            {/* Vendor State */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier State
              </label>
              <select
                value={vendorState}
                onChange={e => {
                  const stateName = e.target.value;
                  setVendorState(stateName);
                  const st = INDIAN_STATES.find(s => s.name === stateName);
                  if (st) setVendorStateCode(st.code);
                }}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
              >
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.name}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tax Mechanism */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                GST Tax Mechanism
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setTaxType('intra_state')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                    taxType === 'intra_state'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  CGST + SGST
                </button>
                <button
                  type="button"
                  onClick={() => setTaxType('inter_state')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                    taxType === 'inter_state'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  IGST (Inter-State)
                </button>
              </div>
            </div>

            {/* Vendor Address */}
            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier Address & City
              </label>
              <input
                type="text"
                value={vendorAddress}
                onChange={e => setVendorAddress(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                placeholder="Plot No. 45, MIDC Industrial Area, Pune 411019"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Transport & Vehicle Information */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              <span>3. Inward Transport & Delivery Logistics (Optional)</span>
            </h3>

            {vehicles && vehicles.length > 0 && (
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-600 font-bold hidden sm:inline">Select Fleet Vehicle:</span>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => handleSelectVehicle(e.target.value)}
                  className="bg-emerald-50/80 border border-emerald-300 text-emerald-900 rounded px-2.5 py-1 text-xs font-bold focus:ring-1 focus:ring-emerald-600 focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- Choose Fleet Truck --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} {v.driverName ? `(${v.driverName})` : ''} {v.vehicleType ? `[${v.vehicleType}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vehicle / Truck Number
              </label>
              <input
                type="text"
                list="purchase-fleet-vehicles-list"
                value={vehicleNumber}
                onChange={e => handleVehicleNumberChange(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 uppercase font-mono font-bold"
                placeholder="e.g. MH12AB1234"
              />
              <datalist id="purchase-fleet-vehicles-list">
                {vehicles.map(v => (
                  <option key={v.id} value={v.vehicleNumber}>
                    {v.driverName} {v.driverPhone ? `- ${v.driverPhone}` : ''} {v.vehicleType ? `(${v.vehicleType})` : ''}
                  </option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-Way Bill / LR No
              </label>
              <input
                type="text"
                value={lrNumber}
                onChange={e => setLrNumber(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-mono"
                placeholder="EWB-89123019"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Driver Name
              </label>
              <input
                type="text"
                value={driverName}
                onChange={e => setDriverName(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                placeholder="Driver Name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Driver Mobile
              </label>
              <input
                type="tel"
                value={driverPhone}
                onChange={e => setDriverPhone(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                placeholder="9876543210"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Line Items (Product & Stock Entry) */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>4. Inward Materials / Product Line Items</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Select from Stock Catalog or type description. Quantities entered here will be added to product stock inventory.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item Row</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-2 w-10 text-center">#</th>
                  <th className="py-2.5 px-2 min-w-[200px]">Product / Item Description</th>
                  <th className="py-2.5 px-2 w-24 text-center">HSN/SAC</th>
                  <th className="py-2.5 px-2 w-24 text-right">Inward Qty</th>
                  <th className="py-2.5 px-2 w-24 text-center">Unit</th>
                  <th className="py-2.5 px-2 w-28 text-right">Buy Rate (₹)</th>
                  <th className="py-2.5 px-2 w-20 text-right">Disc %</th>
                  <th className="py-2.5 px-2 w-28 text-right">Taxable Val</th>
                  <th className="py-2.5 px-2 w-24 text-center">GST %</th>
                  <th className="py-2.5 px-2 w-28 text-right">Total (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, index) => {
                  const matchedProduct = products.find(p => p.id === item.productId || (item.description && p.name.toLowerCase() === item.description.toLowerCase().trim()));
                  const itemTaxable = item.taxableAmount || 0;
                  const itemGst = item.gstRate || 0;
                  const itemTotalTax = (itemTaxable * itemGst) / 100;
                  const itemTotal = itemTaxable + itemTotalTax;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-2 text-center text-slate-500 font-medium">
                        {index + 1}
                      </td>

                      {/* Product Selector / Text */}
                      <td className="py-2 px-2">
                        <div className="space-y-1.5">
                          {/* Product Dropdown & Inline Quick Actions */}
                          <div className="flex items-center space-x-1">
                            <select
                              value={item.productId || ''}
                              onChange={e => handleItemChange(item.id, 'productId', e.target.value)}
                              className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 bg-slate-50 text-slate-800 font-semibold"
                            >
                              <option value="">-- Choose Stock Product (Auto-fills HSN & Rate) --</option>
                              <option value="__ADD_NEW_PRODUCT__" className="font-bold text-emerald-700 bg-emerald-50">
                                ➕ + Add New Product to Catalog...
                              </option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (HSN: {p.hsnCode} | Stock: {p.currentStock} {p.unit} | Buy: ₹{p.purchasePrice || 0})
                                </option>
                              ))}
                            </select>

                            {/* Quick Add Product Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenAddProduct(item.id)}
                              className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 transition-colors shrink-0"
                              title="Add New Product to Catalog"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {/* Quick Edit Product Button (active when matched or selected) */}
                            {matchedProduct && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditProduct(matchedProduct, item.id)}
                                className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition-colors shrink-0"
                                title={`Modify "${matchedProduct.name}" in Catalog`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Quick Delete Product Button */}
                            {matchedProduct && onDeleteProduct && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete product "${matchedProduct.name}" from catalog?`)) {
                                    handleDeleteProductFromModal(matchedProduct.id);
                                  }
                                }}
                                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition-colors shrink-0"
                                title={`Delete "${matchedProduct.name}" from Catalog`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="relative">
                            <input
                              type="text"
                              value={item.description}
                              onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                              required
                              placeholder="Item name / raw material description"
                              className="w-full text-xs px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-medium"
                            />
                          </div>

                          {/* Product stock & Auto HSN indicator */}
                          <div className="flex items-center justify-between text-[10px]">
                            {matchedProduct ? (
                              <div className="text-slate-500 font-medium">
                                Current Stock: <strong className="text-emerald-700">{matchedProduct.currentStock} {matchedProduct.unit}</strong>
                                <span className="ml-1.5 text-slate-400">| Standard GST: {matchedProduct.gstRate}%</span>
                              </div>
                            ) : (
                              <div className="text-slate-400 italic">
                                Custom Item (Not linked to stock)
                              </div>
                            )}

                            {/* Auto HSN Detection Pill */}
                            {(() => {
                              const autoHsn = autoDetectHsn(item.description);
                              if (autoHsn && item.hsnCode !== autoHsn.code) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleItemChange(item.id, 'hsnCode', autoHsn.code);
                                      handleItemChange(item.id, 'gstRate', autoHsn.defaultGst);
                                      if (!item.unit || item.unit === 'Bags') {
                                        handleItemChange(item.id, 'unit', autoHsn.defaultUnit);
                                      }
                                    }}
                                    className="inline-flex items-center space-x-0.5 text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded font-bold border border-emerald-200"
                                    title="Click to apply suggested HSN & GST %"
                                  >
                                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>Apply HSN {autoHsn.code} ({autoHsn.defaultGst}%)</span>
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </td>

                      {/* HSN */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={item.hsnCode || ''}
                          onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)}
                          placeholder="252329"
                          className="w-full text-xs px-1.5 py-1 border border-slate-300 rounded text-center font-mono"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          required
                          className="w-full text-xs px-1.5 py-1 border border-slate-300 rounded text-right font-bold text-emerald-800"
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={item.unit || 'Bags'}
                          onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                          className="w-full text-xs px-1.5 py-1 border border-slate-300 rounded text-center"
                          placeholder="Bags"
                        />
                      </td>

                      {/* Rate */}
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate || 0}
                          onChange={e => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          required
                          className="w-full text-xs px-1.5 py-1 border border-slate-300 rounded text-right font-mono"
                        />
                      </td>

                      {/* Discount % */}
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.discountPercent || 0}
                          onChange={e => handleItemChange(item.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className="w-full text-xs px-1.5 py-1 border border-slate-300 rounded text-right"
                        />
                      </td>

                      {/* Taxable Amount */}
                      <td className="py-2 px-2 text-right font-mono font-semibold text-slate-800">
                        {formatINR(itemTaxable)}
                      </td>

                      {/* GST Slab */}
                      <td className="py-2 px-2">
                        <select
                          value={item.gstRate !== undefined ? item.gstRate : 18}
                          onChange={e => handleItemChange(item.id, 'gstRate', parseInt(e.target.value) as TaxSlab)}
                          className="w-full text-xs px-1 py-1 border border-slate-300 rounded text-center font-medium"
                        >
                          {GST_SLABS.map(slab => (
                            <option key={slab} value={slab}>
                              {slab}%
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Total */}
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                        {formatINR(itemTotal)}
                      </td>

                      {/* Delete Action */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 5: GST Calculation, Settlement & Ledger Sync */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left Column: Inventory & Ledger Automation Flags (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Boxes className="w-4 h-4 text-emerald-600" />
              <span>5. Inventory & Accounting Automation</span>
            </h3>

            <div className="space-y-3 bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg">
              {/* Add to stock checkbox */}
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addToStockInventory}
                  onChange={e => setAddToStockInventory(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Auto-Add Quantities to Stock Inventory (Stock In (+))
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Increases stock quantity for each matched catalog item and logs a "PURCHASE BILL (+)" transaction in the Stock Ledger.
                  </div>
                </div>
              </label>

              {/* Post to Party Ledger checkbox */}
              <label className="flex items-start space-x-2.5 cursor-pointer pt-2 border-t border-emerald-100">
                <input
                  type="checkbox"
                  checked={postToPartyLedger}
                  onChange={e => setPostToPartyLedger(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Post to Vendor Ledger (Sundry Creditors)
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Credits the supplier account balance so bills and pending dues appear in the Party / Vendor statement.
                  </div>
                </div>
              </label>
            </div>

            {/* Initial Payment / Settlement */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Vendor Payment / Advance Paid on Entry:</span>
                <span className="text-emerald-700 font-mono font-bold">
                  {calculation.paymentStatus.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">Amount Paid (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={initialPaymentMade}
                    onChange={e => setInitialPaymentMade(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded font-mono font-bold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
                  >
                    <option value="bank_neft">Bank NEFT / RTGS</option>
                    <option value="upi">UPI / Online</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-0.5 font-medium">Transaction / Cheque Ref</label>
                  <input
                    type="text"
                    value={paymentRefNo}
                    onChange={e => setPaymentRefNo(e.target.value)}
                    className="w-full text-xs px-2 py-1 border border-slate-300 rounded font-mono"
                    placeholder="UTR / Chq No"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Notes / Remarks
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                placeholder="Add goods receipt verification remarks, batch numbers, or terms..."
              />
            </div>
          </div>

          {/* Right Column: Financial Summary Card (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
              GST Calculation & Net Payable
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount:</span>
                <span className="font-mono font-semibold text-slate-900">{formatINR(calculation.subTotalTaxable)}</span>
              </div>

              {taxType === 'intra_state' ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Central Tax (CGST):</span>
                    <span className="font-mono font-semibold text-slate-900">{formatINR(calculation.totalCGST)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>State Tax (SGST):</span>
                    <span className="font-mono font-semibold text-slate-900">{formatINR(calculation.totalSGST)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>Integrated Tax (IGST):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatINR(calculation.totalIGST)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-1.5">
                <span>Total GST (Input Tax Credit):</span>
                <span className="font-mono font-semibold text-emerald-700">{formatINR(calculation.totalTax)}</span>
              </div>

              {calculation.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round Off:</span>
                  <span className="font-mono">{calculation.roundOff > 0 ? `+${calculation.roundOff}` : calculation.roundOff}</span>
                </div>
              )}

              <div className="pt-2 border-t-2 border-slate-800 flex justify-between items-center text-slate-900 font-bold">
                <span className="text-sm">Grand Total (₹):</span>
                <span className="text-base font-mono text-emerald-800">{formatINR(calculation.grandTotal)}</span>
              </div>

              <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-600 text-xs">
                  <span>Paid to Vendor:</span>
                  <span className="font-mono font-semibold text-emerald-600">{formatINR(calculation.paid)}</span>
                </div>
                <div className="flex justify-between text-slate-900 text-xs font-bold">
                  <span>Balance Payable:</span>
                  <span className="font-mono text-amber-700">{formatINR(calculation.balanceDue)}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Purchase Bill'}</span>
              </button>
            </div>

          </div>

        </div>

      </form>

      {/* Quick Add Party Modal */}
      {showAddPartyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Quick Add New Vendor / Supplier</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPartyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vendor / Supplier Name *</label>
                <input
                  type="text"
                  value={newPartyName}
                  onChange={e => setNewPartyName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 font-medium"
                  placeholder="e.g. Ambuja Cements Ltd."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier GSTIN (15 Digits)</label>
                <input
                  type="text"
                  value={newPartyGSTIN}
                  onChange={e => setNewPartyGSTIN(e.target.value.toUpperCase())}
                  maxLength={15}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500 uppercase font-mono"
                  placeholder="27AAACA1234A1Z5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone / Mobile</label>
                  <input
                    type="text"
                    value={newPartyPhone}
                    onChange={e => setNewPartyPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                    placeholder="9823000000"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <select
                    value={newPartyState}
                    onChange={e => setNewPartyState(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s.code} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={newPartyAddress}
                  onChange={e => setNewPartyAddress(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                  placeholder="Supplier Address, Area, City"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddPartyModal(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAddParty}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 shadow-xs"
              >
                Save & Select Vendor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Product Modal (Add, Modify, Delete) */}
      {showProductModal && (
        <QuickProductModal
          initialProduct={productToEdit}
          onSave={handleSaveProductFromModal}
          onDelete={handleDeleteProductFromModal}
          onClose={() => {
            setShowProductModal(false);
            setProductToEdit(null);
            setTargetRowForProduct(null);
          }}
        />
      )}

    </div>
  );
};
