import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Calendar, CheckCircle2, UserPlus, AlertCircle, Phone, WifiOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ConfirmModal } from './ConfirmModal';
import { AtendeeLogo } from './AtendeeLogo';
import { InstallPrompt } from './InstallPrompt';
import type { Member, Session, EventTemplate } from '../types';
import { db } from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getDeviceId } from '../lib/syncEngine';

interface CheckInViewProps {
  /** Rotatable session token from #/c/:token (preferred). */
  token?: string;
  /** Legacy raw session id from #/checkin/:sessionId. */
  sessionId?: string;
}

interface PublicSessionPayload {
  ok: boolean;
  reason?: string;
  session?: Session;
  event?: EventTemplate;
  members?: Member[];
  checked?: string[];
}

type ViewState = 'loading' | 'ended' | 'offline' | 'ready' | 'success';

const DEPARTMENTS = [
  'General', 'Choir', 'Ushering', 'Media', 'Technical',
  'Prayer', 'Welfare', 'Bible Study', 'Children', 'Youth', 'Other',
];

/**
 * Public self check-in via a session token (#/c/:token).
 *
 * All reads and writes go through SECURITY DEFINER RPCs, so the anon key has no
 * direct table access: the token only reveals one open session's roster, and the
 * server decides which fellowship a mark belongs to.
 */
