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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Avatar */}
        <div className="w-20 h-20 mx-auto mb-4 bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 rounded-3xl flex items-center justify-center shadow-inner">
          <UserCheck className="w-10 h-10" />
        </div>

        {/* Question */}
        <span className="text-[11px] uppercase tracking-wider font-black text-yellow-400 bg-yellow-950/60 px-3 py-1 rounded-full border border-yellow-800/40">
          Check-In Verification
        </span>
        
        <h3 className="text-2xl font-black text-white mt-3 mb-1">
          Are you {member.full_name}?
        </h3>
        
        <p className="text-zinc-400 text-xs sm:text-sm mb-6">
          {member.department ? `${member.department} Unit` : 'Member'}
          {member.phone ? ` • ${member.phone}` : ''}
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-3.5 px-4 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 rounded-2xl font-bold transition text-xs border border-zinc-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCheckingIn}
            className="py-3.5 px-4 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black rounded-2xl font-black transition flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-yellow-950/40 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isCheckingIn ? 'Marking...' : 'Yes, That\'s Me'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
