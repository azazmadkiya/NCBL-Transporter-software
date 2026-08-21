import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calculator, 
  X, 
  Copy, 
  Check, 
  Divide, 
  X as Multiply, 
  Minus, 
  Plus, 
  Equal, 
  Delete,
  Truck
} from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState<string>('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFreightMode, setIsFreightMode] = useState<boolean>(false);

  // Freight quick state
  const [weightMT, setWeightMT] = useState<string>('');
  const [ratePerMT, setRatePerMT] = useState<string>('');
  const [advance, setAdvance] = useState<string>('');
  const [gstRate, setGstRate] = useState<number>(5);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  }, []);

  const inputDigit = useCallback((digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(prev => (prev === '0' ? digit : prev + digit));
    }
  }, [waitingForOperand]);

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(prev => prev + '.');
    }
  }, [display, waitingForOperand]);

  const backspace = useCallback(() => {
    if (waitingForOperand) return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
    } else {
      setDisplay(prev => prev.slice(0, -1));
    }
  }, [display, waitingForOperand]);

  const performOperation = useCallback((nextOperator: string) => {
    const inputValue = parseFloat(display) || 0;

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operation) {
      const currentValue = prevValue;
      let newValue = currentValue;

      if (operation === '+') newValue = currentValue + inputValue;
      else if (operation === '-') newValue = currentValue - inputValue;
      else if (operation === '×' || operation === '*') newValue = currentValue * inputValue;
      else if (operation === '÷' || operation === '/') newValue = inputValue !== 0 ? currentValue / inputValue : 0;

      const formatted = parseFloat(newValue.toFixed(6));
      setPrevValue(formatted);
      setDisplay(String(formatted));
      setHistory(prev => [`${currentValue} ${operation} ${inputValue} = ${formatted}`, ...prev.slice(0, 5)]);
    }

    setWaitingForOperand(true);
    setOperation(nextOperator);
  }, [display, operation, prevValue]);

  const calculateEquals = useCallback(() => {
    if (operation === null || prevValue === null) return;

    const inputValue = parseFloat(display) || 0;
    const currentValue = prevValue;
    let newValue = currentValue;

    if (operation === '+') newValue = currentValue + inputValue;
    else if (operation === '-') newValue = currentValue - inputValue;
    else if (operation === '×' || operation === '*') newValue = currentValue * inputValue;
    else if (operation === '÷' || operation === '/') newValue = inputValue !== 0 ? currentValue / inputValue : 0;

    const formatted = parseFloat(newValue.toFixed(6));
    setDisplay(String(formatted));
    setHistory(prev => [`${currentValue} ${operation} ${inputValue} = ${formatted}`, ...prev.slice(0, 5)]);
    setPrevValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  }, [display, operation, prevValue]);

  const applyGst = (pct: number) => {
    const base = parseFloat(display) || 0;
    if (base <= 0) return;
    const tax = (base * pct) / 100;
    const total = base + tax;
    setDisplay(String(parseFloat(total.toFixed(2))));
    setHistory(prev => [`₹${base} + ${pct}% GST = ₹${total.toFixed(2)}`, ...prev.slice(0, 5)]);
    setWaitingForOperand(true);
  };

  const calculateFreight = () => {
    const w = parseFloat(weightMT) || 0;
    const r = parseFloat(ratePerMT) || 0;
    const adv = parseFloat(advance) || 0;
    const gross = w * r;
    const gst = (gross * gstRate) / 100;
    const bal = gross + gst - adv;
    setDisplay(String(parseFloat(bal.toFixed(2))));
    setHistory(prev => [`${w} MT × ₹${r} + ${gstRate}% GST - Adv ₹${adv} = ₹${bal.toFixed(2)}`, ...prev.slice(0, 5)]);
  };

  const copyResult = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); inputDigit(e.key); }
      else if (e.key === '.') { e.preventDefault(); inputDecimal(); }
      else if (e.key === '+') { e.preventDefault(); performOperation('+'); }
      else if (e.key === '-') { e.preventDefault(); performOperation('-'); }
      else if (e.key === '*') { e.preventDefault(); performOperation('×'); }
      else if (e.key === '/') { e.preventDefault(); performOperation('÷'); }
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calculateEquals(); }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, inputDigit, inputDecimal, performOperation, calculateEquals, backspace, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xs overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 px-3.5 py-2.5 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Calculator</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setIsFreightMode(!isFreightMode)}
              className={`text-[11px] px-2 py-0.5 rounded font-bold transition-all flex items-center space-x-1 ${
                isFreightMode ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Truck className="w-3 h-3" />
              <span>Freight MT</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Display */}
        <div className="p-3 bg-slate-950 border-b border-slate-800">
          <div className="text-right text-[11px] font-mono text-slate-400 h-4 truncate">
            {prevValue !== null && operation ? `${prevValue} ${operation}` : ''}
          </div>
          <div className="flex items-center justify-between mt-1">
            <button
              onClick={copyResult}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1 font-bold"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <div className="text-2xl font-bold font-mono text-white tracking-wider truncate text-right">
              {display}
            </div>
          </div>
        </div>

        {/* Quick GST buttons */}
        <div className="px-3 py-1.5 bg-slate-850 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-300">
          <span className="text-slate-400">ADD GST:</span>
          <div className="flex items-center space-x-1.5">
            <button onClick={() => applyGst(5)} className="px-2 py-0.5 rounded bg-blue-900/50 hover:bg-blue-800 text-blue-300 border border-blue-700/50">+5%</button>
            <button onClick={() => applyGst(12)} className="px-2 py-0.5 rounded bg-blue-900/50 hover:bg-blue-800 text-blue-300 border border-blue-700/50">+12%</button>
            <button onClick={() => applyGst(18)} className="px-2 py-0.5 rounded bg-blue-900/50 hover:bg-blue-800 text-blue-300 border border-blue-700/50">+18%</button>
          </div>
        </div>

        {/* Freight Mode Form vs Standard Pad */}
        {isFreightMode ? (
          <div className="p-3 space-y-2 text-xs">
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">WEIGHT (MT / TONS)</label>
              <input
                type="number"
                placeholder="e.g. 28.5"
                value={weightMT}
                onChange={e => setWeightMT(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-0.5">RATE / MT (₹)</label>
              <input
                type="number"
                placeholder="e.g. 1450"
                value={ratePerMT}
                onChange={e => setRatePerMT(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-0.5">ADVANCE (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={advance}
                  onChange={e => setAdvance(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-0.5">GST %</label>
                <select
                  value={gstRate}
                  onChange={e => setGstRate(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-bold text-xs focus:outline-none"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                </select>
              </div>
            </div>
            <button
              onClick={calculateFreight}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded text-xs mt-1"
            >
              Calculate Freight & Balance
            </button>
          </div>
        ) : (
          <div className="p-2.5 grid grid-cols-4 gap-1.5 text-xs font-bold">
            <button onClick={clearAll} className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 py-2 rounded">AC</button>
            <button onClick={backspace} className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded flex items-center justify-center"><Delete className="w-3.5 h-3.5" /></button>
            <button onClick={() => setDisplay(prev => String((parseFloat(prev) || 0) / 100))} className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded">%</button>
            <button onClick={() => performOperation('÷')} className="bg-blue-900/70 hover:bg-blue-800 text-blue-200 py-2 rounded flex items-center justify-center"><Divide className="w-3.5 h-3.5" /></button>

            <button onClick={() => inputDigit('7')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">7</button>
            <button onClick={() => inputDigit('8')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">8</button>
            <button onClick={() => inputDigit('9')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">9</button>
            <button onClick={() => performOperation('×')} className="bg-blue-900/70 hover:bg-blue-800 text-blue-200 py-2 rounded flex items-center justify-center"><Multiply className="w-3.5 h-3.5" /></button>

            <button onClick={() => inputDigit('4')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">4</button>
            <button onClick={() => inputDigit('5')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">5</button>
            <button onClick={() => inputDigit('6')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">6</button>
            <button onClick={() => performOperation('-')} className="bg-blue-900/70 hover:bg-blue-800 text-blue-200 py-2 rounded flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>

            <button onClick={() => inputDigit('1')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">1</button>
            <button onClick={() => inputDigit('2')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">2</button>
            <button onClick={() => inputDigit('3')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">3</button>
            <button onClick={() => performOperation('+')} className="bg-blue-900/70 hover:bg-blue-800 text-blue-200 py-2 rounded flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>

            <button onClick={() => inputDigit('0')} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm col-span-2">0</button>
            <button onClick={inputDecimal} className="bg-slate-800 hover:bg-slate-700 text-white py-2 rounded font-mono text-sm">.</button>
            <button onClick={calculateEquals} className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded flex items-center justify-center"><Equal className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* History snippet */}
        {history.length > 0 && (
          <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span className="truncate">Last: {history[0]}</span>
            <button onClick={() => setHistory([])} className="text-slate-500 hover:text-slate-300 ml-1">clear</button>
          </div>
        )}
      </div>
    </div>
  );
};
