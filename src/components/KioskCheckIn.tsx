import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  Lock,
  Calendar,
  X,
  Sparkles,
  UserPlus,
  Phone,
  Briefcase,
  PartyPopper,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ConfirmModal } from './ConfirmModal';
import { AdminPasswordModal } from './AdminPasswordModal';
import { AtendeeLogo } from './AtendeeLogo';
import type { Member, Session, EventTemplate, AttendanceRecord } from '../types';
import { db } from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { queueMutation, checkInMemberOptimistic } from '../lib/syncEngine';
import { generateUniqueCode } from '../lib/codeGenerator';

interface KioskCheckInProps {
  session: Session | null;
  event: EventTemplate | null;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  fellowshipName?: string;
  fellowshipId?: string;
  onRefresh?: () => void;
  onExitKiosk: () => void;
}

export const KioskCheckIn: React.FC<KioskCheckInProps> = ({
  session,
  event,
  members,
  attendanceRecords,
  fellowshipName,
  fellowshipId,
  onRefresh,
  onExitKiosk,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPinOpen, setIsPinOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Self-Registration States
  const [isQuickRegOpen, setIsQuickRegOpen] = useState(false);
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDepartment, setRegDepartment] = useState('General');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [registeredMemberCode, setRegisteredMemberCode] = useState<string | null>(null);
  const [registeredMemberName, setRegisteredMemberName] = useState<string | null>(null);

  // Set of checked in member IDs for this specific session
  const checkedInMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    if (!session) return map;
    for (const r of attendanceRecords) {
      if (r.session_id === session.id) {
        map.set(r.member_id, r);
      }
    }
    return map;
  }, [session, attendanceRecords]);

  // Active members sorted alphabetically by full_name
  const activeMembers = useMemo(() => {
    return members
      .filter(m => m.is_active)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [members]);

  // Filtered members based on search (Supports name, code, phone, department)
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return activeMembers;
    const q = searchQuery.toLowerCase().trim();
    return activeMembers.filter(
      m =>
        m.full_name.toLowerCase().includes(q) ||
        (m.check_in_code && m.check_in_code.toLowerCase().includes(q)) ||
        (m.phone && m.phone.includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q))
    );
  }, [activeMembers, searchQuery]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleMemberTap = (member: Member) => {
    if (checkedInMap.has(member.id)) return; // Already checked in
    setSelectedMember(member);
    setIsConfirmOpen(true);
  };

  const handleConfirmCheckIn = async () => {
    if (!selectedMember || !session) return;
    setIsCheckingIn(true);
    try {
      await checkInMemberOptimistic(session.id, selectedMember.id, 'self');
      setIsConfirmOpen(false);
      
      // Fire celebration confetti with Yellow & Gold
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.8 },
        colors: ['#facc15', '#f59e0b', '#fbbf24', '#ffffff'],
      });

      showToast(`🎉 Checked in: ${selectedMember.full_name}`);
      setSelectedMember(null);
      onRefresh?.();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleOpenQuickRegister = (prefillName = '') => {
    setRegFullName(prefillName);
    setRegPhone('');
    setRegDepartment('General');
    setRegisteredMemberCode(null);
    setRegisteredMemberName(null);
    setIsQuickRegOpen(true);
  };

  const handleQuickRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !session) return;

    setIsSubmittingReg(true);
    try {
      const fId = fellowshipId || session.fellowship_id;
      const fName = fellowshipName || event?.name || 'Fellowship';
      const code = await generateUniqueCode(fId, fName);

      const newMember: Member = {
        id: crypto.randomUUID(),
        fellowship_id: fId,
        full_name: regFullName.trim(),
        phone: regPhone.trim() || undefined,
        department: regDepartment.trim() || 'General',
        check_in_code: code,
        joined_at: new Date().toISOString().split('T')[0],
        is_active: true,
        created_at: new Date().toISOString(),
      };

      // 1. Save Member Locally in Dexie
      await db.members.put(newMember);
      await queueMutation('member', 'insert', newMember);

      // 2. Direct Supabase Cloud Save
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('members').insert(newMember);
        } catch (err) {
          console.warn('Direct member insert error:', err);
        }
      }

      // 3. Immediately Check In for Today's Session
      await checkInMemberOptimistic(session.id, newMember.id, 'self');

      // 4. Confetti Blast!
      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.7 },
        colors: ['#facc15', '#f59e0b', '#fbbf24', '#ffffff'],
      });

      setRegisteredMemberCode(code);
      setRegisteredMemberName(newMember.full_name);
      showToast(`🎉 Welcome ${newMember.full_name}! Checked in.`);
      setSearchQuery('');
      onRefresh?.();
    } catch (err) {
      console.error('Quick registration failed:', err);
      alert('Could not complete registration. Please try again.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-zinc-950">
        <div className="w-16 h-16 bg-yellow-400/10 text-yellow-400 rounded-2xl flex items-center justify-center mb-4 border border-yellow-400/30">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Active Session</h2>
        <p className="text-zinc-400 text-sm max-w-sm mb-6">
          There is no open attendance session right now.
        </p>
        <button
          onClick={onExitKiosk}
          className="px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-2xl transition shadow-lg cursor-pointer"
        >
          Return to Events
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-yellow-400 selection:text-black">
      {/* Top Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AtendeeLogo size="sm" showText={false} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white leading-tight">
                  {event ? event.name : 'Attendance Check-in'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-400 text-black">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-yellow-400" />
                <span>
                  {session
                    ? new Date(session.session_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : "Today's Gathering"}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPinOpen(true)}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition border border-zinc-700 active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="Admin Exit"
          >
            <Lock className="w-4 h-4 text-yellow-400" />
            <span className="hidden sm:inline">Admin Exit</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 flex flex-col pb-12">
        {/* PROMINENT QUICK-REGISTER CALLOUT BANNER */}
        <div className="bg-gradient-to-r from-zinc-900 via-yellow-950/20 to-zinc-900 border border-yellow-500/30 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl flex items-center justify-between gap-3 shadow-md mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-black text-white truncate">
                Can't find your name?
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 truncate mt-0.5">
              First time here or not listed? Tap to add yourself in 5 seconds.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenQuickRegister(searchQuery)}
            className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs sm:text-xs rounded-xl sm:rounded-2xl transition shadow-md shadow-yellow-950/40 active:scale-95 whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add My Name</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Type your name or code to check in..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-4 bg-zinc-900 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white placeholder-zinc-500 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400/20 shadow-inner"
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

        {/* Members Roster List */}
        <div className="space-y-2 flex-1">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member, index) => {
              const isCheckedIn = checkedInMap.has(member.id);
              const firstLetter = member.full_name[0]?.toUpperCase();
              const prevLetter = filteredMembers[index - 1]?.full_name[0]?.toUpperCase();
              const isNewLetter = !searchQuery && firstLetter !== prevLetter;

              return (
                <React.Fragment key={member.id}>
                  {isNewLetter && (
                    <div id={`section-${firstLetter}`} className="pt-2 pb-1">
                      <span className="text-xs font-black text-zinc-400 uppercase tracking-widest px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                        {firstLetter}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleMemberTap(member)}
                    disabled={isCheckedIn}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isCheckedIn
                        ? 'bg-yellow-950/20 border-yellow-500/30 opacity-75 cursor-default'
                        : 'bg-zinc-900 hover:bg-zinc-800/90 border-zinc-800 hover:border-zinc-700 active:scale-[0.99] cursor-pointer shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                          isCheckedIn
                            ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/40'
                            : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                        }`}
                      >
                        {member.full_name
                          .split(' ')
                          .map(n => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-bold text-white truncate">
                          {member.full_name}
                        </div>
                        <div className="text-xs text-zinc-400 flex items-center gap-2 truncate">
                          <span>{member.department || 'General'}</span>
                          {member.phone && (
                            <span className="text-zinc-500">• {member.phone}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isCheckedIn ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-yellow-400" />
                          <span>Present</span>
                        </div>
                      ) : (
                        <div className="px-3.5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-black shadow transition">
                          Tap to Check In
                        </div>
                      )}
                    </div>
                  </button>
                </React.Fragment>
              );
            })
          ) : (
            <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-3xl mt-4 space-y-4">
              <div className="w-12 h-12 mx-auto bg-zinc-800 rounded-2xl flex items-center justify-center text-yellow-400 border border-zinc-700">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">"{searchQuery}" not found</h3>
                <p className="text-zinc-400 text-xs max-w-xs mx-auto">
                  Looks like you are not on the roster yet. Tap below to register and check in immediately!
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenQuickRegister(searchQuery)}
                className="px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-yellow-950/40 transition active:scale-95 inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>+ Register & Check In Now</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-black px-6 py-2.5 rounded-full font-black text-sm shadow-2xl animate-in slide-in-from-top-2 flex items-center gap-2">
          {toastMessage}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        member={selectedMember}
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setSelectedMember(null);
        }}
        onConfirm={handleConfirmCheckIn}
        isCheckingIn={isCheckingIn}
      />

      {/* Admin Password Exit Modal */}
      <AdminPasswordModal
        isOpen={isPinOpen}
        onClose={() => setIsPinOpen(false)}
        onSuccess={() => {
          setIsPinOpen(false);
          onExitKiosk();
        }}
      />

      {/* ========================================== */}
      {/* QUICK SELF-REGISTRATION & CHECK-IN MODAL   */}
      {/* ========================================== */}
      {isQuickRegOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIsQuickRegOpen(false)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800/80 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {registeredMemberCode ? (
              /* Success State: Show Code */
              <div className="text-center space-y-4 py-2">
                <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center mx-auto border border-yellow-400/20 shadow-md">
                  <PartyPopper className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">You're Checked In!</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Welcome <span className="text-yellow-400 font-bold">{registeredMemberName}</span>. You are registered and marked present for today.
                  </p>
                </div>

                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    Your Personal Check-In Code
                  </p>
                  <p className="text-2xl font-mono font-black text-yellow-400 tracking-wider">
                    {registeredMemberCode}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Save this code for faster 1-tap check-in next time!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsQuickRegOpen(false);
                    setRegisteredMemberCode(null);
                  }}
                  className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm rounded-2xl transition shadow cursor-pointer active:scale-95"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Input Form State */
              <form onSubmit={handleQuickRegisterSubmit} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <h3 className="text-lg font-black text-white">Quick Self-Registration</h3>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Join the roster and record your attendance for today in one tap.
                  </p>
                </div>

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Full Name <span className="text-yellow-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grace Adebayo"
                    value={regFullName}
                    onChange={e => setRegFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white placeholder-zinc-600 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
                    autoFocus
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Phone / WhatsApp <span className="text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="e.g. 08012345678"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white placeholder-zinc-600 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
                    />
                  </div>
                </div>

                {/* Department / Unit */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Department / Unit
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={regDepartment}
                      onChange={e => setRegDepartment(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400/20 cursor-pointer"
                    >
                      <option value="General">General / Member</option>
                      <option value="Choir">Choir / Music</option>
                      <option value="Ushering">Ushering & Protocol</option>
                      <option value="Media">Media & Tech</option>
                      <option value="Youth">Youth / Campus</option>
                      <option value="Children">Children / Sunday School</option>
                      <option value="Prayer">Prayer & Intercession</option>
                      <option value="Sanctuary">Sanctuary Keepers</option>
                      <option value="Welfare">Welfare & Follow-up</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsQuickRegOpen(false)}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingReg || !regFullName.trim()}
                    className="flex-1 py-3 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-yellow-950/40 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSubmittingReg ? (
                      <span>Saving & Checking in...</span>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Register & Check In</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
