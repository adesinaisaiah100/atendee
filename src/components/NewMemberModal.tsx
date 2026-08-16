import React, { useState } from 'react';
import { UserPlus, X, Send } from 'lucide-react';

interface NewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, phone?: string) => Promise<void>;
}

export const NewMemberModal: React.FC<NewMemberModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(name, phone);
      setName('');
      setPhone('');
      onClose();
    } catch (err) {
      setError('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-2 rounded-full hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 mx-auto mb-4 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-2xl flex items-center justify-center">
          <UserPlus className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-center text-white mb-1">
          Welcome! Can't find your name?
        </h3>
        <p className="text-slate-400 text-xs text-center mb-5">
          Enter your details below to check in today. An administrator will verify and add you to the registry.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800/50 rounded-xl text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Oluwatimileyin Isaiah"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Phone Number <span className="text-slate-500 font-normal">(Optional, for follow-up)</span>
            </label>
            <input
              type="tel"
              placeholder="e.g. +234 802 345 6789"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-950"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Check In Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
