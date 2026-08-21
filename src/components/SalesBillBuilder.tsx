import React, { useState, useEffect, useMemo } from 'react';
import { 
  Invoice, Party, ProductItem, Vehicle, CompanySettings, TaxSlab, TaxType, InvoiceItem, 
  GSTSummaryItem, formatINR, INDIAN_STATES 
} from '../types';
import { 
  Receipt, Plus, Trash2, Save, Printer, ArrowLeft, Building2, 
  Boxes, Percent, Calculator, CheckCircle2, AlertCircle, RefreshCw, X,
  Edit2, Sparkles, Truck
} from 'lucide-react';
import { QuickProductModal } from './QuickProductModal';
import { autoDetectHsn } from '../data/hsnCodes';

interface SalesBillBuilderProps {
  initialBill?: Invoice | null;
  parties: Party[];
  products: ProductItem[];
  vehicles?: Vehicle[];
  settings: CompanySettings;
  preselectedProduct?: ProductItem | null;
  onSave: (bill: Invoice, deductStock: boolean, postToPartyLedger: boolean) => Promise<void>;
  onAddParty: (party: Party) => Promise<void>;
  onSaveProduct?: (product: ProductItem) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
  onCancel: () => void;
}

const GST_SLABS: TaxSlab[] = [0, 5, 12, 18, 28];

