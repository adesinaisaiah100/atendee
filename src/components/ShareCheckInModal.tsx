import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Calendar } from 'lucide-react';
import type { Session } from '../types';

interface ShareCheckInModalProps {
  session: Session | null;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function getCheckInLink(sessionId: string): string {
  return `${window.location.origin}${window.location.pathname}#/checkin/${sessionId}`;
}

/**
 * Shows the self check-in QR + link for a LIVE session.
 * Members scan with their own phones — the link stops working
 * the moment the session is closed.
 */
export const ShareCheckInModal: React.FC<ShareCheckInModalProps> = ({
  session,
  eventName,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !session) return null;

  const link = getCheckInLink(session.id);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
          Self check-in · {eventName}
        </p>
        <p className="text-xs text-zinc-400 flex items-center justify-center gap-1.5 mt-1">
          <Calendar className="w-3.5 h-3.5 text-yellow-400" />
          <span>{session.session_date} · works while session is open</span>
        </p>

        <div className="bg-white rounded-2xl p-4 inline-block mt-4">
          <QRCodeSVG value={link} size={200} level="M" />
        </div>

        <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
          Members scan this with their own phones to check themselves in — including first-timers.
        </p>

        <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-3 overflow-hidden">
          <p className="text-[11px] font-mono text-zinc-400 truncate">{link}</p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full mt-3 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Link Copied!' : 'Copy Check-in Link'}</span>
        </button>
      </div>
    </div>
  );
};
