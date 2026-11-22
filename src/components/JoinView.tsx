import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Users,
  AlertCircle,
  Clipboard,
  Check,
  Phone,
  User,
  Sparkles,
  ArrowRight,
  Home,
  DoorOpen,
} from 'lucide-react';
import { db } from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UNITS, DEFAULT_UNIT, COMMON_HOSTELS } from '../lib/constants';
import { AtendeeLogo } from './AtendeeLogo';
import { InstallPrompt } from './InstallPrompt';
import type { Fellowship } from '../types';

interface JoinViewProps {
  slug: string;
}

interface PublicJoinPayload {
  ok: boolean;
  error?: string;
  member_id?: string;
  full_name?: string;
  code?: string;
}

type ViewState = 'loading' | 'not-found' | 'form' | 'submitting' | 'success';

export const JoinView: React.FC<JoinViewProps> = ({ slug }) => {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [fellowship, setFellowship] = useState<Fellowship | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hostel, setHostel] = useState('');
  const [roomOrBlock, setRoomOrBlock] = useState('');
  const [department, setDepartment] = useState<string>(DEFAULT_UNIT);
  const [error, setError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function lookupFellowship() {
      if (!slug) {
        setViewState('not-found');
        return;
      }

      try {
        const normalized = slug.toLowerCase();

        // Offline / returning visitor: the device may already know this fellowship.
        const cached = await db.fellowships.where('slug').equals(normalized).first();
        if (cached) {
          setFellowship(cached);
          setViewState('form');
          document.title = `Join ${cached.name} — atendee`;
        }

        if (!isSupabaseConfigured() || !navigator.onLine) {
          if (!cached) setViewState('not-found');
          return;
        }

        const { data, error: sbError } = await supabase.rpc('public_fellowship', { p_slug: normalized });
        const payload = data as { ok: boolean; id?: string; name?: string; slug?: string } | null;

        if (!sbError && payload?.ok && payload.id && payload.name) {
          const fellowshipRecord: Fellowship = {
            id: payload.id,
            name: payload.name,
            slug: payload.slug || normalized,
            created_at: new Date().toISOString(),
          };
          setFellowship(fellowshipRecord);
          setViewState('form');
          document.title = `Join ${fellowshipRecord.name} — atendee`;
          try { await db.fellowships.put(fellowshipRecord); } catch { /* ignore */ }
        } else if (!cached) {
          setViewState('not-found');
          document.title = `Fellowship Not Found — atendee`;
        }
      } catch (err) {
        console.error('Error looking up fellowship:', err);
        setViewState('not-found');
      }
    }

    lookupFellowship();

    return () => {
      document.title = 'atendee — Modern Attendance & Gathering Management';
    };
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fellowship) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedHostel = hostel.trim();
    const trimmedRoom = roomOrBlock.trim();

    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }
    if (!trimmedPhone) {
      setError('Please enter your phone number.');
      return;
    }
    if (!trimmedHostel) {
      setError('Please enter your hostel or hall of residence.');
      return;
    }

    setError('');
    setViewState('submitting');

    try {
      let rpcRes = await supabase.rpc('public_join', {
        p_slug: slug.toLowerCase(),
        p_full_name: trimmedName,
        p_phone: trimmedPhone,
        p_department: department || DEFAULT_UNIT,
        p_hostel: trimmedHostel,
        p_room_or_block: trimmedRoom || null,
      });

      // Fallback if Postgres RPC has not yet been updated with p_hostel / p_room_or_block
      if (rpcRes.error && (rpcRes.error.code === 'PGRST202' || rpcRes.error.message?.includes('public_join'))) {
        rpcRes = await supabase.rpc('public_join', {
          p_slug: slug.toLowerCase(),
          p_full_name: trimmedName,
          p_phone: trimmedPhone,
          p_department: department || DEFAULT_UNIT,
        });
      }

      const { data, error: sbError } = rpcRes;

      if (sbError) throw sbError;

      const payload = data as PublicJoinPayload | null;

      if (!payload?.ok || !payload.code) {
        setError(
          payload?.error === 'duplicate_name'
            ? 'That name is already registered. Ask your admin to look up your existing code, or add a middle name.'
            : payload?.error === 'not_found'
              ? 'This fellowship link is no longer valid. Please confirm it with your admin.'
              : 'Something went wrong during registration. Please try again.'
        );
        setViewState(payload?.error === 'not_found' ? 'not-found' : 'form');
        return;
      }

      setGeneratedCode(payload.code);
      setViewState('success');
    } catch (err) {
      console.error('Registration error:', err);
      setError(
        navigator.onLine
          ? 'Something went wrong during registration. Please try again.'
          : 'You are offline. Please reconnect and try again.'
      );
      setViewState('form');
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-zinc-300">Loading registration...</p>
      </div>
    );
  }

  if (viewState === 'not-found') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white">Fellowship Not Found</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The link you opened doesn't match any registered fellowship. Please confirm the link with your fellowship admin.
          </p>
          <div className="pt-2">
            <a
              href="#/"
              className="inline-flex items-center gap-2 text-xs font-bold text-yellow-400 hover:underline"
            >
              <span>Go to atendee Home</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 selection:bg-yellow-400 selection:text-black">
      {/* Subtle Yellow Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <AtendeeLogo size="md" showText={true} />
          <div>
            <h2 className="text-lg font-black text-white">
              Join {fellowship?.name || 'Fellowship'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Fill in your details to get your personal attendance code.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-800/60 rounded-xl text-rose-300 text-xs font-bold text-center">
            {error}
          </div>
        )}

        {/* ===== REGISTRATION SUCCESS SCREEN ===== */}
        {viewState === 'success' ? (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20 shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white mb-1">You're Registered!</h3>
              <p className="text-xs text-zinc-400">
                Welcome to {fellowship?.name}. Here is your unique attendance code:
              </p>
            </div>

            {/* Big Code Card */}
            <div className="bg-zinc-950 border-2 border-yellow-400/40 rounded-2xl p-5 space-y-3 shadow-inner">
              <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase block">
                Your Check-in Code
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-yellow-400 tracking-widest">
                {generatedCode}
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-zinc-800 active:scale-95 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Clipboard className="w-4 h-4 text-yellow-400" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Instruction Callout */}
            <div className="bg-yellow-950/30 border border-yellow-800/40 rounded-2xl p-3.5 text-left text-xs text-yellow-200/90 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-yellow-300">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Save or Screenshot this code!
              </p>
              <p className="text-[11px] text-zinc-400">
                During services, type this code on the circulating phone to instantly record your attendance.
              </p>
            </div>

            <div className="pt-1 text-[11px] text-zinc-500">
              Forgot your code later? Ask your fellowship admin to look it up for you.
            </div>
          </div>
        ) : (
          /* ===== REGISTRATION FORM ===== */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-yellow-400" />
                <span>Full Name</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Adesina Oluwatimi"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-yellow-400" />
                <span>Phone Number</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 0803 123 4567"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-yellow-400" />
                <span>Hostel / Hall of Residence</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                list="join-hostel-suggestions"
                placeholder="e.g. Tedder Hall, Off-Campus"
                value={hostel}
                onChange={e => {
                  setHostel(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
              />
              <datalist id="join-hostel-suggestions">
                {COMMON_HOSTELS.map(h => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-yellow-400" />
                <span>Room / Block</span>
                <span className="text-[11px] text-zinc-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Block B, Room 14"
                value={roomOrBlock}
                onChange={e => setRoomOrBlock(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-yellow-400" />
                <span>Unit / Department</span>
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition cursor-pointer"
              >
                {UNITS.map(unit => (
                  <option key={unit} value={unit} className="bg-zinc-900 text-white">
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={viewState === 'submitting'}
              className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-950/40 border border-yellow-300/40 cursor-pointer disabled:opacity-50"
            >
              {viewState === 'submitting' ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Register &amp; Get Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center text-[11px] text-zinc-500">
              Already registered? Ask your admin to look up your code anytime.
            </div>
          </form>
        )}
      </div>

      <InstallPrompt />
    </div>
  );
};
