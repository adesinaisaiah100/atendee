import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Calendar, CheckCircle2, UserPlus, AlertCircle, Phone } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ConfirmModal } from './ConfirmModal';
import { AtendeeLogo } from './AtendeeLogo';
import { InstallPrompt } from './InstallPrompt';
import type { Member, Session, EventTemplate } from '../types';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import { queueMutation, checkInMemberOptimistic } from '../lib/syncEngine';
import { generateUniqueCode } from '../lib/codeGenerator';

interface CheckInViewProps {
  sessionId: string;
}

type ViewState = 'loading' | 'ended' | 'ready' | 'success';

const DEPARTMENTS = [
  'General', 'Choir', 'Ushering', 'Media', 'Technical',
  'Prayer', 'Welfare', 'Bible Study', 'Children', 'Youth', 'Other',
];

/**
 * Public self check-in via shared session link (#/checkin/:sessionId).
 * No login required. Only works while the session is OPEN — once the
 * admin ends it, this screen switches to an "ended" state, so forwarded
 * links can't fake attendance later.
 */
export const CheckInView: React.FC<CheckInViewProps> = ({ sessionId }) => {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [event, setEvent] = useState<EventTemplate | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
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
    async function load() {
      if (!sessionId) {
        setViewState('ended');
        return;
      }
      try {
        const { data: sess, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .maybeSingle();
        if (error || !sess || (sess as Session).status !== 'open') {
          setViewState('ended');
          return;
        }
        const s = sess as Session;
        setSession(s);

        const [{ data: ev }, { data: mems }, { data: recs }] = await Promise.all([
          supabase.from('events').select('*').eq('id', s.event_id).maybeSingle(),
          supabase.from('members').select('*').eq('fellowship_id', s.fellowship_id).eq('is_active', true),
          supabase.from('attendance_records').select('member_id').eq('session_id', s.id),
        ]);

        if (ev) setEvent(ev as EventTemplate);
        if (mems) {
          const list = (mems as Member[]).sort((a, b) => a.full_name.localeCompare(b.full_name));
          setMembers(list);
          // Cache roster locally so the device stays usable offline-ish
          try { await db.members.bulkPut(list); } catch { /* ignore */ }
        }
        if (recs) setCheckedInIds(new Set((recs as { member_id: string }[]).map(r => r.member_id)));
        setViewState('ready');
      } catch (err) {
        console.error('Check-in load error:', err);
        setViewState('ended');
      }
    }
    load();
  }, [sessionId]);

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
    if (!session) return;
    setIsCheckingIn(true);
    try {
      if (!wasAlready) {
        await checkInMemberOptimistic(session.id, memberId, 'self');
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
    if (!session || !regName.trim()) return;
    setRegError('');
    setIsRegistering(true);
    try {
      const name = regName.trim();
      if (members.some(m => m.full_name.toLowerCase() === name.toLowerCase())) {
        setRegError('That name is already on the roster — search for it above instead.');
        setIsRegistering(false);
        return;
      }
      const code = await generateUniqueCode(session.fellowship_id, event?.name || 'Fellowship');
      const newMember: Member = {
        id: crypto.randomUUID(),
        fellowship_id: session.fellowship_id,
        full_name: name,
        phone: regPhone.trim() || undefined,
        department: regDept,
        check_in_code: code,
        joined_at: new Date().toISOString().split('T')[0],
        is_active: true,
        is_newcomer: true,
        created_at: new Date().toISOString(),
      };
      try { await db.members.put(newMember); } catch { /* ignore */ }
      await queueMutation('member', 'insert', newMember);
      try { await supabase.from('members').insert(newMember); } catch (err) {
        console.warn('Link-reg member insert error:', err);
      }
      setMembers(prev => [...prev, newMember].sort((a, b) => a.full_name.localeCompare(b.full_name)));
      setShowReg(false);
      setRegName('');
      setRegPhone('');
      await doCheckIn(newMember.id, newMember.full_name, code, false);
    } catch (err) {
      console.error('Link registration error:', err);
      setRegError('Could not complete registration. Please try again.');
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