export const CheckInView: React.FC<CheckInViewProps> = ({ token, sessionId }) => {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [activeToken, setActiveToken] = useState(token || '');
  const [session, setSession] = useState<Session | null>(null);
  const [event, setEvent] = useState<EventTemplate | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successName, setSuccessName] = useState('');
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [alreadyWas, setAlreadyWas] = useState(false);

  // New-member mini form
  const [showReg, setShowReg] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDept, setRegDept] = useState('General');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let resolved = token?.trim() || '';

      // Legacy link: the admin device may still hold the token locally.
      if (!resolved && sessionId) {
        const local = await db.sessions.get(sessionId);
        resolved = local?.share_token || '';
      }

      if (!resolved) {
        if (!cancelled) setViewState('ended');
        return;
      }

      if (!cancelled) setActiveToken(resolved);

      if (!navigator.onLine || !isSupabaseConfigured()) {
        if (!cancelled) setViewState('offline');
        return;
      }

      try {
        const { data, error } = await supabase.rpc('public_session', { p_token: resolved });
        if (cancelled) return;
        if (error) {
          console.error('Check-in load error:', error);
          setViewState('ended');
          return;
        }

        const payload = data as PublicSessionPayload | null;
        if (!payload?.ok || !payload.session) {
          setViewState('ended');
          return;
        }

        setSession(payload.session);
        setEvent(payload.event || null);
        setMembers(
          [...(payload.members || [])].sort((a, b) => a.full_name.localeCompare(b.full_name))
        );
        setCheckedInIds(new Set(payload.checked || []));
        setViewState('ready');
      } catch (err) {
        console.error('Check-in load error:', err);
        if (!cancelled) setViewState(navigator.onLine ? 'ended' : 'offline');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token, sessionId]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase().trim();
    return members.filter(
      m =>
        m.full_name.toLowerCase().includes(q) ||
        (m.check_in_code && m.check_in_code.toLowerCase().includes(q)) ||
        (m.phone && m.phone.includes(q))
    );
  }, [members, searchQuery]);

  const doCheckIn = async (memberId: string, name: string, code: string | null, wasAlready: boolean) => {
    if (!session || !activeToken) return;
    setIsCheckingIn(true);
    setActionError('');
    try {
      if (!wasAlready) {
        const { data, error } = await supabase.rpc('public_check_in', {
          p_token: activeToken,
          p_member_id: memberId,
          p_device_id: getDeviceId(),
        });

        if (error) throw error;

        const payload = data as { ok: boolean; reason?: string } | null;
        if (!payload?.ok) {
          if (payload?.reason === 'closed') {
            setViewState('ended');
          } else {
            setActionError('That check-in could not be saved. Please ask an admin to mark you present.');
          }
          return;
        }

        setCheckedInIds(prev => new Set(prev).add(memberId));
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.7 },
          colors: ['#facc15', '#f59e0b', '#fbbf24', '#ffffff'],
        });
      }
      setSuccessName(name);
      setSuccessCode(code);
      setAlreadyWas(wasAlready);
      setIsConfirmOpen(false);
      setSelectedMember(null);
      setViewState('success');
    } catch (err) {
      console.error('Self check-in error:', err);
      setActionError(
        navigator.onLine
          ? 'Could not reach the server. Please try again in a moment.'
          : 'You appear to be offline. Ask an admin to mark you on the attendance phone.'
      );
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleConfirmCheckIn = () => {
    if (!selectedMember) return;
    const wasAlready = checkedInIds.has(selectedMember.id);
    doCheckIn(selectedMember.id, selectedMember.full_name, null, wasAlready);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !activeToken || !regName.trim()) return;
    setRegError('');
    setIsRegistering(true);
    try {
      const name = regName.trim();

      const { data, error } = await supabase.rpc('public_join_session', {
        p_token: activeToken,
        p_full_name: name,
        p_phone: regPhone.trim() || null,
        p_department: regDept,
        p_device_id: getDeviceId(),
      });

      if (error) throw error;

      const payload = data as
        | { ok: boolean; error?: string; member_id?: string; full_name?: string; code?: string }
        | null;

      if (!payload?.ok || !payload.member_id) {
        setRegError(
          payload?.error === 'duplicate_name'
            ? 'That name is already on the roster — search for it above instead.'
            : 'Could not complete registration. Please try again.'
        );
        return;
      }

      const newMember: Member = {
        id: payload.member_id,
        fellowship_id: session.fellowship_id,
        full_name: payload.full_name || name,
        phone: regPhone.trim() || undefined,
        department: regDept,
        check_in_code: payload.code || '',
        joined_at: new Date().toISOString().split('T')[0],
        is_active: true,
        is_newcomer: true,
        created_at: new Date().toISOString(),
      };

      setMembers(prev =>
        [...prev.filter(m => m.id !== newMember.id), newMember].sort((a, b) =>
          a.full_name.localeCompare(b.full_name)
        )
      );
      setCheckedInIds(prev => new Set(prev).add(newMember.id));
      setShowReg(false);
      setRegName('');
      setRegPhone('');
      setSuccessName(newMember.full_name);
      setSuccessCode(payload.code || null);
      setAlreadyWas(false);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#facc15', '#f59e0b', '#fbbf24', '#ffffff'],
      });
      setViewState('success');
    } catch (err) {
      console.error('Link registration error:', err);
      setRegError(
        navigator.onLine
          ? 'Could not complete registration. Please try again.'
          : 'You are offline. Ask an admin to add you to the roster.'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  if (viewState === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-zinc-300">Loading check-in…</p>
      </div>
    );
  }

  if (viewState === 'ended') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white">Check-in Closed</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            This check-in link is no longer active — the session has ended or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  if (viewState === 'offline') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
            <WifiOff className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white">You're Offline</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Check-in needs a connection so the attendance phone sees you. Reconnect, then refresh this page — or ask
            an admin to mark you present.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm rounded-2xl transition cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (viewState === 'success') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center mx-auto border border-yellow-400/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              {alreadyWas ? 'Already Checked In' : "You're Checked In!"}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {successName} · {event?.name || 'Service'}
              {successCode ? ' · first-timer, welcome!' : ''}
            </p>
          </div>
          {successCode && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-1">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Your check-in code
              </p>
              <p className="text-2xl font-mono font-black text-yellow-400 tracking-widest">
                {successCode}
              </p>
              <p className="text-[11px] text-zinc-500">Keep it for 1-tap check-in next time.</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setViewState('ready')}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-sm rounded-2xl transition cursor-pointer"
          >
            Check In Someone Else
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-yellow-400 selection:text-black">
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
          <AtendeeLogo size="sm" showText={false} />
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-yellow-400 text-black">
            LIVE CHECK-IN
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 flex flex-col pb-12">
        <div className="text-center pt-2 pb-4">
          <p className="text-xs sm:text-sm text-zinc-400 flex items-center justify-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-yellow-400" />
            <span>
              {session && new Date(session.session_date).toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight text-balance break-words mt-1">
            {event ? event.name : 'Service Check-in'}
          </h1>
        </div>

        {actionError && (
          <p className="mb-4 text-xs font-bold text-rose-200 bg-rose-950/60 border border-rose-800/60 rounded-2xl p-3">
            {actionError}
          </p>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Type your name or code…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-4 bg-zinc-900 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white placeholder-zinc-500 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white rounded-full bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-2 flex-1">
          {filteredMembers.map(member => {
            const done = checkedInIds.has(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => { setSelectedMember(member); setIsConfirmOpen(true); }}
                disabled={done}
                className={`w-full text-left p-4 rounded-2xl border transition flex items-center justify-between gap-3 ${
                  done
                    ? 'bg-zinc-900 border-zinc-800 opacity-60 cursor-default'
                    : 'bg-zinc-900 hover:bg-zinc-800/90 border-zinc-800 active:scale-[0.99] cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-zinc-800 text-zinc-200 flex items-center justify-center font-black text-sm shrink-0">
                    {member.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold text-white truncate">{member.full_name}</div>
                    <div className="text-xs text-zinc-500 truncate">{member.department || 'General'}</div>
                  </div>
                </div>
                {done ? (
                  <span className="text-xs font-bold text-zinc-500 shrink-0">Present</span>
                ) : (
                  <span className="px-3.5 py-2 rounded-xl bg-yellow-400 text-black text-xs font-black shrink-0">
                    Check In
                  </span>
                )}
              </button>
            );
          })}

          {filteredMembers.length === 0 && !showReg && (
            <div className="p-6 text-center bg-zinc-900 border border-zinc-800 rounded-3xl space-y-2">
              <p className="text-sm font-bold text-white">
                {searchQuery ? `"${searchQuery}" isn't on the roster` : 'No names to show'}
              </p>
              <p className="text-xs text-zinc-500">New here? Register below and you're checked in.</p>
            </div>
          )}
        </div>

        {/* New-member registration */}
        <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-5">
          {!showReg ? (
            <button
              type="button"
              onClick={() => { setShowReg(true); setRegName(searchQuery); }}
              className="w-full py-3.5 text-zinc-200 hover:text-white font-bold text-sm rounded-2xl border border-zinc-800 hover:bg-zinc-800 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-yellow-400" />
              <span>New here? Register & Check In</span>
            </button>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <p className="text-sm font-black text-white">First-time registration</p>
              {regError && (
                <p className="text-xs font-bold text-rose-300 bg-rose-950/60 border border-rose-800/50 rounded-xl p-2.5">
                  {regError}
                </p>
              )}
              <input
                type="text"
                required
                placeholder="Full name"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white text-sm focus:outline-none"
                autoFocus
              />
              <div className="relative">
                <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="Phone / WhatsApp (optional)"
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white text-sm focus:outline-none"
                />
              </div>
              <select
                value={regDept}
                onChange={e => setRegDept(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white text-sm focus:outline-none cursor-pointer"
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReg(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering || !regName.trim()}
                  className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-black font-black text-xs rounded-xl transition cursor-pointer"
                >
                  {isRegistering ? 'Saving…' : 'Register & Check In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <ConfirmModal
        member={selectedMember}
        isOpen={isConfirmOpen}
        onClose={() => { setIsConfirmOpen(false); setSelectedMember(null); }}
        onConfirm={handleConfirmCheckIn}
        isCheckingIn={isCheckingIn}
      />

      <InstallPrompt />
    </div>
  );
};
