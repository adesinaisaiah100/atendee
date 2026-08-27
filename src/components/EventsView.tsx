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
  Clock,
  Trash2,
  Sparkles,
  Phone,
  MessageCircle,
  Edit3,
  Check,
  Search,
  Filter,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import type { EventTemplate, Session, Member, AttendanceRecord } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
  onCloseSession?: (sessionId: string) => Promise<void>;
  isCreateModalOpen?: boolean;
  setIsCreateModalOpen?: (open: boolean) => void;
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
  isCreateModalOpen: controlledCreateOpen,
  setIsCreateModalOpen: setControlledCreateOpen,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  
  // Managing session in full modal
  const [managingSessionId, setManagingSessionId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<'all' | 'present' | 'absent'>('all');
  const [modalSearch, setModalSearch] = useState('');
  const [modalDeptFilter, setModalDeptFilter] = useState('all');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState('');

  const isCreateModalOpen = controlledCreateOpen !== undefined ? controlledCreateOpen : internalCreateOpen;
  const setIsCreateModalOpen = (open: boolean) => {
    if (setControlledCreateOpen) setControlledCreateOpen(open);
    else setInternalCreateOpen(open);
  };

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

  // Current session being managed in modal
  const managingSession = useMemo(() => {
    if (!managingSessionId) return null;
    return sessions.find(s => s.id === managingSessionId) || null;
  }, [sessions, managingSessionId]);

  // Records for managing session
  const managingRecords = useMemo(() => {
    if (!managingSession) return [];
    return attendanceRecords.filter(r => r.session_id === managingSession.id);
  }, [attendanceRecords, managingSession]);

  const departments = ['all', 'Choir', 'Ushering', 'Media', 'Technical', 'Welfare', 'Bible Study', 'General'];

  // Handle Create Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    const newEv: EventTemplate = {
      id: crypto.randomUUID(),
      fellowship_id: fellowshipId,
      name: newEventName.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await db.events.put(newEv);
    await queueMutation('event', 'insert', newEv);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('events').insert(newEv);
      } catch (err) {
        console.warn('Cloud create event error:', err);
      }
    }

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
          await queueMutation('session', 'update', { id: existing.id, status: 'open', closed_at: null });
          if (isSupabaseConfigured()) {
            try {
              await supabase.from('sessions').update({ status: 'open', closed_at: null }).eq('id', existing.id);
            } catch (err) {
              console.warn('Cloud reopen session error:', err);
            }
          }
          onRefresh();
          onLaunchKiosk();
        }
      } else {
        onLaunchKiosk();
      }
      return;
    }

    const newSess: Session = {
      id: crypto.randomUUID(),
      fellowship_id: fellowshipId,
      event_id: eventId,
      session_date: today,
      status: 'open',
      opened_at: new Date().toISOString(),
    };

    await db.sessions.put(newSess);
    await queueMutation('session', 'insert', newSess);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('sessions').insert(newSess);
      } catch (err) {
        console.warn('Cloud start session error:', err);
      }
    }
    onRefresh();
    onLaunchKiosk();
  };

  // Reopen or Close a session
  const handleToggleSessionStatus = async (sess: Session) => {
    const isOpening = sess.status === 'closed';
    const confirmMsg = isOpening
      ? `Reopen attendance for ${sess.session_date}? Self-service check-in will become active.`
      : `End attendance for ${sess.session_date}? Self-service check-in will be closed.`;

    if (window.confirm(confirmMsg)) {
      const newStatus = isOpening ? 'open' : 'closed';
      const closedAt = isOpening ? undefined : new Date().toISOString();

      await db.sessions.update(sess.id, {
        status: newStatus,
        closed_at: closedAt,
      });
      await queueMutation('session', 'update', {
        id: sess.id,
        status: newStatus,
        closed_at: isOpening ? null : closedAt,
      });

      if (isSupabaseConfigured()) {
        try {
          await supabase.from('sessions').update({
            status: newStatus,
            closed_at: isOpening ? null : closedAt,
          }).eq('id', sess.id);
        } catch (err) {
          console.warn('Cloud toggle session status error:', err);
        }
      }
      onRefresh();
    }
  };

  // Update session date
  const handleSaveSessionDate = async (sessionId: string) => {
    if (!editDateValue) return;

    await db.sessions.update(sessionId, { session_date: editDateValue });
    await queueMutation('session', 'update', { id: sessionId, session_date: editDateValue });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('sessions').update({ session_date: editDateValue }).eq('id', sessionId);
      } catch (err) {
        console.warn('Cloud update session date error:', err);
      }
    }
    setIsEditingDate(false);
    onRefresh();
  };

  // Toggle manual attendance in session
  const handleToggleManualAttendance = async (sessionId: string, memberId: string) => {
    const existing = await db.attendance_records
      .where('[session_id+member_id]')
      .equals([sessionId, memberId])
      .first();

    if (existing) {
      await db.attendance_records.delete(existing.id);
      await queueMutation('attendance_record', 'delete', { id: existing.id });
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('attendance_records').delete().eq('id', existing.id);
        } catch (err) {
          console.warn('Cloud delete record error:', err);
        }
      }
    } else {
      const record: AttendanceRecord = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        member_id: memberId,
        checked_in_at: new Date().toISOString(),
        source: 'admin_manual',
      };
      await db.attendance_records.put(record);
      await queueMutation('attendance_record', 'insert', record);
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('attendance_records').insert(record);
        } catch (err) {
          console.warn('Cloud insert record error:', err);
        }
      }
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
    if (window.confirm(`Delete "${eName}"? All its recorded sessions and attendance records will be permanently removed.`)) {
      const relatedSessions = await db.sessions.where('event_id').equals(eventId).toArray();
      const sessionIds = relatedSessions.map(s => s.id);
      if (sessionIds.length > 0) {
        await db.attendance_records.where('session_id').anyOf(sessionIds).delete();
        await db.sessions.where('event_id').equals(eventId).delete();
      }
      await db.events.delete(eventId);
      await queueMutation('event', 'delete', { id: eventId });

      if (isSupabaseConfigured()) {
        try {
          if (sessionIds.length > 0) {
            await supabase.from('attendance_records').delete().in('session_id', sessionIds);
            await supabase.from('sessions').delete().eq('event_id', eventId);
          }
          const { error } = await supabase.from('events').delete().eq('id', eventId);
          if (error) console.error('Cloud delete event error:', error);
        } catch (err) {
          console.warn('Cloud delete event error:', err);
        }
      }

      if (selectedEventId === eventId) {
        setSelectedEventId(null);
      }
      onRefresh();
    }
  };

  const handleDeleteSession = async (sessionId: string, sessionDate: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete the attendance session from ${sessionDate}? All check-in records for this date will be permanently deleted.`
      )
    ) {
      await db.attendance_records.where('session_id').equals(sessionId).delete();
      await db.sessions.delete(sessionId);
      await queueMutation('session', 'delete', { id: sessionId });

      if (isSupabaseConfigured()) {
        try {
          await supabase.from('attendance_records').delete().eq('session_id', sessionId);
          await supabase.from('sessions').delete().eq('id', sessionId);
        } catch (err) {
          console.warn('Cloud delete session error:', err);
        }
      }

      if (managingSessionId === sessionId) {
        setManagingSessionId(null);
      }

      onRefresh();
    }
  };

  const handleClearAllSessions = async (eventId: string) => {
    const sessionsToClear = sessions.filter(s => s.event_id === eventId);
    if (sessionsToClear.length === 0) {
      alert('No sessions to clear for this event.');
      return;
    }
    if (
      window.confirm(
        `Clear all ${sessionsToClear.length} session(s) for this event? All attendance records will be permanently deleted. This cannot be undone.`
      )
    ) {
      const sessionIds = sessionsToClear.map(s => s.id);
      await db.attendance_records.where('session_id').anyOf(sessionIds).delete();
      for (const sid of sessionIds) {
        await db.sessions.delete(sid);
        await queueMutation('session', 'delete', { id: sid });
      }

      if (isSupabaseConfigured()) {
        try {
          await supabase.from('attendance_records').delete().in('session_id', sessionIds);
          await supabase.from('sessions').delete().eq('event_id', eventId);
        } catch (err) {
          console.warn('Cloud clear sessions error:', err);
        }
      }

      setManagingSessionId(null);
      onRefresh();
    }
  };

  // ==========================================
  // VIEW 1: INSIDE AN EVENT (Drill Down)
  // ==========================================
  if (selectedEvent) {
    const isLive = activeSession?.event_id === selectedEvent.id;

    return (
      <div className="space-y-7 w-full pb-20 animate-in fade-in">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedEventId(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-black transition border border-zinc-800 active:scale-95 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-yellow-400" />
            <span>All Events</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportEventCSV}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 border border-zinc-800 active:scale-95 cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-yellow-400" />
              <span>Export CSV</span>
            </button>

            {eventSessions.length > 0 && (
              <button
                type="button"
                onClick={() => handleClearAllSessions(selectedEvent.id)}
                className="px-3.5 py-2.5 bg-zinc-900 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 border border-zinc-800 hover:border-rose-800/50 active:scale-95 cursor-pointer"
                title="Clear All Sessions"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear Sessions</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDeleteEvent(selectedEvent.id, selectedEvent.name)}
              className="p-2.5 text-zinc-500 hover:text-rose-400 rounded-2xl hover:bg-zinc-900 border border-zinc-800/60 transition cursor-pointer"
              title="Delete Event"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean Event Header Banner */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-yellow-400 uppercase tracking-widest">
                  Gathering / Event
                </span>
                {isLive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black bg-yellow-400 text-black shadow-md shadow-yellow-950/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                    LIVE NOW
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">{selectedEvent.name}</h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                {eventSessions.length} session{eventSessions.length !== 1 ? 's' : ''} recorded • {activeMembers.length} active members on roster
              </p>
            </div>

            {/* Primary Action Button */}
            <div>
              {isLive ? (
                <button
                  type="button"
                  onClick={onLaunchKiosk}
                  className="w-full sm:w-auto px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2.5 shadow-xl shadow-yellow-950/50 active:scale-95 cursor-pointer"
                >
                  <Smartphone className="w-5 h-5" />
                  <span>Pass Phone (Check-in)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartSession(selectedEvent.id)}
                  className="w-full sm:w-auto px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm rounded-2xl transition flex items-center justify-center gap-2.5 shadow-xl shadow-yellow-950/50 active:scale-95 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Take Attendance (Today)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Recorded List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
              Recorded Attendance Sessions ({eventSessions.length})
            </h3>
            <span className="text-[11px] text-zinc-500 font-semibold">
              Click "Manage & View" on any session to edit details or follow up with absentees
            </span>
          </div>

          {eventSessions.length > 0 ? (
            <div className="grid grid-cols-1 gap-3.5">
              {eventSessions.map(sess => {
                const records = attendanceRecords.filter(r => r.session_id === sess.id);
                const isSessionLive = sess.status === 'open';
                const presentCount = records.length;
                const totalCount = activeMembers.length;
                const absentCount = Math.max(0, totalCount - presentCount);
                const turnoutPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                return (
                  <div
                    key={sess.id}
                    className={`bg-zinc-900 border rounded-3xl p-5 sm:p-6 transition shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 ${
                      isSessionLive
                        ? 'border-yellow-400/60 shadow-lg shadow-yellow-950/20 bg-gradient-to-br from-zinc-900 to-yellow-950/10'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* Session Info */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-black text-white text-lg sm:text-xl tracking-tight">
                          {sess.session_date}
                        </span>
                        
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                            isSessionLive
                              ? 'bg-yellow-400 text-black shadow'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                          }`}
                        >
                          {isSessionLive ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                              <span>Live Session</span>
                            </>
                          ) : (
                            <span>Completed</span>
                          )}
                        </span>
                      </div>

                      {/* Headcount Metrics Bar */}
                      <div className="flex items-center gap-3 sm:gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-yellow-400" />
                          <span className="text-zinc-300 font-bold">
                            <strong className="text-yellow-400 text-sm">{presentCount}</strong> Present ({turnoutPct}%)
                          </span>
                        </div>
                        <div className="text-zinc-600 font-bold">•</div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span className="text-zinc-400 font-medium">
                            <strong className="text-rose-400 text-sm">{absentCount}</strong> Absent
                          </span>
                        </div>
                      </div>

                      {/* Mini visual progress bar */}
                      <div className="w-full max-w-md h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                        <div
                          className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                          style={{ width: `${turnoutPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Controls for this specific session */}
                    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap justify-start md:justify-end">
                      {/* Prominent Primary "Manage & View" Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setManagingSessionId(sess.id);
                          setModalTab('all');
                          setModalSearch('');
                          setModalDeptFilter('all');
                          setIsEditingDate(false);
                          setEditDateValue(sess.session_date);
                        }}
                        className="px-4 sm:px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs sm:text-sm rounded-2xl transition flex items-center gap-1.5 shadow-md shadow-yellow-950/40 active:scale-95 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Manage &amp; View</span>
                      </button>

                      {/* If live, quick Kiosk launcher button */}
                      {isSessionLive && (
                        <button
                          type="button"
                          onClick={onLaunchKiosk}
                          className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-2xl transition flex items-center gap-1.5 border border-zinc-700/50 cursor-pointer active:scale-95"
                          title="Pass Phone for this session"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-yellow-400" />
                          <span className="hidden sm:inline">Pass Phone</span>
                        </button>
                      )}

                      {/* Session End/Reopen direct trigger on card */}
                      <button
                        type="button"
                        onClick={() => handleToggleSessionStatus(sess)}
                        className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          isSessionLive
                            ? 'bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50'
                        }`}
                        title={isSessionLive ? 'End Session' : 'Reopen Session'}
                      >
                        {isSessionLive ? (
                          <>
                            <span>End Session</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="hidden sm:inline">Reopen</span>
                          </>
                        )}
                      </button>

                      {/* Export CSV for this session */}
                      <button
                        type="button"
                        onClick={() => exportSessionCSV(sess, selectedEvent.name)}
                        className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-2xl transition border border-zinc-700/50 cursor-pointer"
                        title="Download CSV for this date"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-yellow-400" />
                      </button>

                      {/* Delete Session */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(sess.id, sess.session_date)}
                        className="p-2.5 bg-zinc-800/80 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-400 rounded-2xl border border-zinc-800 hover:border-rose-800/50 transition cursor-pointer"
                        title="Delete Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center bg-zinc-900 border border-zinc-800 rounded-3xl space-y-2">
              <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-base font-bold text-zinc-300">No sessions recorded yet</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Tap "Take Attendance" above to record your first gathering.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* FULL SESSION MANAGEMENT MODAL (The Interactive Open Hub) */}
        {/* ========================================================= */}
        {managingSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black text-yellow-400 uppercase tracking-widest">
                      {selectedEvent.name}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        managingSession.status === 'open'
                          ? 'bg-yellow-400 text-black'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {managingSession.status === 'open' ? 'Live Session' : 'Completed'}
                    </span>
                  </div>

                  {/* Date with Inline Edit */}
                  {isEditingDate ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="date"
                        value={editDateValue}
                        onChange={e => setEditDateValue(e.target.value)}
                        className="px-3 py-1.5 bg-zinc-950 border border-yellow-400/80 rounded-xl text-white text-sm font-bold focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveSessionDate(managingSession.id)}
                        className="px-3 py-1.5 bg-yellow-400 text-black font-black text-xs rounded-xl hover:bg-yellow-300 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingDate(false)}
                        className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl hover:bg-zinc-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl sm:text-2xl font-black text-white">
                        {managingSession.session_date}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingDate(true);
                          setEditDateValue(managingSession.session_date);
                        }}
                        className="p-1 text-zinc-400 hover:text-yellow-400 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                        title="Edit Session Date"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setManagingSessionId(null)}
                  className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Toolbar & Stats */}
              <div className="p-4 sm:p-5 bg-zinc-950/70 border-b border-zinc-800 space-y-4">
                {/* Stats row */}
                {(() => {
                  const presentMemberIds = new Set(managingRecords.map(r => r.member_id));
                  const presentCount = activeMembers.filter(m => presentMemberIds.has(m.id)).length;
                  const totalCount = activeMembers.length;
                  const absentCount = Math.max(0, totalCount - presentCount);
                  const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                  return (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">
                          Present Headcount
                        </span>
                        <span className="text-lg sm:text-xl font-black text-yellow-400">
                          {presentCount} <span className="text-xs text-zinc-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">
                          Absent
                        </span>
                        <span className="text-lg sm:text-xl font-black text-rose-400">
                          {absentCount}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">
                          Total Roster
                        </span>
                        <span className="text-lg sm:text-xl font-black text-white">
                          {totalCount}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Session Actions Controls */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {managingSession.status === 'open' ? (
                      <>
                        <button
                          type="button"
                          onClick={onLaunchKiosk}
                          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow active:scale-95 cursor-pointer"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Pass Phone (Kiosk)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSessionStatus(managingSession)}
                          className="px-3 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          End Session
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleSessionStatus(managingSession)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-yellow-400 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reopen Session</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => exportSessionCSV(managingSession, selectedEvent.name)}
                    className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-zinc-800 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Roster Controls: Search & Tabs */}
              <div className="p-4 sm:p-5 border-b border-zinc-800 space-y-3 bg-zinc-900">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search member name or code..."
                      value={modalSearch}
                      onChange={e => setModalSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white text-xs font-medium focus:outline-none"
                    />
                  </div>

                  {/* Segmented Filter Tabs */}
                  {(() => {
                    const presentMemberIds = new Set(managingRecords.map(r => r.member_id));
                    const presentCount = activeMembers.filter(m => presentMemberIds.has(m.id)).length;
                    const absentCount = Math.max(0, activeMembers.length - presentCount);

                    return (
                      <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setModalTab('all')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                            modalTab === 'all'
                              ? 'bg-yellow-400 text-black shadow'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          All ({activeMembers.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalTab('present')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                            modalTab === 'present'
                              ? 'bg-yellow-400 text-black shadow'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Present ({presentCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalTab('absent')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                            modalTab === 'absent'
                              ? 'bg-yellow-400 text-black shadow'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          Absent ({absentCount})
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Department pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <span className="text-[11px] text-zinc-500 font-semibold mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-yellow-400" /> Unit:
                  </span>
                  {departments.map(dept => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setModalDeptFilter(dept)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                        modalDeptFilter === dept
                          ? 'bg-yellow-400 text-black font-bold'
                          : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                      }`}
                    >
                      {dept === 'all' ? 'All Units' : dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Roster List with 1-Tap Toggle & Absent Outreach */}
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-2 max-h-96">
                {(() => {
                  const presentMemberIds = new Set(managingRecords.map(r => r.member_id));

                  const filteredList = activeMembers.filter(m => {
                    const isPresent = presentMemberIds.has(m.id);
                    if (modalTab === 'present' && !isPresent) return false;
                    if (modalTab === 'absent' && isPresent) return false;
                    if (modalDeptFilter !== 'all' && m.department !== modalDeptFilter) return false;
                    if (modalSearch.trim()) {
                      const q = modalSearch.toLowerCase();
                      return (
                        m.full_name.toLowerCase().includes(q) ||
                        (m.check_in_code && m.check_in_code.toLowerCase().includes(q)) ||
                        (m.phone && m.phone.includes(q))
                      );
                    }
                    return true;
                  });

                  if (filteredList.length === 0) {
                    return (
                      <div className="p-8 text-center bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
                        <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                        <p className="text-xs text-zinc-400">No members match this filter.</p>
                      </div>
                    );
                  }

                  return filteredList.map(member => {
                    const isPresent = presentMemberIds.has(member.id);

                    return (
                      <div
                        key={member.id}
                        className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isPresent
                            ? 'bg-yellow-950/20 border-yellow-500/40 text-white'
                            : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        {/* Member Info */}
                        <div
                          onClick={() => handleToggleManualAttendance(managingSession.id, member.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                              isPresent
                                ? 'bg-yellow-400 text-black shadow'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {member.full_name[0]?.toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm truncate flex items-center gap-2">
                              <span className={isPresent ? 'text-yellow-200' : 'text-white'}>
                                {member.full_name}
                              </span>
                              {member.check_in_code && (
                                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                                  {member.check_in_code}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                              <span>{member.department || 'General'}</span>
                              {member.phone && <span>• {member.phone}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* If absent, show follow-up buttons */}
                          {!isPresent && member.phone && (
                            <>
                              <a
                                href={`tel:${member.phone}`}
                                className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition border border-zinc-800"
                                title="Call member"
                              >
                                <Phone className="w-3.5 h-3.5 text-yellow-400" />
                              </a>
                              <a
                                href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                                  member.full_name
                                )},%20we%20missed%20you%20at%20${encodeURIComponent(
                                  selectedEvent.name
                                )}%20today!%20Hope%20you%20are%20doing%20well.`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black transition shadow-sm"
                                title="Message on WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}

                          {/* 1-Tap Attendance Checkbox Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleManualAttendance(managingSession.id, member.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                              isPresent
                                ? 'bg-yellow-400 text-black shadow-md'
                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800'
                            }`}
                          >
                            {isPresent ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Present</span>
                              </>
                            ) : (
                              <>
                                <span>Mark Present</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ALL EVENTS LIST (Home Screen Entry Point)
  // ==========================================
  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Events</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Select an event to start attendance, view past records, or follow up with absentees.
          </p>
        </div>

        {events.length > 0 && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 sm:px-5 py-2.5 sm:py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl transition flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-yellow-950/40 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Event</span>
          </button>
        )}
      </div>

      {/* Events Cards Grid */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
                className={`p-6 rounded-3xl border transition cursor-pointer flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] shadow-sm ${
                  isLive
                    ? 'bg-zinc-900 border-yellow-400/60 shadow-lg shadow-yellow-950/30'
                    : 'bg-zinc-900 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 rounded-2xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center border border-yellow-400/20">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isLive && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-yellow-400 text-black">
                          LIVE NOW
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(ev.id, ev.name);
                        }}
                        className="p-2 text-zinc-500 hover:text-rose-400 rounded-xl hover:bg-zinc-800 transition cursor-pointer"
                        title="Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-white mb-1">{ev.name}</h3>
                  <p className="text-xs text-zinc-400">
                    {evSessions.length} session{evSessions.length !== 1 ? 's' : ''} recorded
                    {lastSession ? ` • Last: ${lastSession.session_date}` : ''}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-zinc-800 flex items-center justify-between text-xs font-black text-yellow-400">
                  <span>Open Event &rarr;</span>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State with Welcoming UI */
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center mx-auto border border-yellow-400/20 shadow-md">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white mb-1">Welcome! Create Your First Event</h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">
              Add your regular gathering (e.g. Sunday Worship, Thursday Mass, Youth Camp) to start taking attendance.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm rounded-2xl transition shadow-lg shadow-yellow-950/40 active:scale-95 cursor-pointer"
            >
              + Create Your First Event
            </button>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-black text-white mb-4">Create New Event</h3>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Event / Gathering Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunday Worship Service"
                  value={newEventName}
                  onChange={e => setNewEventName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-2xl text-white text-sm focus:outline-none transition"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-3 px-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl text-xs shadow-lg shadow-yellow-950/40 active:scale-95 transition"
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