export const SalesBillBuilder: React.FC<SalesBillBuilderProps> = ({
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
  // Only regular party / sales customer accounts (excluding transporters)
  const salesParties = useMemo(() => {
    return parties.filter(p => p.accountCategory !== 'transporter' && p.partyType !== 'transporter');
  }, [parties]);

  // Form State
  const [billNumber, setBillNumber] = useState<string>(() => {
    if (initialBill?.salesBillNumber) return initialBill.salesBillNumber;
    if (initialBill?.invoiceNumber) return initialBill.invoiceNumber;
    return `SB-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`;
  });

  const [billDate, setBillDate] = useState<string>(() => {
    return initialBill?.salesBillDate || initialBill?.invoiceDate || new Date().toISOString().split('T')[0];
  });

  const [dueDate, setDueDate] = useState<string>(() => {
    if (initialBill?.dueDate) return initialBill.dueDate;
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  // Selected Party / Customer
  const [selectedPartyId, setSelectedPartyId] = useState<string>(() => {
    return initialBill?.partyId || salesParties[0]?.id || '';
  });

  const [customerName, setCustomerName] = useState(initialBill?.consignorName || '');
  const [customerGSTIN, setCustomerGSTIN] = useState(initialBill?.consignorGSTIN || '');
  const [customerAddress, setCustomerAddress] = useState(initialBill?.consignorAddress || '');
  const [customerState, setCustomerState] = useState(initialBill?.consignorState || 'Maharashtra');
  const [customerStateCode, setCustomerStateCode] = useState(initialBill?.consignorStateCode || '27');

  // Shipping details
  const [shipToSameAsBilling, setShipToSameAsBilling] = useState(true);
  const [shipToName, setShipToName] = useState(initialBill?.shipToName || '');
  const [shipToAddress, setShipToAddress] = useState(initialBill?.shipToAddress || '');
  const [shipToGSTIN, setShipToGSTIN] = useState(initialBill?.shipToGSTIN || '');
  const [shipToState, setShipToState] = useState(initialBill?.shipToState || 'Maharashtra');

  // Transport & dispatch info
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    if (initialBill?.vehicleNumber && vehicles.length > 0) {
      const match = vehicles.find(v => v.vehicleNumber.toLowerCase().replace(/\s+/g, '') === initialBill.vehicleNumber.toLowerCase().replace(/\s+/g, ''));
      return match ? match.id : '';
    }
    return '';
  });
  const [vehicleNumber, setVehicleNumber] = useState(initialBill?.vehicleNumber || '');
  const [eWayBillNumber, setEWayBillNumber] = useState(initialBill?.lrNumber || '');
  const [poNumber, setPoNumber] = useState(initialBill?.purchaseBillNumber || '');
  const [driverName, setDriverName] = useState(initialBill?.driverName || '');
  const [driverPhone, setDriverPhone] = useState(initialBill?.driverPhone || '');
  const [placeOfSupply, setPlaceOfSupply] = useState(initialBill?.consignorState || 'Maharashtra');

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
    const custState = (customerState || 'Maharashtra').toLowerCase().trim();
    return compState !== custState;
  }, [settings.state, customerState]);

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
      return [{
        id: `item-${Date.now()}`,
        productId: preselectedProduct.id,
        description: preselectedProduct.name,
        hsnCode: preselectedProduct.hsnCode || '252329',
        quantity: 10,
        unit: preselectedProduct.unit || 'Bags',
        rate: preselectedProduct.salePrice || 350,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 10 * (preselectedProduct.salePrice || 350),
        gstRate: preselectedProduct.gstRate !== undefined ? preselectedProduct.gstRate : 18,
        amount: 10 * (preselectedProduct.salePrice || 350)
      }];
    }
    return [
      {
        id: `item-${Date.now()}`,
        description: 'UltraTech Cement 50kg OPC',
        hsnCode: '252329',
        quantity: 100,
        unit: 'Bags',
        rate: 380,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 38000,
        gstRate: 28,
        amount: 38000
      }
    ];
  });

  // Additional charges & payments
  const [freightCharges, setFreightCharges] = useState<number>(initialBill?.loadingCharges || 0);
  const [otherCharges, setOtherCharges] = useState<number>(initialBill?.otherCharges || 0);
  const [advancePaid, setAdvancePaid] = useState<number>(initialBill?.amountPaid || initialBill?.advancePaid || 0);
  const [kasarDiscount, setKasarDiscount] = useState<number>(initialBill?.kasarDeduction || 0);
  const [notes, setNotes] = useState(initialBill?.notes || '');

  // Options
  const [deductStock, setDeductStock] = useState<boolean>(true);
  const [postToPartyLedger, setPostToPartyLedger] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick New Party Modal
  const [showNewPartyModal, setShowNewPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyGstin, setNewPartyGstin] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyCity, setNewPartyCity] = useState('');
  const [newPartyState, setNewPartyState] = useState('Maharashtra');
  const [newPartyStateCode, setNewPartyStateCode] = useState('27');

  // Quick Product Modal (Add / Edit / Delete)
  const [showProductModal, setShowProductModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState<ProductItem | null>(null);
  const [targetRowForProduct, setTargetRowForProduct] = useState<number | null>(null);

  // When selected party changes, auto-fill party details
  const handleSelectParty = (partyId: string) => {
    setSelectedPartyId(partyId);
    const pty = salesParties.find(p => p.id === partyId);
    if (pty) {
      setCustomerName(pty.name);
      setCustomerGSTIN(pty.gstin || '');
      setCustomerAddress(pty.address || (pty.city ? `${pty.city}, ${pty.state}` : ''));
      setCustomerState(pty.state || 'Maharashtra');
      setCustomerStateCode(pty.stateCode || '27');
      setPlaceOfSupply(pty.state || 'Maharashtra');
    }
  };

  // Add Item Row
  const handleAddItemRow = (prod?: ProductItem) => {
    const newItem: InvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: prod?.id,
      description: prod?.name || '',
      hsnCode: prod?.hsnCode || '252329',
      quantity: 1,
      unit: prod?.unit || 'Bags',
      rate: prod?.salePrice || 0,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: (prod?.salePrice || 0) * 1,
      gstRate: prod?.gstRate !== undefined ? prod?.gstRate : 18,
      amount: (prod?.salePrice || 0) * 1
    };
    setItems(prev => [...prev, newItem]);
  };

  // Open Product Modal to Add new Product
  const handleOpenAddProduct = (rowIndex?: number) => {
    setProductToEdit(null);
    setTargetRowForProduct(rowIndex !== undefined ? rowIndex : null);
    setShowProductModal(true);
  };

  // Open Product Modal to Edit existing Product
  const handleOpenEditProduct = (prod: ProductItem, rowIndex: number) => {
    setProductToEdit(prod);
    setTargetRowForProduct(rowIndex);
    setShowProductModal(true);
  };

  // Handle save from QuickProductModal
  const handleSaveProductFromModal = async (savedProd: ProductItem) => {
    if (onSaveProduct) {
      await onSaveProduct(savedProd);
    }
    // Update target row with new product details
    if (targetRowForProduct !== null && targetRowForProduct < items.length) {
      handleUpdateItem(targetRowForProduct, 'productId', savedProd.id);
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

  // Update Item Row
  const handleUpdateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    // Intercept Add New Product from dropdown
    if (field === 'productId' && value === '__ADD_NEW_PRODUCT__') {
      handleOpenAddProduct(index);
      return;
    }

    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };

      // When product is selected, auto-populate details
      if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        if (prod) {
          target.productId = prod.id;
          target.description = prod.name;
          target.hsnCode = prod.hsnCode || '252329';
          target.unit = prod.unit || 'Bags';
          target.rate = prod.salePrice || 0;
          target.gstRate = prod.gstRate !== undefined ? prod.gstRate : 18;
        } else if (!value) {
          target.productId = undefined;
        }
      }

      // When user types description, check for automatic HSN & GST detection
      if (field === 'description' && typeof value === 'string') {
        const matchedCatalogProd = products.find(p => p.name.toLowerCase() === value.toLowerCase().trim());
        if (matchedCatalogProd) {
          target.productId = matchedCatalogProd.id;
          target.hsnCode = matchedCatalogProd.hsnCode;
          target.unit = matchedCatalogProd.unit;
          target.rate = matchedCatalogProd.salePrice;
          target.gstRate = matchedCatalogProd.gstRate;
        } else {
          const detected = autoDetectHsn(value);
          if (detected) {
            // Auto-populate HSN and GST if currently default or empty
            if (!target.hsnCode || target.hsnCode === '252329' || target.hsnCode === '') {
              target.hsnCode = detected.code;
            }
            if (target.gstRate === undefined || target.gstRate === 18) {
              target.gstRate = detected.defaultGst;
            }
            if (!target.unit || target.unit === 'Bags') {
              target.unit = detected.defaultUnit;
            }
          }
        }
      }

      // Recompute Taxable Amount
      const qty = Number(target.quantity) || 0;
      const rate = Number(target.rate) || 0;
      const gross = qty * rate;
      const discPct = Number(target.discountPercent) || 0;
      const discAmt = (gross * discPct) / 100;
      target.discountAmount = discAmt;
      target.taxableAmount = Math.max(0, gross - discAmt);
      target.amount = target.taxableAmount;

      copy[index] = target;
      return copy;
    });
  };

  // Remove Item Row
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('At least one item is required in the sales bill.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations & Rate-Wise GST Breakdown
  const calculations = useMemo(() => {
    let subTotalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const rateMap = new Map<TaxSlab, GSTSummaryItem>();

    items.forEach(item => {
      const taxable = item.taxableAmount || 0;
      subTotalTaxable += taxable;
      const slab: TaxSlab = item.gstRate || 0;

      if (!rateMap.has(slab)) {
        const halfRate = taxType === 'intra_state' ? slab / 2 : 0;
        const fullRate = taxType === 'inter_state' ? slab : 0;
        rateMap.set(slab, {
          hsnCode: item.hsnCode || '—',
          gstRate: slab,
          taxableValue: 0,
          cgstRate: halfRate,
          cgstAmount: 0,
          sgstRate: halfRate,
          sgstAmount: 0,
          igstRate: fullRate,
          igstAmount: 0,
          totalTax: 0
        });
      }

      const entry = rateMap.get(slab)!;
      entry.taxableValue += taxable;

      if (taxType === 'intra_state') {
        const halfTax = (taxable * (slab / 2)) / 100;
        entry.cgstAmount += halfTax;
        entry.sgstAmount += halfTax;
        totalCgst += halfTax;
        totalSgst += halfTax;
      } else {
        const igstTax = (taxable * slab) / 100;
        entry.igstAmount += igstTax;
        totalIgst += igstTax;
      }
      entry.totalTax = entry.cgstAmount + entry.sgstAmount + entry.igstAmount;
    });

    const totalTax = totalCgst + totalSgst + totalIgst;
    const rawTotal = subTotalTaxable + totalTax + (Number(freightCharges) || 0) + (Number(otherCharges) || 0) - (Number(kasarDiscount) || 0);
    const grandTotal = Math.round(rawTotal);
    const roundOff = Number((grandTotal - rawTotal).toFixed(2));
    const balanceDue = Math.max(0, grandTotal - (Number(advancePaid) || 0));

    return {
      subTotalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      roundOff,
      grandTotal,
      balanceDue,
      rateBreakdowns: Array.from(rateMap.values()).sort((a, b) => a.gstRate - b.gstRate)
    };
  }, [items, taxType, freightCharges, otherCharges, kasarDiscount, advancePaid]);

  // Handle Quick Create Party Form
  const handleQuickCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim()) {
      alert('Please enter party name');
      return;
    }

    const partyId = `pty-${Date.now()}`;
    const newParty: Party = {
      id: partyId,
      name: newPartyName.trim(),
      gstin: newPartyGstin.trim(),
      phone: newPartyPhone.trim(),
      address: newPartyAddress.trim(),
      city: newPartyCity.trim(),
      state: newPartyState.trim(),
      stateCode: newPartyStateCode.trim(),
      partyType: 'sales_customer',
      accountCategory: 'party',
      accountGroup: 'sundry_debtors',
      openingBalance: 0,
      currentBalance: 0,
      createdAt: new Date().toISOString()
    };

    await onAddParty(newParty);

    // Auto select newly created party
    setSelectedPartyId(partyId);
    setCustomerName(newParty.name);
    setCustomerGSTIN(newParty.gstin);
    setCustomerAddress(newParty.address || `${newParty.city}, ${newParty.state}`);
    setCustomerState(newParty.state);
    setCustomerStateCode(newParty.stateCode);
    setPlaceOfSupply(newParty.state);

    setShowNewPartyModal(false);
  };

  // Submit Final Bill
  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Please select or enter Customer / Party Name');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    setIsSubmitting(true);
    try {
      const billId = initialBill?.id || `inv-${Date.now()}`;
      
      const billToSave: Invoice = {
        id: billId,
        invoiceNumber: billNumber.trim(),
        salesBillNumber: billNumber.trim(),
        salesBillDate: billDate,
        lrNumber: eWayBillNumber.trim(),
        lrDate: billDate,
        invoiceDate: billDate,
        dueDate: dueDate,
        invoiceType: 'tax_invoice',
        billCategory: 'income',
        ledgerImpact: 'debit',
        partyId: selectedPartyId || undefined,

        // Consignor (Billing Party)
        consignorName: customerName.trim(),
        consignorGSTIN: customerGSTIN.trim(),
        consignorAddress: customerAddress.trim(),
        consignorState: customerState,
        consignorStateCode: customerStateCode,

        // Consignee (Receiver)
        consigneeName: shipToSameAsBilling ? customerName.trim() : (shipToName.trim() || customerName.trim()),
        consigneeGSTIN: shipToSameAsBilling ? customerGSTIN.trim() : (shipToGSTIN.trim() || customerGSTIN.trim()),
        consigneeAddress: shipToSameAsBilling ? customerAddress.trim() : (shipToAddress.trim() || customerAddress.trim()),
        consigneeState: shipToSameAsBilling ? customerState : (shipToState || customerState),

        // Ship To details
        shipToName: shipToSameAsBilling ? customerName.trim() : (shipToName.trim() || customerName.trim()),
        shipToAddress: shipToSameAsBilling ? customerAddress.trim() : (shipToAddress.trim() || customerAddress.trim()),
        shipToGSTIN: shipToSameAsBilling ? customerGSTIN.trim() : (shipToGSTIN.trim() || customerGSTIN.trim()),
        shipToState: shipToSameAsBilling ? customerState : (shipToState || customerState),

        // Vehicle & Trip
        origin: settings.city || 'Pune',
        destination: customerState || 'Customer Site',
        vehicleNumber: vehicleNumber.trim(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        materialType: items.map(i => i.description).join(', ').substring(0, 80),

        // Line Items
        items: items.map(item => ({
          ...item,
          cgstRate: taxType === 'intra_state' ? (item.gstRate || 0) / 2 : 0,
          cgstAmount: taxType === 'intra_state' ? ((item.taxableAmount || 0) * (item.gstRate || 0) / 2) / 100 : 0,
          sgstRate: taxType === 'intra_state' ? (item.gstRate || 0) / 2 : 0,
          sgstAmount: taxType === 'intra_state' ? ((item.taxableAmount || 0) * (item.gstRate || 0) / 2) / 100 : 0,
          igstRate: taxType === 'inter_state' ? (item.gstRate || 0) : 0,
          igstAmount: taxType === 'inter_state' ? ((item.taxableAmount || 0) * (item.gstRate || 0)) / 100 : 0,
        })),

        // Breakdown
        grossFreight: 0,
        loadingCharges: Number(freightCharges) || 0,
        unloadingCharges: 0,
        detentionCharges: 0,
        otherCharges: Number(otherCharges) || 0,
        subTotal: calculations.subTotalTaxable,

        // Tax
        taxSlab: items[0]?.gstRate || 18,
        taxType: taxType,
        taxMechanism: 'forward_charge',
        cgstRate: taxType === 'intra_state' ? 9 : 0,
        sgstRate: taxType === 'intra_state' ? 9 : 0,
        igstRate: taxType === 'inter_state' ? 18 : 0,
        cgstAmount: calculations.totalCgst,
        sgstAmount: calculations.totalSgst,
        igstAmount: calculations.totalIgst,
        totalTax: calculations.totalTax,
        roundOff: calculations.roundOff,
        grandTotal: calculations.grandTotal,

        // Advances & Deductions
        advancePaid: Number(advancePaid) || 0,
        fuelDeduction: 0,
        otherDeductions: 0,
        kasarDeduction: Number(kasarDiscount) || 0,
        netPayable: calculations.grandTotal,

        // Payment status
        amountPaid: Number(advancePaid) || 0,
        balanceDue: calculations.balanceDue,
        paymentStatus: calculations.balanceDue === 0 ? 'paid' : (Number(advancePaid) > 0 ? 'partial' : 'unpaid'),
        payments: Number(advancePaid) > 0 ? [
          {
            id: `pay-${Date.now()}`,
            date: billDate,
            amount: Number(advancePaid),
            mode: 'bank_neft',
            referenceNo: 'Initial Advance / Cash at Billing',
            notes: 'Advance recorded on Sales Bill generation'
          }
        ] : [],

        notes: notes.trim(),
        createdAt: initialBill?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(billToSave, deductStock, postToPartyLedger);
    } catch (err) {
      console.error('Error generating sales bill:', err);
      alert('Error saving sales bill. Please verify details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-blue-700" />
              <span>{initialBill ? 'Edit GST Sales Bill' : 'Generate GST Sales Bill (Tax Invoice)'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create comprehensive GST Tax Invoice with rate-wise GST (0%, 5%, 12%, 18%, 28%), stock deduction and party ledger posting.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitBill}
            disabled={isSubmitting}
            className="flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white px-4 py-1.5 rounded text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Saving Bill...' : 'Save Sales Bill'}</span>
          </button>
        </div>
      </div>

      {/* Main Builder Form */}
      <form onSubmit={handleSubmitBill} className="space-y-4">
        
        {/* SECTION 1: INVOICE META & CUSTOMER DETAILS */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
          
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-700" />
              <span>Bill Header & Buyer (Customer Party) Details</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">STEP 1 OF 3</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Bill Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sales Bill / Invoice No. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono font-bold text-blue-800 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            {/* Bill Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            {/* Tax Type Switcher */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tax Type (Supply Type)
              </label>
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value as TaxType)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="intra_state">Intra-State (CGST + SGST)</option>
                <option value="inter_state">Inter-State (IGST Only)</option>
              </select>
            </div>
          </div>

          {/* Customer / Party Selection */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Select Party Dropdown with Quick Add */}
            <div className="md:col-span-1 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Select Customer Party <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewPartyModal(true)}
                  className="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Party</span>
                </button>
              </div>
              <select
                value={selectedPartyId}
                onChange={(e) => handleSelectParty(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                <option value="">-- Choose Customer from Directory --</option>
                {salesParties.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.gstin ? `(${p.gstin})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Billed To (Customer Name) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Party Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            {/* Customer GSTIN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Customer GSTIN / UIN
              </label>
              <input
                type="text"
                placeholder="e.g. 27AAAAA0000A1Z5 (Leave blank for URP)"
                value={customerGSTIN}
                onChange={(e) => setCustomerGSTIN(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            {/* Billing Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Billing Address
              </label>
              <input
                type="text"
                placeholder="Full address, industrial area, city, pincode..."
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            {/* State of Supply */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                State & Place of Supply
              </label>
              <select
                value={customerState}
                onChange={(e) => {
                  const st = e.target.value;
                  setCustomerState(st);
                  const matched = INDIAN_STATES.find(s => s.name === st);
                  if (matched) {
                    setCustomerStateCode(matched.code);
                    setPlaceOfSupply(matched.name);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              >
                {INDIAN_STATES.map(s => (
                  <option key={s.code} value={s.name}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Transport / Dispatch Metadata & Fleet Vehicle Selector */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <Truck className="w-3.5 h-3.5 text-blue-700" />
                <span>Transport & Vehicle Logistics</span>
              </div>

              {vehicles && vehicles.length > 0 && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-600 font-bold hidden sm:inline">Select Fleet Vehicle:</span>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => handleSelectVehicle(e.target.value)}
                    className="bg-blue-50/70 border border-blue-300 text-blue-900 rounded px-2.5 py-1 text-xs font-bold focus:ring-1 focus:ring-blue-600 focus:outline-hidden cursor-pointer"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vehicle / Truck No.
                </label>
                <input
                  type="text"
                  list="sales-fleet-vehicles-list"
                  placeholder="e.g. MH-12-AB-1234"
                  value={vehicleNumber}
                  onChange={(e) => handleVehicleNumberChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono font-bold focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
                <datalist id="sales-fleet-vehicles-list">
                  {vehicles.map(v => (
                    <option key={v.id} value={v.vehicleNumber}>
                      {v.driverName} {v.driverPhone ? `- ${v.driverPhone}` : ''} {v.vehicleType ? `(${v.vehicleType})` : ''}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-Way Bill No. / LR No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. 231456789012"
                  value={eWayBillNumber}
                  onChange={(e) => setEWayBillNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PO / Ref No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-9801"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Driver Phone
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 9876543210"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

        </div>

        {/* SECTION 2: PRODUCT LINE ITEMS TABLE (WITH GST RATE SELECTION) */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Boxes className="w-3.5 h-3.5 text-blue-700" />
                <span>Product Line Items & GST Rate Breakdown</span>
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Select products from stock inventory to auto-populate HSN, unit, rate, and GST %. Tax is calculated item-wise.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleAddItemRow()}
              className="flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded text-xs font-bold border border-blue-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item Row</span>
            </button>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 w-8 text-center">#</th>
                  <th className="p-2.5 min-w-[200px]">Product / Item Description</th>
                  <th className="p-2.5 w-24">HSN/SAC</th>
                  <th className="p-2.5 w-20 text-right">Qty</th>
                  <th className="p-2.5 w-20 text-center">Unit</th>
                  <th className="p-2.5 w-24 text-right">Rate (₹)</th>
                  <th className="p-2.5 w-20 text-right">Disc %</th>
                  <th className="p-2.5 w-28 text-right">Taxable (₹)</th>
                  <th className="p-2.5 w-24 text-center">GST Rate</th>
                  <th className="p-2.5 w-28 text-right">Total (₹)</th>
                  <th className="p-2.5 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {items.map((item, idx) => {
                  const slab = item.gstRate || 0;
                  const taxable = item.taxableAmount || 0;
                  const itemTaxAmt = (taxable * slab) / 100;
                  const itemTotal = taxable + itemTaxAmt;

                  const matchedProduct = products.find(p => p.id === item.productId || p.name.toLowerCase() === item.description.toLowerCase());

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-2 text-center font-mono text-slate-400 font-semibold">
                        {idx + 1}
                      </td>

                      {/* Product Selector / Description */}
                      <td className="p-2">
                        <div className="space-y-1.5">
                          {/* Product Dropdown & Inline Quick Actions */}
                          <div className="flex items-center space-x-1">
                            <select
                              value={item.productId || ''}
                              onChange={(e) => handleUpdateItem(idx, 'productId', e.target.value)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                            >
                              <option value="">-- Choose Stock Product (Auto-fills HSN & Rate) --</option>
                              <option value="__ADD_NEW_PRODUCT__" className="font-bold text-blue-700 bg-blue-50">
                                ➕ + Add New Product to Catalog...
                              </option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (HSN: {p.hsnCode} | Stock: {p.currentStock} {p.unit} | ₹{p.salePrice})
                                </option>
                              ))}
                            </select>

                            {/* Quick Add Product Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenAddProduct(idx)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 transition-colors shrink-0"
                              title="Add New Product to Catalog"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {/* Quick Edit Product Button (active when matched or selected) */}
                            {matchedProduct && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditProduct(matchedProduct, idx)}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition-colors shrink-0"
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
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 transition-colors shrink-0"
                                title={`Delete "${matchedProduct.name}" from Catalog`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="Item name / specifications"
                              value={item.description}
                              onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                            />
                          </div>

                          {/* Product stock & Auto HSN indicator */}
                          <div className="flex items-center justify-between text-[10px]">
                            {matchedProduct ? (
                              <div className="text-slate-500 font-medium">
                                In Stock: <strong className={matchedProduct.currentStock <= 0 ? 'text-rose-600' : 'text-emerald-700'}>{matchedProduct.currentStock} {matchedProduct.unit}</strong>
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
                                      handleUpdateItem(idx, 'hsnCode', autoHsn.code);
                                      handleUpdateItem(idx, 'gstRate', autoHsn.defaultGst);
                                      if (!item.unit || item.unit === 'Bags') {
                                        handleUpdateItem(idx, 'unit', autoHsn.defaultUnit);
                                      }
                                    }}
                                    className="inline-flex items-center space-x-0.5 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded font-bold border border-blue-200"
                                    title="Click to apply suggested HSN & GST %"
                                  >
                                    <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                                    <span>Apply HSN {autoHsn.code} ({autoHsn.defaultGst}%)</span>
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </td>

                      {/* HSN Code */}
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="HSN"
                          value={item.hsnCode || ''}
                          onChange={(e) => handleUpdateItem(idx, 'hsnCode', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          required
                          value={item.quantity || ''}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-right text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                        />
                      </td>

                      {/* Unit */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.unit || 'Bags'}
                          onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs text-center font-medium focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                        />
                      </td>

                      {/* Rate */}
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          placeholder="0.00"
                          value={item.rate || ''}
                          onChange={(e) => handleUpdateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-semibold text-right focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                        />
                      </td>

                      {/* Discount % */}
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={item.discountPercent || ''}
                          onChange={(e) => handleUpdateItem(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs font-mono text-right text-slate-600 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                        />
                      </td>

                      {/* Taxable Amount (Calculated) */}
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        ₹{formatINR(taxable)}
                      </td>

                      {/* GST Slab Selector */}
                      <td className="p-2 text-center">
                        <select
                          value={item.gstRate || 0}
                          onChange={(e) => handleUpdateItem(idx, 'gstRate', Number(e.target.value) as TaxSlab)}
                          className="w-full px-1.5 py-1 border border-slate-300 rounded text-xs font-black text-center text-blue-800 bg-blue-50/50 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                        >
                          {GST_SLABS.map(slab => (
                            <option key={slab} value={slab}>{slab}% GST</option>
                          ))}
                        </select>
                      </td>

                      {/* Line Item Total (Taxable + GST) */}
                      <td className="p-2 text-right font-mono font-black text-emerald-700">
                        ₹{formatINR(itemTotal)}
                      </td>

                      {/* Delete Row */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Remove Line Item"
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

          {/* Rate-Wise GST Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Rate-Wise GST Summary Breakdown</span>
              <span className="font-mono text-[10px] text-blue-700">
                {taxType === 'intra_state' ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse bg-white rounded border border-slate-200">
                <thead>
                  <tr className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                    <th className="p-2">GST Slab</th>
                    <th className="p-2 text-right">Taxable Value (₹)</th>
                    {taxType === 'intra_state' ? (
                      <>
                        <th className="p-2 text-right">CGST Amt (₹)</th>
                        <th className="p-2 text-right">SGST Amt (₹)</th>
                      </>
                    ) : (
                      <th className="p-2 text-right">IGST Amt (₹)</th>
                    )}
                    <th className="p-2 text-right">Total Tax (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {calculations.rateBreakdowns.map((rateInfo) => (
                    <tr key={rateInfo.gstRate}>
                      <td className="p-2 font-bold text-slate-900">{rateInfo.gstRate}% GST</td>
                      <td className="p-2 text-right font-semibold">₹{formatINR(rateInfo.taxableValue)}</td>
                      {taxType === 'intra_state' ? (
                        <>
                          <td className="p-2 text-right text-slate-700">({rateInfo.cgstRate}%) ₹{formatINR(rateInfo.cgstAmount)}</td>
                          <td className="p-2 text-right text-slate-700">({rateInfo.sgstRate}%) ₹{formatINR(rateInfo.sgstAmount)}</td>
                        </>
                      ) : (
                        <td className="p-2 text-right text-slate-700">({rateInfo.igstRate}%) ₹{formatINR(rateInfo.igstAmount)}</td>
                      )}
                      <td className="p-2 text-right font-bold text-blue-700">₹{formatINR(rateInfo.totalTax)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/60 font-bold border-t border-slate-300">
                    <td className="p-2">Total GST Tax</td>
                    <td className="p-2 text-right font-bold">₹{formatINR(calculations.subTotalTaxable)}</td>
                    {taxType === 'intra_state' ? (
                      <>
                        <td className="p-2 text-right">₹{formatINR(calculations.totalCgst)}</td>
                        <td className="p-2 text-right">₹{formatINR(calculations.totalSgst)}</td>
                      </>
                    ) : (
                      <td className="p-2 text-right">₹{formatINR(calculations.totalIgst)}</td>
                    )}
                    <td className="p-2 text-right font-black text-blue-800">₹{formatINR(calculations.totalTax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* SECTION 3: CHARGES, ADVANCES & GRAND TOTAL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Left Column: Options, Terms & Notes */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
              Posting & Automation Options
            </div>

            <div className="space-y-2.5">
              <label className="flex items-start space-x-2.5 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900">Auto-Deduct items from Stock Inventory</span>
                  <p className="text-[11px] text-slate-500">
                    Reduces quantity in stock catalog and adds a "SALES BILL (-)" record in stock movement log.
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-2.5 cursor-pointer bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={postToPartyLedger}
                  onChange={(e) => setPostToPartyLedger(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900">Post to Party Ledger (Debit Customer Account)</span>
                  <p className="text-[11px] text-slate-500">
                    Debits the buyer's ledger in Party Ledgers with bill amount and keeps running balance updated.
                  </p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Invoice Notes / Terms / Remarks
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Delivery terms, payment within 15 days, loading site remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Right Column: Final Totals Matrix */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-2.5 text-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>Final Bill Calculation</span>
              <span className="font-mono text-emerald-700 font-bold">ALL INCLUSIVE</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Subtotal (Taxable Value):</span>
              <span className="font-mono font-bold text-slate-900">₹{formatINR(calculations.subTotalTaxable)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Total GST Tax ({taxType === 'intra_state' ? 'CGST+SGST' : 'IGST'}):</span>
              <span className="font-mono font-bold text-blue-700">+ ₹{formatINR(calculations.totalTax)}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Freight / Transport Charges:</span>
              <div className="flex items-center space-x-1 w-32">
                <span className="text-slate-400 font-mono text-xs">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={freightCharges || ''}
                  onChange={(e) => setFreightCharges(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-0.5 border border-slate-300 rounded text-xs font-mono text-right focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Packaging & Other Charges:</span>
              <div className="flex items-center space-x-1 w-32">
                <span className="text-slate-400 font-mono text-xs">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={otherCharges || ''}
                  onChange={(e) => setOtherCharges(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-0.5 border border-slate-300 rounded text-xs font-mono text-right focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Kasar / Settlement Discount:</span>
              <div className="flex items-center space-x-1 w-32">
                <span className="text-slate-400 font-mono text-xs">-₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={kasarDiscount || ''}
                  onChange={(e) => setKasarDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-0.5 border border-slate-300 rounded text-xs font-mono text-right text-rose-600 focus:outline-hidden"
                />
              </div>
            </div>

            {calculations.roundOff !== 0 && (
              <div className="flex justify-between py-1 text-slate-500">
                <span>Round Off:</span>
                <span className="font-mono">{calculations.roundOff >= 0 ? `+₹${calculations.roundOff}` : `-₹${Math.abs(calculations.roundOff)}`}</span>
              </div>
            )}

            {/* Grand Total Bar */}
            <div className="flex justify-between items-center py-2.5 px-3 bg-blue-900 text-white rounded-lg font-black text-sm shadow-xs">
              <span>GRAND TOTAL (₹):</span>
              <span className="font-mono text-base text-amber-300">₹{formatINR(calculations.grandTotal)}</span>
            </div>

            {/* Advance / Cash Received */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-700 font-bold">Advance / Cash Received (₹):</span>
              <div className="flex items-center space-x-1 w-36">
                <span className="text-slate-400 font-mono text-xs">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={advancePaid || ''}
                  onChange={(e) => setAdvancePaid(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-emerald-300 bg-emerald-50 rounded text-xs font-mono font-bold text-right text-emerald-800 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Balance Due */}
            <div className="flex justify-between items-center py-2 px-3 bg-slate-100 rounded border border-slate-200">
              <span className="font-bold text-slate-700">NET BALANCE PAYABLE:</span>
              <span className={`font-mono font-black text-sm ${calculations.balanceDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                ₹{formatINR(calculations.balanceDue)}
              </span>
            </div>

            {/* Submit Action Buttons */}
            <div className="pt-3 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : 'Generate & Save Sales Bill'}</span>
              </button>
            </div>

          </div>

        </div>

      </form>

      {/* QUICK ADD PARTY MODAL */}
      {showNewPartyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-blue-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-blue-200" />
                <h3 className="text-sm font-bold">Add New Customer / Party</h3>
              </div>
              <button onClick={() => setShowNewPartyModal(false)} className="text-blue-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateParty} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Party / Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shree Balaji Traders, Raj Infra..."
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-bold focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    placeholder="27AAAAA0000A1Z5"
                    value={newPartyGstin}
                    onChange={(e) => setNewPartyGstin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono font-bold focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile / Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={newPartyPhone}
                    onChange={(e) => setNewPartyPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Billing Address
                </label>
                <input
                  type="text"
                  placeholder="Office / Shop Address, Area"
                  value={newPartyAddress}
                  onChange={(e) => setNewPartyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pune, Mumbai"
                    value={newPartyCity}
                    onChange={(e) => setNewPartyCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State
                  </label>
                  <select
                    value={newPartyState}
                    onChange={(e) => {
                      const st = e.target.value;
                      setNewPartyState(st);
                      const matched = INDIAN_STATES.find(s => s.name === st);
                      if (matched) setNewPartyStateCode(matched.code);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s.code} value={s.name}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewPartyModal(false)}
                  className="px-4 py-1.5 border border-slate-300 rounded text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-blue-700 text-white rounded text-xs font-bold hover:bg-blue-800"
                >
                  Save & Select Party
                </button>
              </div>
            </form>
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
