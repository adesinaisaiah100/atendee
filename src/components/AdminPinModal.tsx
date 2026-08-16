import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin?: string;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPin = '1234',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
      if (newPin.length === 4) {
        if (newPin === correctPin) {
          setTimeout(() => {
            setPin('');
            onSuccess();
          }, 150);
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
          }, 600);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xs bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-2 rounded-full hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 mx-auto mb-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-bold text-white mb-0.5">Admin Security Lock</h3>
        <p className="text-slate-400 text-xs mb-4">Enter 4-digit PIN to exit Check-in Mode (Default: 1234)</p>

        {/* PIN Indicators */}
        <div className={`flex justify-center gap-3 mb-6 ${error ? 'animate-bounce text-rose-500' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                pin.length > i
                  ? error
                    ? 'bg-rose-500 border-rose-500 scale-110'
                    : 'bg-emerald-400 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/50'
                  : 'border-slate-600 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-rose-400 text-xs font-semibold -mt-3 mb-4">Incorrect PIN code</p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-12 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-white font-bold text-lg rounded-2xl border border-slate-700/60 transition shadow"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="h-12 bg-slate-800/40 hover:bg-slate-800 text-slate-400 font-semibold text-xs rounded-2xl border border-slate-700/40 transition"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-white font-bold text-lg rounded-2xl border border-slate-700/60 transition shadow"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 bg-slate-800/40 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-2xl border border-slate-700/40 transition flex items-center justify-center"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
};
