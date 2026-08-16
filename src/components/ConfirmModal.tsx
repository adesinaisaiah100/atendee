import React from 'react';
import { UserCheck, X, Check } from 'lucide-react';
import type { Member } from '../types';

interface ConfirmModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isCheckingIn?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  member,
  isOpen,
  onClose,
  onConfirm,
  isCheckingIn,
}) => {
  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-2 rounded-full hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Avatar */}
        <div className="w-20 h-20 mx-auto mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center shadow-inner">
          <UserCheck className="w-10 h-10" />
        </div>

        {/* Question */}
        <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/40">
          Check-In Verification
        </span>
        
        <h3 className="text-2xl font-bold text-white mt-3 mb-1">
          Are you {member.full_name}?
        </h3>
        
        <p className="text-slate-400 text-sm mb-6">
          {member.department ? `${member.department} Unit` : 'Fellowship Member'}
          {member.phone ? ` • ${member.phone}` : ''}
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-2xl font-semibold transition text-sm border border-slate-700"
          >
            No, Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCheckingIn}
            className="py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 active:scale-95 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-950"
          >
            <Check className="w-4 h-4" />
            {isCheckingIn ? 'Marking...' : 'Yes, Check In'}
          </button>
        </div>
      </div>
    </div>
  );
};
