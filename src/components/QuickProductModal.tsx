import React, { useState, useEffect } from 'react';
import { ProductItem, TaxSlab } from '../types';
import { COMMON_HSN_SAC_CODES, autoDetectHsn } from '../data/hsnCodes';
import { Boxes, X, Save, Sparkles, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';

interface QuickProductModalProps {
  initialProduct?: ProductItem | null;
  onSave: (product: ProductItem) => Promise<void>;
  onDelete?: (productId: string) => Promise<void>;
  onClose: () => void;
}

const GST_SLABS: TaxSlab[] = [0, 5, 12, 18, 28];
const COMMON_UNITS = ['Bags', 'MT', 'Tons', 'Pcs', 'Kg', 'Nos', 'Boxes', 'Ltr', 'Brass', 'Cum', 'Trips'];

export const QuickProductModal: React.FC<QuickProductModalProps> = ({
  initialProduct,
  onSave,
  onDelete,
  onClose
}) => {
  const isEditing = !!initialProduct;

  const [name, setName] = useState(initialProduct?.name || '');
  const [code, setCode] = useState(initialProduct?.code || `PRD-${Math.floor(100 + Math.random() * 900)}`);
  const [hsnCode, setHsnCode] = useState(initialProduct?.hsnCode || '252329');
  const [category, setCategory] = useState(initialProduct?.category || 'Building Material');
  const [unit, setUnit] = useState(initialProduct?.unit || 'Bags');
  const [purchasePrice, setPurchasePrice] = useState<number>(initialProduct?.purchasePrice || 0);
  const [salePrice, setSalePrice] = useState<number>(initialProduct?.salePrice || 0);
  const [gstRate, setGstRate] = useState<TaxSlab>(initialProduct?.gstRate !== undefined ? initialProduct.gstRate : 18);
  const [currentStock, setCurrentStock] = useState<number>(initialProduct?.currentStock || 0);
  const [minStockAlert, setMinStockAlert] = useState<number>(initialProduct?.minStockAlert || 10);
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto detect HSN when typing name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing || !hsnCode) {
      const match = autoDetectHsn(val);
      if (match) {
        setHsnCode(match.code);
        setGstRate(match.defaultGst);
        if (!initialProduct) {
          setUnit(match.defaultUnit);
        }
      }
    }
  };

  // Quick select standard HSN from common list
  const handleSelectPredefinedHsn = (codeVal: string) => {
    const matched = COMMON_HSN_SAC_CODES.find(h => h.code === codeVal);
    if (matched) {
      setHsnCode(matched.code);
      setGstRate(matched.defaultGst);
      if (!name) {
        setName(matched.description.split('(')[0].trim());
      }
      setUnit(matched.defaultUnit);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Product name / description is required.');
      return;
    }
    if (!hsnCode.trim()) {
      setErrorMsg('HSN/SAC Code is required for GST compliance.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const prodToSave: ProductItem = {
        id: initialProduct?.id || `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        hsnCode: hsnCode.trim(),
        category: category.trim() || 'General Material',
        unit: unit.trim() || 'Bags',
        purchasePrice: Number(purchasePrice) || 0,
        salePrice: Number(salePrice) || 0,
        gstRate: gstRate,
        currentStock: Number(currentStock) || 0,
        minStockAlert: Number(minStockAlert) || 5,
        description: description.trim(),
        createdAt: initialProduct?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSave(prodToSave);
      onClose();
    } catch (err) {
      console.error('Error saving product:', err);
      setErrorMsg('Failed to save product. Please check values.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialProduct || !onDelete) return;
    if (window.confirm(`Are you sure you want to delete "${initialProduct.name}" from the product database?`)) {
      try {
        setIsSaving(true);
        await onDelete(initialProduct.id);
        onClose();
      } catch (err) {
        console.error('Error deleting product:', err);
        setErrorMsg('Failed to delete product.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-600/30 text-blue-400 rounded-lg">
              <Boxes className="w-4 h-4 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {isEditing ? 'Modify Product / Item Details' : 'Add New Product to Catalog'}
              </h3>
              <p className="text-[11px] text-slate-300">
                Configure HSN/SAC code, unit, GST %, buy/sale rates, and stock.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleFormSubmit} className="p-4 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Product Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Product / Item Name & Specification <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Auto-detects HSN/SAC</span>
            </div>
            <input
              type="text"
              required
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. UltraTech Cement 50kg OPC, River Sand (M-Sand), TMT 12mm Steel"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          {/* HSN/SAC Quick Suggestion & Manual Input */}
          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>GST HSN / SAC Code & Tax Slab <span className="text-rose-500">*</span></span>
              </label>
              <span className="text-[10px] font-mono text-slate-500">
                Selected: <strong className="text-blue-700">{hsnCode || 'None'}</strong> ({gstRate}%)
              </span>
            </div>

            {/* Quick HSN Dropdown / Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-600 font-medium mb-0.5">
                  Common Presets (Auto-fills Code & GST)
                </label>
                <select
                  onChange={e => handleSelectPredefinedHsn(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px] text-slate-700 focus:ring-1 focus:ring-blue-600"
                  defaultValue=""
                >
                  <option value="">-- Choose Standard HSN / SAC --</option>
                  {COMMON_HSN_SAC_CODES.map(h => (
                    <option key={h.code} value={h.code}>
                      {h.code} - {h.description.slice(0, 32)}... ({h.defaultGst}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[11px] text-slate-600 font-medium mb-0.5">
                    HSN/SAC Code
                  </label>
                  <input
                    type="text"
                    required
                    value={hsnCode}
                    onChange={e => setHsnCode(e.target.value)}
                    placeholder="252329"
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-600 text-center"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-600 font-medium mb-0.5">
                    GST Tax Slab
                  </label>
                  <select
                    value={gstRate}
                    onChange={e => setGstRate(parseInt(e.target.value) as TaxSlab)}
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-center bg-white"
                  >
                    {GST_SLABS.map(slab => (
                      <option key={slab} value={slab}>
                        {slab}% GST
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Unit, Category & Code */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Unit of Measure
              </label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
              >
                {COMMON_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Product Code / SKU
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="PRD-001"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-semibold uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Building Material"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sale Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={salePrice || ''}
                onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
                placeholder="350"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Purchase Price (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={purchasePrice || ''}
                onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
                placeholder="310"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Current Stock ({unit})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={currentStock || ''}
                onChange={e => setCurrentStock(parseFloat(e.target.value) || 0)}
                placeholder="100"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Min Stock Alert
              </label>
              <input
                type="number"
                min="0"
                value={minStockAlert || ''}
                onChange={e => setMinStockAlert(parseFloat(e.target.value) || 0)}
                placeholder="10"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>

          {/* Description / Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. 53 Grade High Performance Cement, 50kg HDPE laminated packing"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Product</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Product'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
