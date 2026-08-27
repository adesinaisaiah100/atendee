import React, { useState, useMemo } from 'react';
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  Filter,
  Search,
  Calendar,
  Check,
  Clock,
} from 'lucide-react';
import type { EventTemplate, Session, Member, AttendanceRecord, InactivityAlert } from '../types';
import { db } from '../lib/db';
import { queueMutation } from '../lib/syncEngine';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

  const departments = ['all', 'Choir', 'Ushering', 'Media', 'Technical', 'Welfare', 'Bible Study', 'General'];
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

  // Records for effective session
  const effectiveRecords = useMemo(() => {
    if (!effectiveSession) return [];
    return attendanceRecords.filter(r => r.session_id === effectiveSession.id);
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

  // Filtered consecutive alerts
  const filteredConsecutiveAlerts = useMemo(() => {
    return inactivityAlerts.filter(a => {
      if (consecutiveEventFilter !== 'all') {
        // Event filter
      }
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
  }, [inactivityAlerts, departmentFilter, searchQuery, consecutiveEventFilter]);

  // 1-Tap Mark Member Present for this session
  const handleMarkPresent = async (sessionId: string, memberId: string) => {
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
        console.warn('Cloud mark present error:', err);
      }
    }
    onRefresh();
  };

  return (
    <div className="space-y-6 w-full pb-20 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <h2 className="text-2xl font-black text-white">Missing Members &amp; Follow-up</h2>
          </div>
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
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800 text-center">
                <div className="bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">
                    Present
                  </span>
                  <span className="text-lg font-black text-yellow-400">
                    {effectiveRecords.length}
                  </span>
                </div>
                <div className="bg-zinc-950 p-2.5 rounded-2xl border border-rose-900/30">
                  <span className="text-[10px] text-rose-300 font-bold block uppercase tracking-wider">
                    Absent (Missing)
                  </span>
                  <span className="text-lg font-black text-rose-400">
                    {sessionAbsentees.length}
                  </span>
                </div>
                <div className="bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">
                    Total Roster
                  </span>
                  <span className="text-lg font-black text-white">
                    {activeMembers.length}
                  </span>
                </div>
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
                <span className="text-[11px] text-zinc-500 font-semibold mr-1 flex items-center gap-1 flex-shrink-0">
                  <Filter className="w-3 h-3 text-yellow-400" /> Unit:
                </span>
                {departments.map(dept => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex-shrink-0 ${
                      departmentFilter === dept
                        ? 'bg-yellow-400 text-black font-bold'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
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
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                  Members Absent on {effectiveSession?.session_date} ({filteredSessionAbsentees.length})
                </h3>
                <span className="text-[11px] text-zinc-500 font-semibold">
                  Tap WhatsApp to send a personalized care message
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredSessionAbsentees.map(member => (
                  <div
                    key={member.id}
                    className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-4 sm:p-5 rounded-3xl transition shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-white text-base truncate">
                            {member.full_name}
                          </h4>
                          <span className="text-xs text-zinc-400 block mt-0.5">
                            {member.department || 'General'}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                          Absent
                        </span>
                      </div>

                      {member.check_in_code && (
                        <div className="text-[11px] font-mono text-zinc-400 mt-1">
                          Code: <span className="text-yellow-400 font-bold">{member.check_in_code}</span>
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
                <span className="text-[11px] text-zinc-500 font-semibold mr-1 flex items-center gap-1 flex-shrink-0">
                  <Filter className="w-3 h-3 text-yellow-400" /> Unit:
                </span>
                {departments.map(dept => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex-shrink-0 ${
                      departmentFilter === dept
                        ? 'bg-yellow-400 text-black font-bold'
                        : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
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
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
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
                        <span className="text-yellow-400 font-bold">
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
