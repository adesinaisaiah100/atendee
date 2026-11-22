import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Calendar, Share2 } from 'lucide-react';
import type { Session } from '../types';

interface ShareCheckInModalProps {
  session: Session | null;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Token link, not a raw session id. Tokens are rotatable server-side, so a link
 * that leaks into a group chat can be killed without recreating the session.
 */
export function getCheckInLink(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/c/${token}`;
}

/**
 * Shows the self check-in QR + link for a LIVE session. Members scan with their
 * own phones — the link stops working the moment the session is closed.
 */
export const ShareCheckInModal: React.FC<ShareCheckInModalProps> = ({
  session,
  eventName,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !session) return null;

  const token = session.share_token || '';
  const link = token ? getCheckInLink(token) : '';

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleShare = async () => {
    if (!link) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${eventName} check-in`,
          text: `Check in for ${eventName} (${session.session_date}):`,
          url: link,
        });
      } else {
        await handleCopy();
      }
    } catch {
      /* user dismissed the share sheet */
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

        {token ? (
          <>
            <div className="bg-white rounded-2xl p-4 inline-block mt-4">
              <QRCodeSVG value={link} size={232} level="M" marginSize={2} />
            </div>

            <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
              Members scan this with their own phones to check themselves in — including first-timers.
            </p>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 mt-3 overflow-hidden">
              <p className="text-[11px] font-mono text-zinc-400 truncate">{link}</p>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                aria-label="Share check-in link"
                className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-2xl transition active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-bold text-white">Link not ready yet</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This session needs one online sync before it gets its share code. Connect this device to the internet
              and reopen this sheet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
