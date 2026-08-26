import React, { useState } from 'react';
import { Lock, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { verifyPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsVerifying(true);
    setError(false);

    try {
      const isValid = await verifyPassword(password);
      if (isValid) {
        setPassword('');
        onSuccess();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 mx-auto bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 rounded-2xl flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>

        <div>
          <h3 className="text-lg font-black text-white">Admin Exit</h3>
          <p className="text-xs text-zinc-400 mt-1">Enter your admin password to return to Hub</p>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/80 border border-rose-800/60 rounded-xl text-rose-300 text-xs font-bold animate-shake">
            Incorrect password. Please try again.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Admin password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setError(false);
              }}
              className="w-full px-4 py-3 pr-10 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1 rounded-md"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isVerifying || !password}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-950/40 cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Unlock Admin Hub</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
