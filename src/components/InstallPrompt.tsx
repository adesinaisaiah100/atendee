import React, { useState } from 'react';
import { Download, X, Share, Plus, Check } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

/**
 * Floating "Install as app" prompt.
 * - Android/desktop Chromium: banner with a working Install button
 *   (drives the captured `beforeinstallprompt` event).
 * - iPhone/iPad Safari: step-by-step Add to Home Screen guidance.
 * Hidden when already installed (standalone) or dismissed.
 */
export const InstallPrompt: React.FC = () => {
  const { canNativeInstall, showIOSHelp, install, dismiss } = usePWAInstall();
  const [isInstalling, setIsInstalling] = useState(false);

  if (!canNativeInstall && !showIOSHelp) return null;

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-40 animate-in slide-in-from-bottom-4 fade-in">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-black text-white leading-snug">
                Install atendee as an app
              </h3>
              <button
                type="button"
                onClick={() => dismiss()}
                className="p-1 text-zinc-500 hover:text-white rounded-lg transition shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {canNativeInstall ? (
              <>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Add it to your home screen for 1-tap check-in and offline access.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-black font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    {isInstalling ? (
                      <span>Installing…</span>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Install App</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss()}
                    className="px-4 py-2.5 text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Not now
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-zinc-400 mt-2 space-y-1.5 leading-relaxed">
                  <p className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-200 text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                    <span>Tap <Share className="w-3.5 h-3.5 inline text-yellow-400" /> <strong className="text-zinc-200">Share</strong> in the Safari toolbar</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-200 text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                    <span>Tap <Plus className="w-3.5 h-3.5 inline text-yellow-400" /> <strong className="text-zinc-200">Add to Home Screen</strong></span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss()}
                  className="w-full mt-3 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs rounded-xl transition active:scale-95 cursor-pointer"
                >
                  Got it
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
