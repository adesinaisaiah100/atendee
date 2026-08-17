import React, { useState } from 'react';
import {
  Lock,
  Building2,
  Sparkles,
  ArrowRight,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import type { Fellowship, Session, EventTemplate } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';

interface LoginViewProps {
  fellowship: Fellowship | null;
  activeSession: Session | null;
  activeEvent: EventTemplate | null;
  onLoginSuccess: () => void;
  onLaunchKioskDirect: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  fellowship,
  activeSession,
  activeEvent,
  onLoginSuccess,
  onLaunchKioskDirect,
}) => {
  const isFirstTimeSetup = !fellowship || fellowship.name === 'My Fellowship';
  const [fellowshipName, setFellowshipName] = useState(
    fellowship?.name !== 'My Fellowship' ? fellowship?.name || '' : ''
  );
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fellowshipName.trim()) {
      setError('Please enter your fellowship or church name.');
      return;
    }
    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN code.');
      return;
    }

    const updatedFellowship: Fellowship = {
      id: fellowship?.id || 'f0000000-0000-0000-0000-000000000001',
      name: fellowshipName.trim(),
      pin_code: pin,
      created_at: new Date().toISOString(),
    };

    await db.fellowships.put(updatedFellowship);
    await queueMutation('fellowship', 'insert', updatedFellowship);
    onLoginSuccess();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = fellowship?.pin_code || '1234';
    if (pin === correctPin) {
      onLoginSuccess();
    } else {
      setError('Incorrect 4-digit PIN code.');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 selection:bg-yellow-400 selection:text-black">
      {/* Background Yellow Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-yellow-400 text-black flex items-center justify-center mx-auto shadow-lg shadow-yellow-950/50 font-black">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isFirstTimeSetup ? 'Setup Fellowship' : fellowship?.name}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            {isFirstTimeSetup
              ? 'Enter your fellowship name and a 4-digit admin PIN to get started.'
              : 'Enter your 4-digit PIN to access admin tools.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-800/60 rounded-xl text-rose-300 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {/* Setup Form (First Time) */}
        {isFirstTimeSetup ? (
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-yellow-400" />
                <span>Fellowship / Church Name</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Grace Assembly or Youth Fellowship"
                value={fellowshipName}
                onChange={e => {
                  setFellowshipName(e.target.value);
                  setError(null);
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-yellow-400" />
                <span>Create 4-Digit Admin PIN</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                required
                placeholder="e.g. 1234"
                value={pin}
                onChange={e => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-center font-mono text-xl tracking-widest focus:outline-none transition"
              />
              <span className="text-[11px] text-zinc-500 block mt-1">
                Used to lock admin settings when passing the phone to members.
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-950/40 border border-yellow-300/40 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Login Form (Returning Admin) */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center justify-center gap-1.5">
                <Lock className="w-4 h-4 text-yellow-400" />
                <span>Enter 4-Digit Admin PIN</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                required
                placeholder="••••"
                value={pin}
                onChange={e => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                className="w-full px-4 py-3.5 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-center font-mono text-2xl tracking-widest focus:outline-none transition"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-950/40 border border-yellow-300/40 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Unlock Admin Hub</span>
            </button>

            {/* Direct Kiosk Shortcut if active session exists */}
            {activeSession && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onLaunchKioskDirect}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2 border border-zinc-700"
                >
                  <Smartphone className="w-4 h-4 text-yellow-400" />
                  <span>Pass Phone ({activeEvent?.name || 'Live Service'})</span>
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
