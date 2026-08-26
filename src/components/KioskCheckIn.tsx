import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  Lock,
  Users,
  Calendar,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ConfirmModal } from './ConfirmModal';
import { AdminPasswordModal } from './AdminPasswordModal';
import { AtendeeLogo } from './AtendeeLogo';
import type { Member, Session, EventTemplate, AttendanceRecord } from '../types';
import { checkInMemberOptimistic } from '../lib/syncEngine';
import { findMemberByCode } from '../lib/codeGenerator';

interface KioskCheckInProps {
  session: Session | null;
  event: EventTemplate | null;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  onExitKiosk: () => void;
}

export const KioskCheckIn: React.FC<KioskCheckInProps> = ({
  session,
  event,
  members,
  attendanceRecords,
  onExitKiosk,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPinOpen, setIsPinOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

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
      
      // Fire celebration confetti with Yellow & Gold
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.8 },
        colors: ['#facc15', '#f59e0b', '#fbbf24', '#ffffff'],
      });

      showToast(`🎉 Checked in: ${selectedMember.full_name}`);
      setSelectedMember(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCodeCheckIn = async () => {
    if (!codeInput.trim() || !session) return;
    setCodeError(null);

    try {
      const member = await findMemberByCode(codeInput, session.fellowship_id);

      if (!member) {
        setCodeError('Code not found. Please check and try again.');
        return;
      }

      if (checkedInMap.has(member.id)) {
        setCodeError("You're already checked in!");
        return;
      }

      await checkInMemberOptimistic(session.id, member.id, 'code');

      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.8 },
        colors: ['#facc15', '#f59e0b', '#fbbf24', '#ffffff'],
      });

      showToast(`🎉 Checked in: ${member.full_name}`);
      setCodeInput('');
      setCodeError(null);
    } catch (err) {
      console.error(err);
      setCodeError('Something went wrong. Please try again.');
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

  const checkedInCount = checkedInMap.size;
  const totalActive = activeMembers.length;
  const percentAttended = totalActive > 0 ? Math.round((checkedInCount / totalActive) * 100) : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-yellow-400 selection:text-black">
      {/* Kiosk Header */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AtendeeLogo size="sm" showText={false} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-black text-yellow-400">
                  {event?.name || 'Gathering'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-400 text-black">
                  Live Check-in
                </span>
              </div>
              <h1 className="text-sm font-bold text-white truncate">
                Pass the Phone
              </h1>
            </div>
          </div>

          {/* Admin PIN Lock Exit */}
          <button
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
        {/* Progress & Live Counter Banner */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                Today's Headcount
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-white">{checkedInCount}</span>
              <span className="text-xs text-zinc-400"> / {totalActive} members</span>
              <span className="ml-2 text-xs font-black text-yellow-400">({percentAttended}%)</span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, percentAttended)}%` }}
            />
          </div>
        </div>

        {/* Code Entry Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 mb-4 shadow-sm">
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wide mb-2">
            Quick Check-in with Code
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Enter your code e.g. GRACE-1234"
              value={codeInput}
              onChange={e => {
                setCodeInput(e.target.value.toUpperCase());
                setCodeError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCodeCheckIn();
              }}
              className="flex-1 px-4 py-3.5 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white placeholder-zinc-500 text-base font-mono font-bold text-center uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
            />
            <button
              onClick={handleCodeCheckIn}
              disabled={!codeInput.trim()}
              className="px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-black rounded-xl transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              Check In
            </button>
          </div>
          {codeError && (
            <p className="mt-2 text-sm font-semibold text-red-400">{codeError}</p>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-500 font-semibold whitespace-nowrap">
            or tap your name below
          </span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Type your name to check in..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-4 bg-zinc-900 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white placeholder-zinc-500 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400/20 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white rounded-full bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Alphabet Jump Bar */}
        {!searchQuery && availableLetters.length > 4 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-3 no-scrollbar">
            {availableLetters.map(letter => (
              <a
                key={letter}
                href={`#section-${letter}`}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:bg-yellow-400 hover:text-black transition"
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
            <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-3xl mt-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Name not found</h3>
              <p className="text-zinc-400 text-xs max-w-xs mx-auto">
                "{searchQuery}" is not on the roster. Please ask an admin to add you.
              </p>
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
    </div>
  );
};
