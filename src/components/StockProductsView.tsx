import React, { useState, useMemo } from 'react';
import { ProductItem, StockTransaction, TaxSlab, formatINR } from '../types';
import { 
  Boxes, Plus, Search, Filter, AlertTriangle, ArrowDownRight, ArrowUpRight, 
  Edit, Trash2, Tag, RefreshCw, Layers, CheckCircle2, FileText, Download, 
  ArrowRight, ShieldCheck, X
} from 'lucide-react';

interface StockProductsViewProps {
  products: ProductItem[];
  transactions: StockTransaction[];
  onSaveProduct: (product: ProductItem) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onAdjustStock: (
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
  ) => Promise<void>;
  onDeleteTransaction?: (txId: string) => Promise<void>;
  onNavigateToSalesBill?: (product?: ProductItem) => void;
  onNavigateToPurchaseBill?: (product?: ProductItem) => void;
  userRole?: string;
}

const COMMON_UNITS = [
  'Bags', 'MT', 'Tons', 'Pcs', 'Kg', 'Nos', 'Boxes', 'Ltr', 'Trips', 'Bundles', 'Drums', 'Meters'
];

const GST_SLABS: TaxSlab[] = [0, 5, 12, 18, 28];

export const StockProductsView: React.FC<StockProductsViewProps> = ({
  products,
  transactions,
  onSaveProduct,
  onDeleteProduct,
  onAdjustStock,
  onDeleteTransaction,
  onNavigateToSalesBill,
  onNavigateToPurchaseBill,
  userRole = 'admin'
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'transactions'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low_stock' | 'in_stock' | 'out_of_stock'>('all');

  // Product Add / Edit Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('Bags');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [gstRate, setGstRate] = useState<TaxSlab>(18);
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [minStockAlert, setMinStockAlert] = useState<number>(10);
  const [description, setDescription] = useState('');

  // Stock Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductItem | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustRate, setAdjustRate] = useState<number>(0);
  const [adjustRefNo, setAdjustRefNo] = useState('');
  const [adjustPartyName, setAdjustPartyName] = useState('');
  const [adjustDate, setAdjustDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjustNotes, setAdjustNotes] = useState('');

  // Categories extracted from products
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.hsnCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

      let matchesStock = true;
      if (stockFilter === 'low_stock') {
        const threshold = p.minStockAlert ?? 10;
        matchesStock = p.currentStock > 0 && p.currentStock <= threshold;
      } else if (stockFilter === 'out_of_stock') {
        matchesStock = p.currentStock <= 0;
      } else if (stockFilter === 'in_stock') {
        matchesStock = p.currentStock > 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, selectedCategory, stockFilter]);

  // Overall Inventory Stats
  const stats = useMemo(() => {
    const totalProducts = products.length;
    let totalStockQty = 0;
    let totalInventoryCostValue = 0;
    let totalInventorySaleValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach(p => {
      const stock = p.currentStock || 0;
      totalStockQty += stock;
      totalInventoryCostValue += stock * (p.purchasePrice || p.salePrice || 0);
      totalInventorySaleValue += stock * (p.salePrice || 0);

      const threshold = p.minStockAlert ?? 10;
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= threshold) {
        lowStockCount++;
      }
    });

    return {
      totalProducts,
      totalStockQty,
      totalInventoryCostValue,
      totalInventorySaleValue,
      lowStockCount,
      outOfStockCount
    };
  }, [products]);

  // Open Modal for New Product
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setName('');
    setCode(`PRD-${String(products.length + 1).padStart(3, '0')}`);
    setHsnCode('');
    setCategory('');
    setUnit('Bags');
    setPurchasePrice(0);
    setSalePrice(0);
    setGstRate(18);
    setOpeningStock(0);
    setMinStockAlert(10);
    setDescription('');
    setShowProductModal(true);
  };

  // Open Modal for Edit Product
  const handleOpenEditProduct = (prod: ProductItem) => {
    setEditingProduct(prod);
    setName(prod.name || '');
    setCode(prod.code || '');
    setHsnCode(prod.hsnCode || '');
    setCategory(prod.category || '');
    setUnit(prod.unit || 'Bags');
    setPurchasePrice(prod.purchasePrice || 0);
    setSalePrice(prod.salePrice || 0);
    setGstRate(prod.gstRate || 18);
    setOpeningStock(prod.currentStock || 0);
    setMinStockAlert(prod.minStockAlert ?? 10);
    setDescription(prod.description || '');
    setShowProductModal(true);
  };

  // Save Product (Create or Update)
  const handleSaveProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter Product Name');
      return;
    }

    const prodId = editingProduct ? editingProduct.id : `prd-${Date.now()}`;
    const productToSave: ProductItem = {
      id: prodId,
      name: name.trim(),
      code: code.trim(),
      hsnCode: hsnCode.trim(),
      category: category.trim(),
      unit: unit.trim(),
      purchasePrice: Number(purchasePrice) || 0,
      salePrice: Number(salePrice) || 0,
      gstRate: Number(gstRate) as TaxSlab,
      currentStock: editingProduct ? editingProduct.currentStock : (Number(openingStock) || 0),
      minStockAlert: Number(minStockAlert) || 0,
      description: description.trim(),
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await onSaveProduct(productToSave);

    // If new product with initial opening stock, record stock transaction
    if (!editingProduct && Number(openingStock) > 0) {
      await onAdjustStock(prodId, Number(openingStock), {
        productName: name.trim(),
        type: 'in',
        unit: unit.trim(),
        rate: Number(purchasePrice) || 0,
        referenceNo: 'OPENING-STOCK',
        date: new Date().toISOString().split('T')[0],
        notes: 'Initial Opening Stock Entry'
      });
    }

    setShowProductModal(false);
  };

  // Open Adjust Modal
  const handleOpenAdjustModal = (prod: ProductItem, defaultType: 'in' | 'out' | 'adjustment' = 'in') => {
    setAdjustingProduct(prod);
    setAdjustType(defaultType);
    setAdjustQty(1);
    setAdjustRate(defaultType === 'in' ? (prod.purchasePrice || 0) : (prod.salePrice || 0));
    setAdjustRefNo('');
    setAdjustPartyName('');
    setAdjustDate(new Date().toISOString().split('T')[0]);
    setAdjustNotes('');
    setShowAdjustModal(true);
  };

  // Submit Stock Adjustment
  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    if (adjustQty <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    let delta = adjustQty;
    if (adjustType === 'out') {
      delta = -adjustQty;
    } else if (adjustType === 'adjustment') {
      // Direct adjustment: delta = target - current
      delta = adjustQty - adjustingProduct.currentStock;
    }

    await onAdjustStock(adjustingProduct.id, delta, {
      productName: adjustingProduct.name,
      type: adjustType,
      unit: adjustingProduct.unit,
      rate: adjustRate,
      referenceNo: adjustRefNo.trim(),
      partyName: adjustPartyName.trim(),
      date: adjustDate,
      notes: adjustNotes.trim()
    });

    setShowAdjustModal(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (products.length === 0) {
      alert('No products to export.');
      return;
    }

    const headers = ['Product Code', 'Product Name', 'HSN Code', 'Category', 'Unit', 'Purchase Rate (₹)', 'Sale Rate (₹)', 'GST Rate %', 'Current Stock', 'Stock Value (₹)'];
    const rows = products.map(p => [
      `"${p.code || ''}"`,
      `"${p.name || ''}"`,
      `"${p.hsnCode || ''}"`,
      `"${p.category || ''}"`,
      `"${p.unit || ''}"`,
      p.purchasePrice || 0,
      p.salePrice || 0,
      `${p.gstRate || 0}%`,
      p.currentStock || 0,
      (p.currentStock || 0) * (p.salePrice || 0)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NCBL_Stock_Products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6">
      
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 p-4 rounded-lg text-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Stock & Products Management</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage product catalog, HSN codes, GST % rates, inventory levels, and live stock in/out adjustments.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-semibold transition-all border border-slate-300 shadow-xs"
            title="Export Products & Stock to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Stock</span>
          </button>

          {onNavigateToPurchaseBill && ['admin', 'accountant'].includes(userRole) && (
            <button
              onClick={() => onNavigateToPurchaseBill()}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs"
              title="Create GST Purchase Tax Invoice (Inward Stock +)"
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>+ New Purchase Bill (Stock+)</span>
            </button>
          )}

          {onNavigateToSalesBill && (
            <button
              onClick={() => onNavigateToSalesBill()}
              className="flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-xs"
              title="Create GST Sales Bill with Products"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>+ Create Sales Bill</span>
            </button>
          )}

          {['admin', 'accountant'].includes(userRole) && (
            <button
              onClick={handleOpenAddProduct}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Products</div>
          <div className="text-lg font-black text-slate-900 mt-1">{stats.totalProducts}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{availableCategories.length} categories active</div>
        </div>

        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Stock Units</div>
          <div className="text-lg font-black text-blue-700 mt-1">{stats.totalStockQty.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Across all warehouse items</div>
        </div>

        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Stock Value (Sale)</div>
          <div className="text-lg font-black text-emerald-700 mt-1">₹{formatINR(stats.totalInventorySaleValue)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Cost Val: ₹{formatINR(stats.totalInventoryCostValue)}</div>
        </div>

        <div className={`p-3 rounded-lg border shadow-xs ${
          stats.lowStockCount > 0 || stats.outOfStockCount > 0 
            ? 'bg-amber-50/60 border-amber-200 text-amber-900' 
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Low / Out of Stock</span>
            {(stats.lowStockCount > 0 || stats.outOfStockCount > 0) && (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            )}
          </div>
          <div className="text-lg font-black text-amber-700 mt-1">
            {stats.lowStockCount + stats.outOfStockCount} <span className="text-xs font-semibold text-slate-600">Items</span>
          </div>
          <div className="text-[10px] text-amber-800/80 mt-0.5 font-medium">
            {stats.outOfStockCount} out of stock, {stats.lowStockCount} low
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-lg px-3 pt-2">
        <button
          onClick={() => setActiveSubTab('products')}
          className={`flex items-center space-x-2 px-4 py-2 border-b-2 text-xs font-bold transition-all ${
            activeSubTab === 'products'
              ? 'border-blue-700 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Product Catalog & Stock ({filteredProducts.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('transactions')}
          className={`flex items-center space-x-2 px-4 py-2 border-b-2 text-xs font-bold transition-all ${
            activeSubTab === 'transactions'
              ? 'border-blue-700 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Stock Movement Ledger ({transactions.length})</span>
        </button>
      </div>

      {/* TAB 1: PRODUCT LIST & STOCK TABLE */}
      {activeSubTab === 'products' && (
        <div className="bg-white border border-slate-200 rounded-b-lg shadow-xs overflow-hidden">
          
          {/* Filters Bar */}
          <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-2.5">
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search product, HSN, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-medium"
              >
                <option value="all">All Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Stock Status Filter */}
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-medium"
              >
                <option value="all">All Stock Status</option>
                <option value="in_stock">In Stock Only</option>
                <option value="low_stock">⚠️ Low Stock Alert</option>
                <option value="out_of_stock">❌ Out of Stock</option>
              </select>

              {(searchTerm || selectedCategory !== 'all' || stockFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                    setStockFilter('all');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2 py-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Product Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 w-10 text-center">#</th>
                  <th className="p-3">Product Name / Description</th>
                  <th className="p-3">HSN/SAC</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Sale Price (₹)</th>
                  <th className="p-3 text-center">GST %</th>
                  <th className="p-3 text-right">Available Stock</th>
                  <th className="p-3 text-right">Total Stock Value</th>
                  <th className="p-3 text-center">Stock Actions</th>
                  <th className="p-3 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No products found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {products.length === 0 ? 'Click "+ Add New Product" to add items to your stock inventory.' : 'Try adjusting your search query or category filters.'}
                      </p>
                      {products.length === 0 && ['admin', 'accountant'].includes(userRole) && (
                        <button
                          onClick={handleOpenAddProduct}
                          className="mt-3 inline-flex items-center space-x-1.5 bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-800"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Your First Product</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod, idx) => {
                    const isOutOfStock = (prod.currentStock || 0) <= 0;
                    const isLowStock = !isOutOfStock && (prod.currentStock || 0) <= (prod.minStockAlert ?? 10);
                    const stockValue = (prod.currentStock || 0) * (prod.salePrice || 0);

                    return (
                      <tr 
                        key={prod.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isOutOfStock ? 'bg-rose-50/30' : isLowStock ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="p-3 text-center font-mono text-slate-400 text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                            <span>{prod.name}</span>
                            {prod.code && (
                              <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                {prod.code}
                              </span>
                            )}
                          </div>
                          {prod.description && (
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{prod.description}</p>
                          )}
                        </td>

                        <td className="p-3 font-mono font-semibold text-slate-700">
                          {prod.hsnCode || '—'}
                        </td>

                        <td className="p-3">
                          {prod.category ? (
                            <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100">
                              {prod.category}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          ₹{formatINR(prod.salePrice)}
                          {prod.purchasePrice ? (
                            <div className="text-[9px] font-normal text-slate-400">
                              Cost: ₹{formatINR(prod.purchasePrice)}
                            </div>
                          ) : null}
                        </td>

                        <td className="p-3 text-center">
                          <span className="inline-block bg-slate-100 text-slate-800 text-[10px] font-black px-1.5 py-0.5 rounded border border-slate-300">
                            {prod.gstRate || 0}% GST
                          </span>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <span className={`font-mono font-black text-sm ${
                              isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'
                            }`}>
                              {prod.currentStock || 0}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">{prod.unit || 'Bags'}</span>
                          </div>

                          {isOutOfStock ? (
                            <span className="inline-block text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 rounded border border-rose-200">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 rounded border border-amber-200">
                              ⚠️ Low Stock (&lt;{prod.minStockAlert ?? 10})
                            </span>
                          ) : null}
                        </td>

                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          ₹{formatINR(stockValue)}
                        </td>

                        {/* Stock Adjustment Buttons */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleOpenAdjustModal(prod, 'in')}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                              title="Stock In (+)"
                            >
                              + In
                            </button>
                            <button
                              onClick={() => handleOpenAdjustModal(prod, 'out')}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                              title="Stock Out (-)"
                            >
                              - Out
                            </button>
                            <button
                              onClick={() => handleOpenAdjustModal(prod, 'adjustment')}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all"
                              title="Direct Adjust"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>

                        {/* Row Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            {onNavigateToPurchaseBill && ['admin', 'accountant'].includes(userRole) && (
                              <button
                                onClick={() => onNavigateToPurchaseBill(prod)}
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded"
                                title="Create Purchase Bill for this product (Stock Inward +)"
                              >
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onNavigateToSalesBill && (
                              <button
                                onClick={() => onNavigateToSalesBill(prod)}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                title="Create Sales Bill with this product"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {['admin', 'accountant'].includes(userRole) && (
                              <>
                                <button
                                  onClick={() => handleOpenEditProduct(prod)}
                                  className="p-1 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded"
                                  title="Edit Product"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (window.confirm(`Delete product "${prod.name}"? This cannot be undone.`)) {
                                      onDeleteProduct(prod.id);
                                    }
                                  }}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          {filteredProducts.length > 0 && (
            <div className="p-3 bg-slate-50/70 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> total products
              </div>
              <div className="font-mono text-slate-700">
                Total Stock Quantity: <strong className="text-blue-700">{stats.totalStockQty}</strong> Units | Total Value: <strong className="text-emerald-700">₹{formatINR(stats.totalInventorySaleValue)}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STOCK MOVEMENT LEDGER */}
      {activeSubTab === 'transactions' && (
        <div className="bg-white border border-slate-200 rounded-b-lg shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              <span>Stock Transactions History & Movement Log</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              Total {transactions.length} transactions recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">Date</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-right">Rate (₹)</th>
                  <th className="p-3">Reference / Bill No</th>
                  <th className="p-3">Party / Notes</th>
                  <th className="p-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No stock movement logs recorded yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Stock transactions are recorded automatically when you perform Stock In/Out or generate Sales Bills.
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isIn = tx.type === 'in' || tx.type === 'purchase_bill';
                    const isPurchaseBill = tx.type === 'purchase_bill';
                    const isOut = tx.type === 'out' || tx.type === 'sales_bill';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-slate-700 text-[11px]">
                          {tx.date || tx.createdAt?.split('T')[0] || '—'}
                        </td>

                        <td className="p-3 font-bold text-slate-900">
                          {tx.productName}
                        </td>

                        <td className="p-3">
                          {isPurchaseBill ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              <ArrowDownRight className="w-3 h-3 text-emerald-700" />
                              <span>PURCHASE BILL (+)</span>
                            </span>
                          ) : isIn ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <ArrowDownRight className="w-3 h-3" />
                              <span>STOCK IN (+)</span>
                            </span>
                          ) : tx.type === 'sales_bill' ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <FileText className="w-3 h-3" />
                              <span>SALES BILL (-)</span>
                            </span>
                          ) : isOut ? (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              <ArrowUpRight className="w-3 h-3" />
                              <span>STOCK OUT (-)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              <RefreshCw className="w-3 h-3" />
                              <span>ADJUSTMENT</span>
                            </span>
                          )}
                        </td>

                        <td className={`p-3 text-right font-mono font-black ${
                          isIn ? 'text-emerald-700' : isOut ? 'text-rose-700' : 'text-slate-900'
                        }`}>
                          {isIn ? '+' : isOut ? '-' : ''}{tx.quantity} <span className="text-[10px] font-normal text-slate-500">{tx.unit}</span>
                        </td>

                        <td className="p-3 text-right font-mono text-slate-700">
                          {tx.rate ? `₹${formatINR(tx.rate)}` : '—'}
                        </td>

                        <td className="p-3 font-mono font-semibold text-slate-800">
                          {tx.referenceNo || '—'}
                        </td>

                        <td className="p-3">
                          {tx.partyName && (
                            <div className="font-semibold text-slate-900">{tx.partyName}</div>
                          )}
                          {tx.notes && (
                            <div className="text-[10px] text-slate-500">{tx.notes}</div>
                          )}
                          {!tx.partyName && !tx.notes && <span className="text-slate-400">—</span>}
                        </td>

                        <td className="p-3 text-center">
                          {onDeleteTransaction && ['admin'].includes(userRole) && (
                            <button
                              onClick={() => {
                                if (window.confirm('Delete this stock log entry? (Note: this does not alter current stock balance)')) {
                                  onDeleteTransaction(tx.id);
                                }
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Delete Transaction Log"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT PRODUCT */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-blue-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Boxes className="w-5 h-5 text-blue-200" />
                <h3 className="text-sm font-bold">
                  {editingProduct ? 'Edit Product Item' : 'Add New Product to Stock'}
                </h3>
              </div>
              <button 
                onClick={() => setShowProductModal(false)}
                className="text-blue-200 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveProductForm} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product / Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UltraTech Cement 50kg, TMT Steel Bar 12mm, etc."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Code / SKU
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PRD-001, CMT-50"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    HSN / SAC Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 252329, 721420"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cement, Steel, Chemical, Spare"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unit of Measurement <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex space-x-1.5">
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-semibold"
                    >
                      {COMMON_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sale Price / Unit (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="0.00"
                    value={salePrice || ''}
                    onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Purchase / Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={purchasePrice || ''}
                    onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Applicable GST Rate (%) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value) as TaxSlab)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-bold"
                  >
                    {GST_SLABS.map(slab => (
                      <option key={slab} value={slab}>{slab}% GST</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Min Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="10"
                    value={minStockAlert || ''}
                    onChange={(e) => setMinStockAlert(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono"
                  />
                </div>

                {!editingProduct && (
                  <div className="sm:col-span-2 bg-blue-50/70 border border-blue-200 p-3 rounded-lg">
                    <label className="block text-xs font-bold text-blue-900 mb-1">
                      Initial Opening Stock Quantity ({unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={openingStock || ''}
                      onChange={(e) => setOpeningStock(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden font-mono font-bold text-blue-800"
                    />
                    <p className="text-[10px] text-blue-600 mt-1">
                      This will be set as current available stock and logged as Opening Stock in the movement ledger.
                    </p>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description / Specifications
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Add specifications, brand details, dimensions, packaging details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold shadow-xs flex items-center space-x-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingProduct ? 'Save Changes' : 'Add Product'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: STOCK IN / OUT / ADJUSTMENT */}
      {showAdjustModal && adjustingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className={`p-4 text-white flex items-center justify-between ${
              adjustType === 'in' ? 'bg-emerald-700' : adjustType === 'out' ? 'bg-rose-700' : 'bg-slate-800'
            }`}>
              <div className="flex items-center space-x-2">
                {adjustType === 'in' ? <ArrowDownRight className="w-5 h-5" /> : adjustType === 'out' ? <ArrowUpRight className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                <div>
                  <h3 className="text-sm font-bold">
                    {adjustType === 'in' ? 'Stock In (Add Inventory)' : adjustType === 'out' ? 'Stock Out (Dispatch / Sale)' : 'Direct Stock Adjustment'}
                  </h3>
                  <p className="text-[11px] text-white/80">{adjustingProduct.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAdjustModal(false)}
                className="text-white/80 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveStockAdjustment} className="p-5 space-y-3.5">
              
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustType('in');
                    setAdjustRate(adjustingProduct.purchasePrice || 0);
                  }}
                  className={`py-1.5 text-center rounded transition-all ${
                    adjustType === 'in' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  + Stock In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustType('out');
                    setAdjustRate(adjustingProduct.salePrice || 0);
                  }}
                  className={`py-1.5 text-center rounded transition-all ${
                    adjustType === 'out' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  - Stock Out
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustType('adjustment');
                    setAdjustQty(adjustingProduct.currentStock);
                  }}
                  className={`py-1.5 text-center rounded transition-all ${
                    adjustType === 'adjustment' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Direct Set
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-600">Current In-Stock Quantity:</span>
                <strong className="font-mono text-slate-900 text-sm">
                  {adjustingProduct.currentStock} {adjustingProduct.unit}
                </strong>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {adjustType === 'adjustment' ? 'New Exact Stock Level' : 'Quantity to Add / Remove'} ({adjustingProduct.unit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={adjustQty || ''}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rate / Unit (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={adjustRate || ''}
                    onChange={(e) => setAdjustRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={adjustDate}
                    onChange={(e) => setAdjustDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reference No. (PO / Invoice / Challan)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-8821, CH-901"
                  value={adjustRefNo}
                  onChange={(e) => setAdjustRefNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Party / Supplier / Customer Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. ABC Suppliers, Local Warehouse"
                  value={adjustPartyName}
                  onChange={(e) => setAdjustPartyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Purchase In, Damaged goods removal, Physical count audit..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              {/* Preview Resulting Stock */}
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg flex items-center justify-between text-xs text-blue-900 font-bold">
                <span>Resulting Stock Level:</span>
                <span className="font-mono text-sm text-blue-900">
                  {adjustType === 'in' 
                    ? (adjustingProduct.currentStock + adjustQty) 
                    : adjustType === 'out' 
                      ? Math.max(0, adjustingProduct.currentStock - adjustQty) 
                      : adjustQty} {adjustingProduct.unit}
                </span>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded text-xs font-bold text-white shadow-xs ${
                    adjustType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : adjustType === 'out' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-800 hover:bg-slate-900'
                  }`}
                >
                  Confirm Adjustment
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
