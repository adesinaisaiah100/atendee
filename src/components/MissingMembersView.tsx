import React, { useState, useMemo } from 'react';
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  Search,
  Calendar,
  Check,
  Clock,
  Download,
} from 'lucide-react';
import type { EventTemplate, Session, Member, AttendanceRecord, InactivityAlert } from '../types';
import { markAttendance } from '../lib/syncEngine';
import { downloadCSV } from '../lib/exportUtils';
import { DEFAULT_UNIT, getUnitFilterOptions } from '../lib/constants';

interface MissingMembersViewProps {
  fellowshipId: string;
  events: EventTemplate[];
  sessions: Session[];
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  inactivityAlerts: InactivityAlert[];
  inactivityThreshold: number;
  setInactivityThreshold: (threshold: number) => void;
  onRefresh: () => void;
}

export const MissingMembersView: React.FC<MissingMembersViewProps> = ({
  events,
  sessions,
  members,
  attendanceRecords,
  inactivityAlerts,
  inactivityThreshold,
  setInactivityThreshold,
  onRefresh,
}) => {
  // Mode selection: 'by_session' (who missed today/specific event) vs 'consecutive' (who missed 1, 2, 3+ services)
  const [viewMode, setViewMode] = useState<'by_session' | 'consecutive'>('by_session');

  // By-session filters
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || '');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // Consecutive filters
  const [consecutiveEventFilter, setConsecutiveEventFilter] = useState<string>('all');

  // Shared search & department filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const departments = useMemo(() => getUnitFilterOptions(members), [members]);
  const activeMembers = useMemo(() => members.filter(m => m.is_active), [members]);

  // Available sessions for selected event
  const currentEventSessions = useMemo(() => {
    if (!selectedEventId) return [];
    return sessions
      .filter(s => s.event_id === selectedEventId)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
  }, [sessions, selectedEventId]);

  // Selected session (defaults to newest/live session if not chosen)
  const effectiveSession = useMemo(() => {
    if (selectedSessionId) {
      return currentEventSessions.find(s => s.id === selectedSessionId) || currentEventSessions[0] || null;
    }
    return currentEventSessions[0] || null;
  }, [currentEventSessions, selectedSessionId]);

  const selectedEventObj = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Records for effective session (tombstones are not presence)
  const effectiveRecords = useMemo(() => {
    if (!effectiveSession) return [];
    return attendanceRecords.filter(
      r => r.session_id === effectiveSession.id && r.status !== 'removed'
    );
  }, [attendanceRecords, effectiveSession]);

  // Absentees for the selected session
  const sessionAbsentees = useMemo(() => {
    if (!effectiveSession) return [];
    const presentIds = new Set(effectiveRecords.map(r => r.member_id));
    return activeMembers.filter(m => !presentIds.has(m.id));
  }, [activeMembers, effectiveRecords, effectiveSession]);

  // Filtered session absentees
  const filteredSessionAbsentees = useMemo(() => {
    return sessionAbsentees.filter(m => {
      if (departmentFilter !== 'all' && m.department !== departmentFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.full_name.toLowerCase().includes(q) ||
          (m.phone && m.phone.includes(q)) ||
          (m.check_in_code && m.check_in_code.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [sessionAbsentees, departmentFilter, searchQuery]);

  // Base consecutive alerts (all events from props, or scoped to selected event)
  const eventScopedAlerts = useMemo<InactivityAlert[]>(() => {
    if (consecutiveEventFilter === 'all') return inactivityAlerts;

    const eventSessions = sessions
      .filter(s => s.event_id === consecutiveEventFilter)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

    const recentSessions = eventSessions.slice(0, inactivityThreshold);
    if (recentSessions.length === 0) return [];

    const alerts: InactivityAlert[] = [];
    for (const member of activeMembers) {
      const attendedSessionIds = new Set(
        attendanceRecords
          .filter(r => r.member_id === member.id && r.status !== 'removed')
          .map(r => r.session_id)
      );

      let consecutiveMissed = 0;
      for (const session of recentSessions) {
        if (!attendedSessionIds.has(session.id)) {
          consecutiveMissed++;
        } else {
          break;
        }
      }

      if (consecutiveMissed >= Math.min(inactivityThreshold, recentSessions.length)) {
        const attendedSessions = eventSessions.filter(s => attendedSessionIds.has(s.id));
        const lastAttendedDate = attendedSessions.length > 0 ? attendedSessions[0].session_date : null;
        const totalPossible = eventSessions.length;
        const totalAttended = attendedSessions.length;
        const ratePct = totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;

        alerts.push({
          member,
          consecutive_missed: consecutiveMissed,
          last_attended_date: lastAttendedDate,
          attendance_rate_pct: ratePct,
          total_attended: totalAttended,
          total_possible: totalPossible,
        });
      }
    }

    return alerts.sort((a, b) => b.consecutive_missed - a.consecutive_missed);
  }, [consecutiveEventFilter, inactivityAlerts, sessions, attendanceRecords, activeMembers, inactivityThreshold]);

  // Filtered consecutive alerts
  const filteredConsecutiveAlerts = useMemo(() => {
    return eventScopedAlerts.filter(a => {
      if (departmentFilter !== 'all' && a.member.department !== departmentFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.member.full_name.toLowerCase().includes(q) ||
          (a.member.phone && a.member.phone.includes(q)) ||
          (a.member.check_in_code && a.member.check_in_code.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [eventScopedAlerts, departmentFilter, searchQuery]);

  // 1-Tap Mark Member Present for this session
  const handleMarkPresent = async (sessionId: string, memberId: string) => {
    await markAttendance(sessionId, memberId, 'admin_manual');
    onRefresh();
  };

  const csvSafe = (value: string | number | null | undefined) => value ?? '';

  // Export exactly what the admin is looking at (filters and search applied).
  const exportAbsenteesCSV = () => {
    const rows: (string | number)[][] = [
      ['MISSING MEMBERS REPORT'],
      ['Event', selectedEventObj?.name || '—'],
      ['Session', effectiveSession?.session_date || '—'],
      ['Exported', new Date().toLocaleString()],
      ['Unit filter', departmentFilter === 'all' ? 'All units' : departmentFilter],
      ['Search', searchQuery || '—'],
      [],
      ['Full Name', 'Phone', 'Hostel / Hall', 'Room / Block', 'Unit', 'Check-in Code', 'Status'],
      ...filteredSessionAbsentees.map(m => [
        csvSafe(m.full_name),
        csvSafe(m.phone),
        csvSafe(m.hostel),
        csvSafe(m.room_or_block),
        csvSafe(m.department || DEFAULT_UNIT),
        csvSafe(m.check_in_code),
        'Absent',
      ]),
    ];
    downloadCSV(
      `missing-${(selectedEventObj?.name || 'session').replace(/\s+/g, '-').toLowerCase()}-${
        effectiveSession?.session_date || 'no-date'
      }.csv`,
      rows
    );
  };

  // Full register with presence for the session — the safety net for follow-up.
  const exportRegisterCSV = () => {
    const presentIds = new Set(effectiveRecords.map(r => r.member_id));
    const rows: (string | number)[][] = [
      ['ATTENDANCE REGISTER'],
      ['Event', selectedEventObj?.name || '—'],
      ['Session', effectiveSession?.session_date || '—'],
      ['Exported', new Date().toLocaleString()],
      ['Present', presentIds.size],
      ['Roster', activeMembers.length],
      [],
      ['Full Name', 'Status', 'Phone', 'Hostel / Hall', 'Room / Block', 'Unit', 'Check-in Code'],
      ...activeMembers.map(m => [
        csvSafe(m.full_name),
        presentIds.has(m.id) ? 'Present' : 'Absent',
        csvSafe(m.phone),
        csvSafe(m.hostel),
        csvSafe(m.room_or_block),
        csvSafe(m.department || DEFAULT_UNIT),
        csvSafe(m.check_in_code),
      ]),
    ];
    downloadCSV(
      `register-${(selectedEventObj?.name || 'session').replace(/\s+/g, '-').toLowerCase()}-${
        effectiveSession?.session_date || 'no-date'
      }.csv`,
      rows
    );
  };

  const exportInactivityCSV = () => {
    const rows: (string | number)[][] = [
      ['CONSECUTIVE ABSENCE REPORT'],
      ['Threshold', `${inactivityThreshold}+ missed services`],
      ['Exported', new Date().toLocaleString()],
      ['Unit filter', departmentFilter === 'all' ? 'All units' : departmentFilter],
      [],
      ['Full Name', 'Phone', 'Hostel / Hall', 'Room / Block', 'Unit', 'Check-in Code', 'Consecutive Missed', 'Last Attended', 'Attendance %'],
      ...filteredConsecutiveAlerts.map(a => [
        csvSafe(a.member.full_name),
        csvSafe(a.member.phone),
        csvSafe(a.member.hostel),
        csvSafe(a.member.room_or_block),
        csvSafe(a.member.department || DEFAULT_UNIT),
        csvSafe(a.member.check_in_code),
        a.consecutive_missed,
        csvSafe(a.last_attended_date || 'Never'),
        a.attendance_rate_pct,
      ]),
    ];
    downloadCSV(`consecutive-absences-${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  return (
    <div className="space-y-6 w-full pb-20 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Missing Members &amp; Follow-up</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Track members who missed today's gathering or have been absent for consecutive weeks.
          </p>
        </div>

        {/* View Mode Segmented Pill */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 self-start sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode('by_session')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'by_session'
                ? 'bg-yellow-400 text-black shadow-md shadow-yellow-950/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>By Specific Service</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('consecutive')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'consecutive'
                ? 'bg-yellow-400 text-black shadow-md shadow-yellow-950/40'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Consecutive Absences</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: BY SPECIFIC SERVICE / SESSION (Who missed today or a past service) */}
      {/* ========================================================================= */}
      {viewMode === 'by_session' && (
        <div className="space-y-5">
          {/* Controls Bar: Event & Session Pickers */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Event Selector */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                  1. Select Event / Gathering
                </label>
                <select
                  value={selectedEventId}
                  onChange={e => {
                    setSelectedEventId(e.target.value);
                    setSelectedSessionId(''); // reset to newest
                  }}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs font-bold focus:border-yellow-400 focus:outline-none"
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Session Date Selector */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                  2. Select Service Date
                </label>
                <select
                  value={effectiveSession?.id || ''}
                  onChange={e => setSelectedSessionId(e.target.value)}
                  disabled={currentEventSessions.length === 0}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs font-bold focus:border-yellow-400 focus:outline-none disabled:opacity-50"
                >
                  {currentEventSessions.map(sess => (
                    <option key={sess.id} value={sess.id}>
                      {sess.session_date} {sess.status === 'open' ? '(LIVE NOW)' : '(Completed)'}
                    </option>
                  ))}
                  {currentEventSessions.length === 0 && (
                    <option value="">No sessions recorded for this event</option>
                  )}
                </select>
              </div>
            </div>

            {/* Live Metrics for the selected session */}
            {effectiveSession && (
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-sm text-zinc-400">
                  <span className="font-black text-white">{effectiveRecords.length}</span> present ·{' '}
                  <span className="font-black text-white">{sessionAbsentees.length}</span> absent · {activeMembers.length} on roster
                </p>
                {(() => {
                  const pct = activeMembers.length > 0 ? Math.round((effectiveRecords.length / activeMembers.length) * 100) : 0;
                  return (
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-yellow-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Search & Unit Filters */}
            <div className="space-y-2.5 pt-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search absentee name, phone, or code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white placeholder-zinc-500 text-xs font-medium focus:outline-none"
                />
              </div>

              {/* Department Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {departments.map(dept => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer flex-shrink-0 ${
                      departmentFilter === dept
                        ? 'bg-yellow-400 text-black font-bold'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    {dept === 'all' ? 'All Units' : dept}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Absentees List for this Service */}
          {filteredSessionAbsentees.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                  Absent · {effectiveSession?.session_date} ({filteredSessionAbsentees.length})
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportAbsenteesCSV}
                    disabled={filteredSessionAbsentees.length === 0}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-yellow-400/60 text-zinc-300 hover:text-yellow-300 text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Absent List</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportRegisterCSV}
                    disabled={!effectiveSession || activeMembers.length === 0}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-600 text-zinc-300 text-[11px] font-bold transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                    title="Export the full roster with present/absent status"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Full Register</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredSessionAbsentees.map(member => (
                  <div
                    key={member.id}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-4 sm:p-5 rounded-3xl transition shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="mb-2">
                        <h4 className="font-bold text-white text-base truncate">
                          {member.full_name}
                        </h4>
                        <span className="text-xs text-zinc-500 block mt-0.5 truncate">
                          {member.department || DEFAULT_UNIT}
                          {member.hostel
                            ? ` / ${member.hostel}${member.room_or_block ? `, ${member.room_or_block}` : ''}`
                            : ''}
                        </span>
                      </div>

                      {member.check_in_code && (
                        <div className="text-[11px] font-mono text-zinc-500 mt-1">
                          {member.check_in_code}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                      <div className="flex items-center gap-2">
                        {member.phone ? (
                          <>
                            <a
                              href={`tel:${member.phone}`}
                              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition flex items-center justify-center border border-zinc-700"
                              title="Call member"
                            >
                              <Phone className="w-4 h-4 text-yellow-400" />
                            </a>
                            <a
                              href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                                member.full_name
                              )},%20we%20missed%20you%20at%20${encodeURIComponent(
                                selectedEventObj?.name || 'fellowship'
                              )}%20today!%20Hope%20you%20are%20doing%20well.`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-yellow-950/40"
                              title="Send WhatsApp care message"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>WhatsApp</span>
                            </a>
                          </>
                        ) : (
                          <span className="text-[11px] text-zinc-500 italic py-1 flex-1 text-center">
                            No phone recorded
                          </span>
                        )}
                      </div>

                      {/* 1-Tap Manual Mark Present Override */}
                      {effectiveSession && (
                        <button
                          type="button"
                          onClick={() => handleMarkPresent(effectiveSession.id, member.id)}
                          className="w-full py-2 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-yellow-300 rounded-xl text-[11px] font-bold border border-zinc-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-yellow-400" />
                          <span>Mark Present (Late Entry)</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-zinc-900 border border-zinc-800 rounded-3xl space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center mx-auto mb-3 border border-yellow-400/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">100% Attendance Recorded!</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                All active members on your roster were checked in for this service session.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: CONSECUTIVE INACTIVITY (Missed 1 week, 2 weeks, 3+ weeks) */}
      {/* ========================================================================= */}
      {viewMode === 'consecutive' && (
        <div className="space-y-5">
          {/* Threshold & Event Selector */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Event Filter */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Gathering / Event
                </label>
                <select
                  value={consecutiveEventFilter}
                  onChange={e => setConsecutiveEventFilter(e.target.value)}
                  className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-xs font-bold focus:border-yellow-400 focus:outline-none"
                >
                  <option value="all">All Events &amp; Gatherings</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Threshold Selector with 1 Service Included! */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Missed Threshold
                </label>
                <select
                  value={inactivityThreshold}
                  onChange={e => setInactivityThreshold(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 text-yellow-400 rounded-xl px-3.5 py-2 text-xs font-black focus:border-yellow-400 focus:outline-none"
                >
                  <option value={1}>1 Service (1 Week / Last Service)</option>
                  <option value={2}>2 Services (2 Weeks)</option>
                  <option value={3}>3 Services (3 Weeks)</option>
                  <option value={4}>4 Services (4 Weeks)</option>
                  <option value={5}>5+ Services</option>
                </select>
              </div>
            </div>

            {/* Search & Unit Filter */}
            <div className="space-y-2.5 pt-2 border-t border-zinc-800">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone, or code..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-yellow-400 rounded-xl text-white placeholder-zinc-500 text-xs font-medium focus:outline-none"
                />
              </div>

              {/* Department Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {departments.map(dept => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer flex-shrink-0 ${
                      departmentFilter === dept
                        ? 'bg-yellow-400 text-black font-bold'
                        : 'text-zinc-500 hover:text-white'
                    }`}
                  >
                    {dept === 'all' ? 'All Units' : dept}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Consecutive Alerts Cards */}
          {filteredConsecutiveAlerts.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                  Inactive · {inactivityThreshold}+ Missed ({filteredConsecutiveAlerts.length})
                </h3>
                <button
                  type="button"
                  onClick={exportInactivityCSV}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-yellow-400/60 text-zinc-300 hover:text-yellow-300 text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredConsecutiveAlerts.map(alert => (
                  <div
                    key={alert.member.id}
                    className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl transition shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white text-base truncate">
                            {alert.member.full_name}
                          </div>
                          <span className="text-xs text-zinc-400 block mt-0.5">
                            {alert.member.department || 'General'}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-zinc-800 text-zinc-200 whitespace-nowrap">
                          {alert.consecutive_missed} Missed
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-zinc-400 mt-3 bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
                        <div className="flex items-center justify-between">
                          <span>Last Attended:</span>
                          <span className="text-zinc-200 font-bold">
                            {alert.last_attended_date || 'Never recorded'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Attendance Consistency:</span>
                          <span className="text-zinc-100 font-bold">
                            {alert.attendance_rate_pct}% ({alert.total_attended}/{alert.total_possible})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Outreach Action Buttons */}
                    <div className="pt-3 border-t border-zinc-800 flex items-center gap-2">
                      {alert.member.phone ? (
                        <>
                          <a
                            href={`tel:${alert.member.phone}`}
                            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 text-xs font-bold transition flex items-center justify-center border border-zinc-700"
                            title="Call member"
                          >
                            <Phone className="w-4 h-4 text-yellow-400" />
                          </a>
                          <a
                            href={`https://wa.me/${alert.member.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                              alert.member.full_name
                            )},%20we%20missed%20you%20at%20fellowship%20recently!%20Hope%20everything%20is%20well%20with%20you.`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-yellow-950/40"
                            title="Message on WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>WhatsApp</span>
                          </a>
                        </>
                      ) : (
                        <span className="text-[11px] text-zinc-500 italic py-1 text-center w-full">
                          No phone recorded
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-zinc-900 border border-zinc-800 rounded-3xl space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center mx-auto mb-3 border border-yellow-400/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">Everyone is Consistent!</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                No active members have missed {inactivityThreshold} or more consecutive services.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
