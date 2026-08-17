import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Play,
  CheckCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  X,
  Clock,
} from 'lucide-react';
import type { EventTemplate, Session, Member, AttendanceRecord } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';
import { exportSessionCSV } from '../lib/exportUtils';

interface EventManagerProps {
  fellowshipId: string;
  events: EventTemplate[];
  sessions: Session[];
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  activeSession: Session | null;
  onRefresh: () => void;
  onLaunchKiosk: () => void;
  onCloseSession: (sessionId: string) => Promise<void>;
}

export const EventManager: React.FC<EventManagerProps> = ({
  fellowshipId,
  events,
  sessions,
  members,
  attendanceRecords,
  activeSession,
  onRefresh,
  onLaunchKiosk,
  onCloseSession,
}) => {
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState('');

  const activeMembers = useMemo(() => members.filter(m => m.is_active), [members]);

  // Sort sessions: active first, then newest
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (b.status === 'open' && a.status !== 'open') return 1;
      return new Date(b.session_date).getTime() - new Date(a.session_date).getTime();
    });
  }, [sessions]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    const newEv: EventTemplate = {
      id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fellowship_id: fellowshipId,
      name: newEventName.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await db.events.put(newEv);
    await queueMutation('event', 'insert', newEv);

    setIsAddEventOpen(false);
    setNewEventName('');
    onRefresh();
  };

  const handleStartSession = async (eventId: string) => {
    const today = new Date().toISOString().split('T')[0];

    // Check if open session exists
    const existing = await db.sessions
      .where('event_id')
      .equals(eventId)
      .and(s => s.session_date === today)
      .first();

    if (existing) {
      if (existing.status === 'closed') {
        if (window.confirm('This session was closed earlier today. Reopen it for check-in?')) {
          await db.sessions.update(existing.id, { status: 'open', closed_at: undefined });
          await queueMutation('session', 'update', { id: existing.id, status: 'open' });
          onRefresh();
          onLaunchKiosk();
        }
      } else {
        onLaunchKiosk();
      }
      return;
    }

    const newSess: Session = {
      id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fellowship_id: fellowshipId,
      event_id: eventId,
      session_date: today,
      status: 'open',
      opened_at: new Date().toISOString(),
    };

    await db.sessions.put(newSess);
    await queueMutation('session', 'insert', newSess);
    onRefresh();
    onLaunchKiosk();
  };

  const handleToggleManualAttendance = async (sessionId: string, memberId: string) => {
    const existing = await db.attendance_records
      .where('[session_id+member_id]')
      .equals([sessionId, memberId])
      .first();

    if (existing) {
      await db.attendance_records.delete(existing.id);
      await queueMutation('attendance_record', 'delete', { id: existing.id });
    } else {
      const record: AttendanceRecord = {
        id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        session_id: sessionId,
        member_id: memberId,
        checked_in_at: new Date().toISOString(),
        source: 'admin_manual',
      };
      await db.attendance_records.put(record);
      await queueMutation('attendance_record', 'insert', record);
    }
    onRefresh();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-extrabold text-white">Services &amp; Gatherings</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Start attendance for today's gathering or review past attendance records.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddEventOpen(true)}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700 active:scale-95"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>+ Add Gathering Type</span>
        </button>
      </div>

      {/* Gathering Types Quick Launch Grid */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
          Gathering Blueprints
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {events.map(ev => {
            const isLive = activeSession?.event_id === ev.id;
            return (
              <div
                key={ev.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                  isLive
                    ? 'bg-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-white text-base truncate">{ev.name}</span>
                    {isLive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                        LIVE
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  {isLive ? (
                    <button
                      type="button"
                      onClick={onLaunchKiosk}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Continue Check-in</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartSession(ev.id)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700 active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Today's Attendance</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sessions Recorded Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
        <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" /> Recorded Attendance History
        </h3>

        {sortedSessions.length > 0 ? (
          <div className="space-y-3">
            {sortedSessions.map(sess => {
              const ev = events.find(e => e.id === sess.event_id);
              const records = attendanceRecords.filter(r => r.session_id === sess.id);
              const isExpanded = expandedSessionId === sess.id;
              const isLive = sess.status === 'open';

              const presentMemberIds = new Set(records.map(r => r.member_id));

              return (
                <div
                  key={sess.id}
                  className={`rounded-2xl border transition overflow-hidden ${
                    isLive
                      ? 'bg-slate-950 border-emerald-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {ev?.name || 'Fellowship Gathering'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isLive ? 'Open / In Progress' : 'Closed'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Date: {sess.session_date} • <strong>{records.length}</strong> of {activeMembers.length} Present ({activeMembers.length > 0 ? Math.round((records.length / activeMembers.length) * 100) : 0}%)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportSessionCSV(sess, ev?.name || 'Service')}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                        title="Download CSV Roster"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                        <span className="hidden sm:inline">CSV</span>
                      </button>

                      {isLive && (
                        <button
                          type="button"
                          onClick={() => onCloseSession(sess.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold rounded-xl transition"
                        >
                          End
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSessionId(isExpanded ? null : sess.id)
                        }
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1 transition"
                      >
                        <span>{isExpanded ? 'Hide Roster' : 'View Roster'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Interactive Attendance Roster */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-300">
                          Toggle Attendance Checklist:
                        </span>
                        <input
                          type="text"
                          placeholder="Filter name..."
                          value={manualSearch}
                          onChange={e => setManualSearch(e.target.value)}
                          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                        {activeMembers
                          .filter(m =>
                            manualSearch
                              ? m.full_name.toLowerCase().includes(manualSearch.toLowerCase())
                              : true
                          )
                          .map(m => {
                            const isPresent = presentMemberIds.has(m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => handleToggleManualAttendance(sess.id, m.id)}
                                className={`p-2 rounded-xl text-xs font-medium flex items-center justify-between border transition ${
                                  isPresent
                                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <span className="truncate">{m.full_name}</span>
                                <CheckCircle
                                  className={`w-4 h-4 ml-2 flex-shrink-0 ${
                                    isPresent ? 'text-emerald-400 fill-emerald-500/20' : 'text-slate-600'
                                  }`}
                                />
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-950/40 border border-slate-800 rounded-2xl">
            <p className="text-xs text-slate-400">No attendance sessions recorded yet.</p>
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {isAddEventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsAddEventOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">Add New Gathering Type</h3>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Gathering / Service Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Friday Bible Study &amp; Prayer"
                  value={newEventName}
                  onChange={e => setNewEventName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEventOpen(false)}
                  className="py-2.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-950"
                >
                  Create Gathering
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
