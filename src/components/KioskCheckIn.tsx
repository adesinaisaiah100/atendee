import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  Lock,
  UserPlus,
  Wifi,
  WifiOff,
  Sparkles,
  Users,
  Calendar,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ConfirmModal } from './ConfirmModal';
import { NewMemberModal } from './NewMemberModal';
import { AdminPinModal } from './AdminPinModal';
import type { Member, Session, EventTemplate, AttendanceRecord } from '../types';
import { checkInMemberOptimistic, registerPendingMember } from '../lib/syncEngine';

interface KioskCheckInProps {
  session: Session | null;
  event: EventTemplate | null;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  onExitKiosk: () => void;
  pinCode?: string;
  isOnline: boolean;
}

export const KioskCheckIn: React.FC<KioskCheckInProps> = ({
  session,
  event,
  members,
  attendanceRecords,
  onExitKiosk,
  pinCode = '1234',
  isOnline,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false);
  const [isPinOpen, setIsPinOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  // Filtered members based on search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return activeMembers;
    const q = searchQuery.toLowerCase().trim();
    return activeMembers.filter(
      m =>
        m.full_name.toLowerCase().includes(q) ||
        (m.phone && m.phone.includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q))
    );
  }, [activeMembers, searchQuery]);

  // Available Alphabet Letters for quick jumps
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    activeMembers.forEach(m => {
      if (m.full_name[0]) letters.add(m.full_name[0].toUpperCase());
    });
    return Array.from(letters).sort();
  }, [activeMembers]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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
      
      // Fire celebration confetti
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#06b6d4', '#6366f1', '#f59e0b'],
      });

      showToast(`🎉 Checked in: ${selectedMember.full_name}`);
      setSelectedMember(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleNewGuestSubmit = async (name: string, phone?: string) => {
    if (!session) return;
    await registerPendingMember(session.fellowship_id, session.id, name, phone);
    
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#8b5cf6', '#ec4899', '#3b82f6'],
    });

    showToast(`✨ Welcome! ${name} registered.`);
  };

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-950">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/30">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Active Session Open</h2>
        <p className="text-slate-400 text-sm max-w-sm mb-6">
          There is no open attendance session right now. An administrator must launch today's session from the dashboard.
        </p>
        <button
          onClick={onExitKiosk}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl transition shadow-lg"
        >
          Go to Admin Dashboard
        </button>
      </div>
    );
  }

  const checkedInCount = checkedInMap.size;
  const totalActive = activeMembers.length;
  const percentAttended = totalActive > 0 ? Math.round((checkedInCount / totalActive) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Kiosk Header */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">
                  {event?.name || 'Fellowship Gathering'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Session
                </span>
              </div>
              <h1 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md">
                Self-Service Attendance Check-in
              </h1>
            </div>
          </div>

          {/* Right Header Status & Lock */}
          <div className="flex items-center gap-2">
            {/* Online/Offline status */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/40'
              }`}
              title={isOnline ? 'Connected to cloud' : 'Offline mode active - syncing locally'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Online' : 'Offline (Local)'}</span>
            </div>

            {/* Admin PIN Lock Exit */}
            <button
              onClick={() => setIsPinOpen(true)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition border border-slate-700 active:scale-95 flex items-center gap-1 text-xs font-semibold"
              title="Admin Mode Exit (PIN Protected)"
            >
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Admin Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 flex flex-col pb-28">
        {/* Progress & Live Counter Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                Today's Headcount
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-extrabold text-white">{checkedInCount}</span>
              <span className="text-xs text-slate-400"> / {totalActive} members</span>
              <span className="ml-2 text-xs font-bold text-emerald-400">({percentAttended}%)</span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, percentAttended)}%` }}
            />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Type your name (e.g. Samuel, Deborah, Isaiah)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3.5 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 text-base font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-full bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Alphabet Jump Bar (when not searching) */}
        {!searchQuery && availableLetters.length > 5 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-3 no-scrollbar">
            {availableLetters.map(letter => (
              <a
                key={letter}
                href={`#section-${letter}`}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:bg-emerald-600 hover:text-white transition"
              >
                {letter}
              </a>
            ))}
          </div>
        )}

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
                      <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
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
                        ? 'bg-emerald-950/20 border-emerald-800/40 opacity-80 cursor-default'
                        : 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-800 hover:border-slate-700 active:scale-[0.99] cursor-pointer shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          isCheckedIn
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
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
                        <div className="text-xs text-slate-400 flex items-center gap-2 truncate">
                          {member.department && (
                            <span className="text-slate-400">{member.department}</span>
                          )}
                          {member.phone && (
                            <span className="text-slate-500">• {member.phone}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isCheckedIn ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Checked In</span>
                        </div>
                      ) : (
                        <div className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition">
                          Tap to Check In
                        </div>
                      )}
                    </div>
                  </button>
                </React.Fragment>
              );
            })
          ) : (
            <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-3xl mt-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No matching member found</h3>
              <p className="text-slate-400 text-xs max-w-xs mx-auto mb-4">
                "{searchQuery}" is not on the registry list. Tap below to check in as a guest.
              </p>
              <button
                type="button"
                onClick={() => setIsNewMemberOpen(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto shadow-lg shadow-indigo-950"
              >
                <UserPlus className="w-4 h-4" />
                Add & Check In as Guest
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Action Bar for Guests / Unlisted */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400 hidden sm:block">
            Passing the phone? Tap your name or enter guest details.
          </div>
          <button
            type="button"
            onClick={() => setIsNewMemberOpen(true)}
            className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-950 active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            Can't Find Your Name? Tap Here
          </button>
        </div>
      </div>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-full font-bold text-sm shadow-2xl animate-in slide-in-from-top-2 flex items-center gap-2">
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

      {/* New Guest Form Modal */}
      <NewMemberModal
        isOpen={isNewMemberOpen}
        onClose={() => setIsNewMemberOpen(false)}
        onSubmit={handleNewGuestSubmit}
      />

      {/* Admin PIN Exit Modal */}
      <AdminPinModal
        isOpen={isPinOpen}
        onClose={() => setIsPinOpen(false)}
        onSuccess={() => {
          setIsPinOpen(false);
          onExitKiosk();
        }}
        correctPin={pinCode}
      />
    </div>
  );
};
