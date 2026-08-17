import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Play,
  FileSpreadsheet,
  ChevronRight,
  ArrowLeft,
  X,
  Smartphone,
  CheckCircle,
  Clock,
  Trash2,
} from 'lucide-react';
import type { EventTemplate, Session, Member, AttendanceRecord } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';
import { exportSessionCSV, downloadCSV } from '../lib/exportUtils';

interface EventsViewProps {
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

export const EventsView: React.FC<EventsViewProps> = ({
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [searchRoster, setSearchRoster] = useState('');

  const activeMembers = useMemo(() => members.filter(m => m.is_active), [members]);

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Sessions for the selected event
  const eventSessions = useMemo(() => {
    if (!selectedEventId) return [];
    return sessions
      .filter(s => s.event_id === selectedEventId)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
  }, [sessions, selectedEventId]);

  // Handle Create Event
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

    setIsCreateModalOpen(false);
    setNewEventName('');
    setSelectedEventId(newEv.id); // auto-open created event
    onRefresh();
  };

  // Handle Start Today's Attendance
  const handleStartSession = async (eventId: string) => {
    const today = new Date().toISOString().split('T')[0];

    const existing = await db.sessions
      .where('event_id')
      .equals(eventId)
      .and(s => s.session_date === today)
      .first();

    if (existing) {
      if (existing.status === 'closed') {
        if (window.confirm('Reopen attendance for today?')) {
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

  // Toggle manual attendance in session checklist
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

  // Export all sessions for this specific event to CSV
  const handleExportEventCSV = () => {
    if (!selectedEvent) return;

    const rows: (string | number)[][] = [
      [`ATTENDANCE REPORT — ${selectedEvent.name.toUpperCase()}`],
      ['Exported On:', new Date().toLocaleDateString()],
      ['Total Sessions Recorded:', eventSessions.length],
      [],
      ['Session Date', 'Status', 'Present Headcount', 'Total Roster', 'Turnout %'],
    ];

    eventSessions.forEach(sess => {
      const count = attendanceRecords.filter(r => r.session_id === sess.id).length;
      const rate = activeMembers.length > 0 ? Math.round((count / activeMembers.length) * 100) : 0;
      rows.push([
        sess.session_date,
        sess.status.toUpperCase(),
        count,
        activeMembers.length,
        `${rate}%`,
      ]);
    });

    downloadCSV(
      `${selectedEvent.name.replace(/\s+/g, '_')}_Attendance_Summary.csv`,
      rows
    );
  };

  const handleDeleteEvent = async (eventId: string, eName: string) => {
    if (window.confirm(`Delete "${eName}"? All its sessions and attendance records will be removed.`)) {
      await db.events.delete(eventId);
      await queueMutation('event', 'delete', { id: eventId });
      setSelectedEventId(null);
      onRefresh();
    }
  };

  // ==========================================
  // VIEW 1: INSIDE AN EVENT (Drill Down)
  // ==========================================
  if (selectedEvent) {
    const isLive = activeSession?.event_id === selectedEvent.id;

    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-in fade-in">
        {/* Top Breadcrumb & Action Bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedEventId(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Events</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportEventCSV}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleDeleteEvent(selectedEvent.id, selectedEvent.name)}
              className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition"
              title="Delete Event"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Event Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  Event
                </span>
                {isLive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                    LIVE NOW
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-white">{selectedEvent.name}</h2>
              <p className="text-xs text-slate-400 mt-1">
                {eventSessions.length} session{eventSessions.length !== 1 ? 's' : ''} recorded • {activeMembers.length} active members on roster
              </p>
            </div>

            {/* Primary Action Button */}
            <div>
              {isLive ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onLaunchKiosk}
                    className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 font-black text-sm rounded-2xl transition flex items-center gap-2 shadow-lg shadow-emerald-950 active:scale-95"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Pass Phone (Check-in)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onCloseSession(activeSession.id)}
                    className="px-3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-2xl transition"
                  >
                    End
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartSession(selectedEvent.id)}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 font-black text-sm rounded-2xl transition flex items-center gap-2 shadow-lg shadow-emerald-950 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Take Attendance (Today)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Recorded List */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1">
            Sessions History
          </h3>

          {eventSessions.length > 0 ? (
            eventSessions.map(sess => {
              const records = attendanceRecords.filter(r => r.session_id === sess.id);
              const isExpanded = expandedSessionId === sess.id;
              const isSessionLive = sess.status === 'open';
              const presentMemberIds = new Set(records.map(r => r.member_id));

              return (
                <div
                  key={sess.id}
                  className={`bg-slate-900 border rounded-2xl overflow-hidden transition shadow-sm ${
                    isSessionLive ? 'border-emerald-500/50' : 'border-slate-800'
                  }`}
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{sess.session_date}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isSessionLive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {isSessionLive ? 'Open' : 'Completed'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        <strong className="text-emerald-400">{records.length}</strong> of {activeMembers.length} Present ({activeMembers.length > 0 ? Math.round((records.length / activeMembers.length) * 100) : 0}%)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportSessionCSV(sess, selectedEvent.name)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center gap-1"
                        title="Download CSV for this session"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                        <span>CSV</span>
                      </button>

                      {isSessionLive && (
                        <button
                          type="button"
                          onClick={() => onCloseSession(sess.id)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-semibold rounded-xl transition"
                        >
                          Close
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedSessionId(isExpanded ? null : sess.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                      >
                        {isExpanded ? 'Hide Names' : 'View Names'}
                      </button>
                    </div>
                  </div>

                  {/* Interactive Checklist Dropdown */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-950/70 border-t border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-300">
                          Attendance Checklist:
                        </span>
                        <input
                          type="text"
                          placeholder="Filter name..."
                          value={searchRoster}
                          onChange={e => setSearchRoster(e.target.value)}
                          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                        {activeMembers
                          .filter(m =>
                            searchRoster
                              ? m.full_name.toLowerCase().includes(searchRoster.toLowerCase())
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
            })
          ) : (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
              <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No sessions recorded yet</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Tap "Take Attendance" above to record your first session.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ALL EVENTS LIST (Home Screen Entry Point)
  // ==========================================
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white">Events &amp; Gatherings</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select an event to start attendance or view sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-950 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Event</span>
        </button>
      </div>

      {/* Events Cards Grid */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.map(ev => {
            const evSessions = sessions.filter(s => s.event_id === ev.id);
            const isLive = activeSession?.event_id === ev.id;
            const lastSession = [...evSessions].sort(
              (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
            )[0];

            return (
              <div
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={`p-5 rounded-3xl border transition cursor-pointer flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] shadow-sm ${
                  isLive
                    ? 'bg-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-950/20'
                    : 'bg-slate-900 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <Calendar className="w-5 h-5" />
                    </div>
                    {isLive && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                        LIVE NOW
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-black text-white mb-1">{ev.name}</h3>
                  <p className="text-xs text-slate-400">
                    {evSessions.length} session{evSessions.length !== 1 ? 's' : ''} recorded
                    {lastSession ? ` • Last: ${lastSession.session_date}` : ''}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span>Open Event &rarr;</span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">No Events Created Yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
            Create your regular gathering (e.g. Sunday Service, Midweek Fellowship) to start taking attendance.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 text-slate-950 font-extrabold text-sm rounded-2xl transition shadow-lg shadow-emerald-950 active:scale-95"
          >
            + Create Your First Event
          </button>
        </div>
      )}

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white mb-4">Create New Event</h3>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Event Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunday Worship Service"
                  value={newEventName}
                  onChange={e => setNewEventName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-950 active:scale-95"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
