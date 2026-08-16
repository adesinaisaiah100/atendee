import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  FileSpreadsheet,
  UserCheck,
  X,
  Check,
  Search,
} from 'lucide-react';
import type { EventTemplate, Session, Member, AttendanceRecord } from '../types';
import { db } from '../lib/db';
import { queueMutation, checkInMemberOptimistic } from '../lib/syncEngine';
import { exportSessionCSV } from '../lib/exportUtils';

interface EventManagerProps {
  fellowshipId: string;
  events: EventTemplate[];
  sessions: Session[];
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  onRefresh: () => void;
}

export const EventManager: React.FC<EventManagerProps> = ({
  fellowshipId,
  events,
  sessions,
  members,
  attendanceRecords,
  onRefresh,
}) => {
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [managingSession, setManagingSession] = useState<Session | null>(null);
  const [sessionSearch, setSessionSearch] = useState('');

  // Form states
  const [eventName, setEventName] = useState('');
  const [eventRecurrence, setEventRecurrence] = useState('weekly:thursday');

  const [sessionEventId, setSessionEventId] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionNotes, setSessionNotes] = useState('');

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) return;

    const newEv: EventTemplate = {
      id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fellowship_id: fellowshipId,
      name: eventName.trim(),
      recurrence: eventRecurrence,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await db.events.put(newEv);
    await queueMutation('event', 'insert', newEv);
    setIsNewEventModalOpen(false);
    setEventName('');
    onRefresh();
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionEventId) return;

    const newSess: Session = {
      id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fellowship_id: fellowshipId,
      event_id: sessionEventId,
      session_date: sessionDate,
      status: 'open',
      opened_at: new Date().toISOString(),
      notes: sessionNotes.trim() || undefined,
    };

    await db.sessions.put(newSess);
    await queueMutation('session', 'insert', newSess);
    setIsNewSessionModalOpen(false);
    setSessionNotes('');
    onRefresh();
  };

  const handleToggleSessionStatus = async (session: Session) => {
    const nextStatus = session.status === 'open' ? 'closed' : 'open';
    const now = new Date().toISOString();
    const updated: Session = {
      ...session,
      status: nextStatus,
      closed_at: nextStatus === 'closed' ? now : undefined,
    };

    await db.sessions.put(updated);
    await queueMutation('session', 'update', updated);
    onRefresh();
  };

  // Toggle admin manual check-in for a member in the selected session
  const handleToggleMemberAttendance = async (session: Session, memberId: string) => {
    const existing = attendanceRecords.find(
      r => r.session_id === session.id && r.member_id === memberId
    );

    if (existing) {
      await db.attendance_records.delete(existing.id);
      await queueMutation('attendance_record', 'delete', { id: existing.id });
    } else {
      await checkInMemberOptimistic(session.id, memberId, 'admin_manual');
    }
    onRefresh();
  };

  const activeMembers = members.filter(m => m.is_active);

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Events & Dated Sessions</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage recurring event blueprints and open dated attendance sessions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsNewEventModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition border border-slate-700"
          >
            + New Event Template
          </button>
          <button
            type="button"
            onClick={() => {
              if (events.length > 0) setSessionEventId(events[0].id);
              setIsNewSessionModalOpen(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            <span>Open New Session</span>
          </button>
        </div>
      </div>

      {/* 2. Recurring Event Templates Grid */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
          Recurring Event Blueprints
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {events.map(ev => {
            const sessionCount = sessions.filter(s => s.event_id === ev.id).length;
            return (
              <div
                key={ev.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-white text-base">{ev.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-400 font-mono">
                      {ev.recurrence || 'Custom'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    {sessionCount} total sessions recorded to date.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSessionEventId(ev.id);
                    setIsNewSessionModalOpen(true);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Launch Session for this Event</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Dated Sessions Roster Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Recorded Sessions History</h3>
            <p className="text-xs text-slate-400">
              Admin manual add-in allowed for any session, even after closing.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4 font-semibold">Event Name</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Headcount</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sessions.map(session => {
                const ev = events.find(e => e.id === session.event_id);
                const attCount = attendanceRecords.filter(r => r.session_id === session.id).length;
                const pct = activeMembers.length > 0 ? Math.round((attCount / activeMembers.length) * 100) : 0;

                return (
                  <tr key={session.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div>{ev?.name || 'Event'}</div>
                      {session.notes && (
                        <div className="text-[11px] text-slate-500 font-normal">{session.notes}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">{session.session_date}</td>
                    <td className="py-3.5 px-4">
                      {session.status === 'open' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Live Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{attCount}</span>
                        <span className="text-xs text-slate-500">/ {activeMembers.length} ({pct}%)</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Admin Manual Check-in on this session */}
                        <button
                          type="button"
                          onClick={() => setManagingSession(session)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold transition inline-flex items-center gap-1 border border-slate-700"
                          title="Manual Attendance Editor"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Roster Check</span>
                        </button>

                        {/* Open / Close toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleSessionStatus(session)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                            session.status === 'open'
                              ? 'bg-rose-950/40 text-rose-300 border-rose-800/40 hover:bg-rose-900/60'
                              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/60'
                          }`}
                        >
                          {session.status === 'open' ? 'Close' : 'Re-open'}
                        </button>

                        {/* Export CSV */}
                        <button
                          type="button"
                          onClick={() => exportSessionCSV(session, ev?.name || 'Session')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Download CSV"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Attendance / Roster Editor Modal for any Session */}
      {managingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <button
              onClick={() => setManagingSession(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="text-[10px] uppercase font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                Admin Manual Attendance Override
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                {events.find(e => e.id === managingSession.event_id)?.name} • {managingSession.session_date}
              </h3>
              <p className="text-xs text-slate-400">
                Tap any member to mark present or absent for this specific session.
              </p>
            </div>

            {/* Search within session modal */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search member..."
                value={sessionSearch}
                onChange={e => setSessionSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
              />
            </div>

            {/* Members List with quick toggle */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {activeMembers
                .filter(m => m.full_name.toLowerCase().includes(sessionSearch.toLowerCase()))
                .map(member => {
                  const isPresent = attendanceRecords.some(
                    r => r.session_id === managingSession.id && r.member_id === member.id
                  );

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleToggleMemberAttendance(managingSession, member.id)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition ${
                        isPresent
                          ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-bold text-sm text-white">{member.full_name}</div>
                        <div className="text-[11px] text-slate-500">{member.department || 'General'}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPresent ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center gap-1 border border-emerald-500/40">
                            <Check className="w-3.5 h-3.5" /> Present
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs">
                            Absent (Tap to mark)
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setManagingSession(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
              >
                Done Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsNewEventModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Create Recurring Event</h3>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saturday Youth Fellowship"
                  value={eventName}
                  onChange={e => setEventName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Recurrence Schedule</label>
                <select
                  value={eventRecurrence}
                  onChange={e => setEventRecurrence(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                >
                  <option value="weekly:thursday">Every Thursday</option>
                  <option value="weekly:sunday">Every Sunday</option>
                  <option value="weekly:monday">Every Monday</option>
                  <option value="weekly:saturday">Every Saturday</option>
                  <option value="monthly">Monthly</option>
                  <option value="ad_hoc">Ad Hoc / Special Gathering</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Session Modal */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsNewSessionModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-4">Open New Attendance Session</h3>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Event</label>
                <select
                  value={sessionEventId}
                  onChange={e => setSessionEventId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Session Date</label>
                <input
                  type="date"
                  required
                  value={sessionDate}
                  onChange={e => setSessionDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Theme (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Communion & Thanksgiving"
                  value={sessionNotes}
                  onChange={e => setSessionNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  className="py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  Open Session Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
