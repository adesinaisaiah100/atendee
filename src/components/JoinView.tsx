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
} from 'lucide-react';
import { db } from '../lib/db';
import { generateUniqueCode } from '../lib/codeGenerator';
import { queueMutation, flushSyncQueue } from '../lib/syncEngine';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AtendeeLogo } from './AtendeeLogo';
import type { Fellowship, Member } from '../types';

interface JoinViewProps {
  slug: string;
}

const DEPARTMENTS = [
  'General',
  'Choir',
  'Ushering',
  'Media',
  'Technical',
  'Prayer',
  'Welfare',
  'Bible Study',
  'Children',
  'Youth',
  'Other',
] as const;

type ViewState = 'loading' | 'not-found' | 'form' | 'submitting' | 'success';

export const JoinView: React.FC<JoinViewProps> = ({ slug }) => {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [fellowship, setFellowship] = useState<Fellowship | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('General');
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
        // 1. Try Local Dexie Database first
        let found = await db.fellowships.where('slug').equals(slug.toLowerCase()).first();

        // 2. If not found locally, fetch from Supabase (for members joining on their own phone)
        if (!found && isSupabaseConfigured()) {
          const { data, error: sbError } = await supabase
            .from('fellowships')
            .select('*')
            .eq('slug', slug.toLowerCase())
            .maybeSingle();

          if (data && !sbError) {
            const fellowshipRecord: Fellowship = {
              id: data.id,
              name: data.name,
              slug: data.slug || slug.toLowerCase(),
              created_at: data.created_at,
            };
            found = fellowshipRecord;
            // Cache locally in Dexie
            await db.fellowships.put(fellowshipRecord);
          }
        }

        if (found) {
          setFellowship(found);
          setViewState('form');
          document.title = `Join ${found.name} — atendee`;
        } else {
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
    if (!trimmedName) {
      setError('Please enter your full name.');
      return;
    }

    setError('');
    setViewState('submitting');

    try {
      // 1. Check for duplicate name locally
      const existingMembers = await db.members
        .where('fellowship_id')
        .equals(fellowship.id)
        .toArray();

      const duplicate = existingMembers.some(
        m => m.full_name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (duplicate) {
        setError('A member with this name already exists. Please check with your admin or use a distinctive name.');
        setViewState('form');
        return;
      }

      // 2. Generate unique code
      const code = await generateUniqueCode(fellowship.id, fellowship.name);

      const newMember: Member = {
        id: crypto.randomUUID(),
        fellowship_id: fellowship.id,
        full_name: trimmedName,
        phone: phone.trim() || undefined,
        department: department || 'General',
        check_in_code: code,
        joined_at: new Date().toISOString().split('T')[0],
        is_active: true,
        created_at: new Date().toISOString(),
      };

      // 3. Save to local Dexie & queue sync
      await db.members.put(newMember);
      await queueMutation('member', 'insert', newMember);
      flushSyncQueue();

      setGeneratedCode(code);
      setViewState('success');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Something went wrong during registration. Please try again.');
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
                <span className="text-[11px] text-zinc-500 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. +234 803 123 4567"
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
                <Users className="w-3.5 h-3.5 text-yellow-400" />
                <span>Department / Unit</span>
                <span className="text-[11px] text-zinc-500 font-normal">(Optional)</span>
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition cursor-pointer"
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept} className="bg-zinc-900 text-white">
                    {dept}
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
    </div>
  );
};
