import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  ClipboardCheck,
  FileSpreadsheet,
  ChevronRight,
  ArrowLeft,
  X,
  Smartphone,
  Clock,
  Trash2,
  Phone,
  Share2,
  MessageCircle,
  Edit3,
  Check,
  Search,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import type { EventTemplate, Session, Member, AttendanceRecord } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { exportSessionCSV, downloadCSV } from '../lib/exportUtils';
import { ShareCheckInModal } from './ShareCheckInModal';

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
  // Sharing self check-in link/QR for a live session
  const [shareSession, setShareSession] = useState<Session | null>(null);
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
              className="px-3.5 sm:px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white rounded-2xl text-xs font-bold transition flex items-center gap-1.5 border border-zinc-800 active:scale-95 cursor-pointer shadow-sm"
              title="Export CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-yellow-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

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
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-5">
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {isLive && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-yellow-400 text-black">
                    <span className="w-1.5 h-1.5 rounded-full bg-black" />
                    LIVE NOW
                  </span>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight tracking-tight text-balance break-words">{selectedEvent.name}</h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                {eventSessions.length} session{eventSessions.length !== 1 ? 's' : ''} • {activeMembers.length} members
              </p>
            </div>

            {/* Primary Action Button */}
            <div className="w-full space-y-2">
              {isLive ? (
                <>
                  <button
                    type="button"
                    onClick={onLaunchKiosk}
                    className="w-full sm:w-auto px-7 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm sm:text-base rounded-full transition flex items-center justify-center gap-2.5 shadow-xl shadow-yellow-950/50 active:scale-95 cursor-pointer"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>Pass Phone (Check-in)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const live = eventSessions.find(s => s.status === 'open') || null;
                      setShareSession(live);
                    }}
                    className="w-full sm:w-auto px-7 py-3.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 font-bold text-sm rounded-full transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-yellow-400" />
                    <span>Share Check-in Link</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartSession(selectedEvent.id)}
                  className="w-full sm:w-auto px-7 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm sm:text-base rounded-full transition flex items-center justify-center gap-2.5 shadow-xl shadow-yellow-950/50 active:scale-95 cursor-pointer"
                >
                  <ClipboardCheck className="w-5 h-5" />
                  <span>Take Attendance</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sessions Recorded List */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
              Sessions ({eventSessions.length})
            </h3>
            <span className="hidden sm:inline text-[11px] text-zinc-500 font-semibold">
              Manage any session to edit details or follow up
            </span>
          </div>

          {eventSessions.length > 0 ? (
            <div className="grid grid-cols-1 gap-3.5">
              {eventSessions.map(sess => {
                const records = attendanceRecords.filter(r => r.session_id === sess.id);
                const isSessionLive = sess.status === 'open';
                const presentCount = records.length;
                const totalCount = activeMembers.length;
                const turnoutPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                return (
                  <div
                    key={sess.id}
                    className={`bg-zinc-900 border rounded-2xl p-4 sm:p-5 transition flex flex-col gap-3 ${
                      isSessionLive
                        ? 'border-yellow-400/50'
                        : 'border-zinc-800'
                    }`}
                  >
                    {/* Session Info */}
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white text-base sm:text-lg tracking-tight truncate">
                          {sess.session_date}
                        </span>
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                            isSessionLive ? 'text-yellow-400' : 'text-zinc-500'
                          }`}
                        >
                          {isSessionLive ? 'Live' : 'Completed'}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                        {presentCount} of {totalCount} present · {turnoutPct}%
                      </p>

                      {/* Turnout progress */}
                      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                          style={{ width: `${turnoutPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Controls for this specific session */}
                    <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
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
                        className="w-full px-4 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Manage &amp; View</span>
                      </button>

                      <div className="flex items-center gap-2">
                      {isSessionLive && (
                        <button
                          type="button"
                          onClick={onLaunchKiosk}
                          className="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 cursor-pointer active:scale-95"
                          title="Pass Phone for this session"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Pass Phone</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleSessionStatus(sess)}
                        className="flex-1 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                        title={isSessionLive ? 'End Session' : 'Reopen Session'}
                      >
                        {!isSessionLive && <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />}
                        <span>{isSessionLive ? 'End Session' : 'Reopen'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => exportSessionCSV(sess, selectedEvent.name)}
                        className="px-3 py-2 text-zinc-400 hover:text-white rounded-xl transition border border-zinc-800 hover:bg-zinc-800 cursor-pointer"
                        title="Download CSV for this date"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>

                      {isSessionLive && (
                        <button
                          type="button"
                          onClick={() => setShareSession(sess)}
                          className="px-3 py-2 text-zinc-400 hover:text-white rounded-xl transition border border-zinc-800 hover:bg-zinc-800 cursor-pointer"
                          title="Share self check-in link & QR"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteSession(sess.id, sess.session_date)}
                        className="px-3 py-2 text-zinc-500 hover:text-rose-400 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition cursor-pointer"
                        title="Delete Session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="min-h-[40vh] sm:min-h-[320px] flex flex-col items-center justify-center gap-3 p-8 sm:p-10 text-center bg-zinc-900 border border-dashed border-zinc-700/80 rounded-3xl">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 text-zinc-500 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <p className="text-base sm:text-lg font-black text-zinc-200">No sessions yet</p>
              <p className="text-xs sm:text-sm text-zinc-500 max-w-xs">
                Tap Take Attendance above to record your first gathering.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* FULL SESSION MANAGEMENT MODAL (The Interactive Open Hub) */}
        {/* ========================================================= */}
        {managingSession && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full sm:max-w-2xl h-[92dvh] sm:h-[86vh] bg-zinc-900 sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-zinc-800 shrink-0">
                <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                    {selectedEvent.name}
                    <span className="text-zinc-700"> · </span>
                    <span className={managingSession.status === 'open' ? 'text-yellow-400' : 'text-zinc-500'}>
                      {managingSession.status === 'open' ? 'Live' : 'Completed'}
                    </span>
                  </p>

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
                  className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
                </div>
              </div>

              {/* Summary & Actions */}
              <div className="px-5 sm:px-6 py-4 border-b border-zinc-800 space-y-3 shrink-0 bg-zinc-950/50">
                {(() => {
                  const presentMemberIds = new Set(managingRecords.map(r => r.member_id));
                  const presentCount = activeMembers.filter(m => presentMemberIds.has(m.id)).length;
                  const totalCount = activeMembers.length;
                  const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                  return (
                    <>
                      <div>
                        <p className="text-sm text-zinc-400">
                          <span className="font-black text-white">{presentCount}</span> of {totalCount} present · {pct}%
                        </p>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {managingSession.status === 'open' ? (
                          <button
                            type="button"
                            onClick={onLaunchKiosk}
                            className="flex-1 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Pass Phone</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleSessionStatus(managingSession)}
                            className="flex-1 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reopen Session</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => exportSessionCSV(managingSession, selectedEvent.name)}
                          className="p-2.5 text-zinc-400 hover:text-white rounded-xl transition border border-zinc-800 hover:bg-zinc-800 cursor-pointer"
                          title="Download CSV"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>

                        {managingSession.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => handleToggleSessionStatus(managingSession)}
                            className="px-3.5 py-2.5 rounded-xl text-xs font-bold border border-zinc-800 text-zinc-400 hover:text-rose-300 hover:border-rose-900 transition cursor-pointer"
                            title="End Session"
                          >
                            End
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
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
                  {departments.map(dept => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setModalDeptFilter(dept)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                        modalDeptFilter === dept
                          ? 'bg-yellow-400 text-black font-bold'
                          : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      {dept === 'all' ? 'All Units' : dept}
                    </button>
                  ))}
                </div>
              </div>

              {/* Roster List with 1-Tap Toggle & Absent Outreach */}
              <div className="px-4 sm:px-5 py-4 flex-1 min-h-0 overflow-y-auto space-y-2">
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
                        className="p-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3"
                      >
                        {/* Member Info */}
                        <div
                          onClick={() => handleToggleManualAttendance(managingSession.id, member.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
                        >
                          <div className="w-9 h-9 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {member.full_name[0]?.toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-white truncate">
                              {member.full_name}
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                              {member.department || 'General'}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* If absent, show follow-up buttons */}
                          {!isPresent && member.phone && (
                            <>
                              <a
                                href={`tel:${member.phone}`}
                                className="p-2 rounded-xl text-zinc-400 hover:text-white transition border border-zinc-800 hover:bg-zinc-800"
                                title="Call member"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                                  member.full_name
                                )},%20we%20missed%20you%20at%20${encodeURIComponent(
                                  selectedEvent.name
                                )}%20today!%20Hope%20you%20are%20doing%20well.`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-xl text-zinc-400 hover:text-emerald-300 transition border border-zinc-800 hover:bg-zinc-800"
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
                                ? 'bg-yellow-400 text-black'
                                : 'text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
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

        {/* Self check-in Share (QR + link) modal */}
        <ShareCheckInModal
          session={shareSession}
          eventName={selectedEvent.name}
          isOpen={shareSession !== null}
          onClose={() => setShareSession(null)}
        />
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
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Events</h2>
        </div>

        {events.length > 0 && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 sm:px-6 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs sm:text-sm rounded-full transition flex items-center gap-2 shadow-lg shadow-yellow-950/40 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Event</span>
          </button>
        )}
      </div>

      {/* Events Cards Grid */}
      {events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {events.map(ev => {
            const evSessions = sessions.filter(s => s.event_id === ev.id);
            const isLive = activeSession?.event_id === ev.id;

            return (
              <div
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={`p-5 sm:p-6 rounded-3xl border transition cursor-pointer flex flex-col gap-4 hover:scale-[1.01] active:scale-[0.99] shadow-sm ${
                  isLive
                    ? 'bg-zinc-900 border-yellow-400/60 shadow-lg shadow-yellow-950/30'
                    : 'bg-zinc-900 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center border border-yellow-400/20 shrink-0">
                    <Calendar className="w-4 h-4" />
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

                <h3 className="text-2xl sm:text-[26px] font-black text-white leading-tight tracking-tight break-words">{ev.name}</h3>

                <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-sm text-zinc-400 font-semibold">
                    {evSessions.length} session{evSessions.length !== 1 ? 's' : ''}
                  </span>
                  <span className="w-9 h-9 rounded-full bg-yellow-400 text-black flex items-center justify-center shadow-md shadow-yellow-950/40">
                    <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State with Welcoming UI */
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl px-5 py-10 sm:p-10 text-center space-y-4 sm:space-y-5">
          <div>
            <h3 className="text-3xl sm:text-4xl font-black text-white mb-2 leading-tight text-balance">Welcome! Create Your First Event</h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">
              Add your regular gathering (e.g. Sunday Worship, Thursday Mass, Youth Camp) to start taking attendance.
            </p>
          </div>
          <div className="pt-2 px-1">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 sm:py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-sm sm:text-base rounded-2xl transition shadow-lg shadow-yellow-950/40 active:scale-95 cursor-pointer"
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
