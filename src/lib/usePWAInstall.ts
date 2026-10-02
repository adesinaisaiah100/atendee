import { useState, useEffect, useCallback } from 'react';

/** Non-standard Chromium event — declared locally since lib.dom lacks it. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'atendee_pwa_dismissed_until';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Tracks PWA installability.
 * - Chromium (Android/desktop): captures `beforeinstallprompt` so our own
 *   banner can trigger the native install dialog.
 * - iOS Safari: no prompt event exists — caller should show manual
 *   "Share → Add to Home Screen" steps instead.
 * Banner stays hidden once installed or dismissed (30 days).
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return Date.now() < Number(localStorage.getItem(DISMISS_KEY) || 0);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback((days = 30) => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 86400000));
    } catch {
      /* storage unavailable — just hide for this session */
    }
    setDismissed(true);
    setDeferredPrompt(null);
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setInstalled(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const isIOS = isIOSDevice();
  return {
    /** Chromium fired the event and we can trigger the native dialog. */
    canNativeInstall: !installed && !dismissed && deferredPrompt !== null,
    /** iOS Safari: show manual Add-to-Home-Screen steps instead. */
    showIOSHelp: !installed && !dismissed && deferredPrompt === null && isIOS,
    install,
    dismiss,
  };
}
