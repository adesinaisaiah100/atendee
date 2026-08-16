import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  AlertTriangle,
  Phone,
  MessageCircle,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Smartphone,
  CheckCircle2,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';
import type {
  Session,
  EventTemplate,
  Member,
  AttendanceRecord,
  InactivityAlert,
} from '../types';
import { computeInactivityAlerts } from '../lib/syncEngine';
import { exportSessionCSV } from '../lib/exportUtils';

interface AdminDashboardProps {
  fellowshipId: string;
  activeSession: Session | null;
  events: EventTemplate[];
  members: Member[];
  sessions: Session[];
  attendanceRecords: AttendanceRecord[];
  pendingCount: number;
  onLaunchKiosk: () => void;
  onOpenSessionModal: () => void;
  onCloseSession: (sessionId: string) => Promise<void>;
  onNavigateTab: (tab: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  fellowshipId,
  activeSession,
  events,
  members,
  sessions,
  attendanceRecords,
  pendingCount,
  onLaunchKiosk,
  onOpenSessionModal,
  onCloseSession,
  onNavigateTab,
}) => {
  const [inactivityThreshold, setInactivityThreshold] = useState(3);
  const [inactivityAlerts, setInactivityAlerts] = useState<InactivityAlert[]>([]);

  // Load Inactivity alerts
  useEffect(() => {
    computeInactivityAlerts(fellowshipId, undefined, inactivityThreshold)
      .then(setInactivityAlerts)
      .catch(console.error);
  }, [fellowshipId, inactivityThreshold, attendanceRecords, sessions, members]);

  const activeMembers = members.filter(m => m.is_active);
  const totalActive = activeMembers.length;

  const currentEvent = activeSession
    ? events.find(e => e.id === activeSession.event_id)
    : null;

  const todayAttendanceCount = activeSession
    ? attendanceRecords.filter(r => r.session_id === activeSession.id).length
    : 0;

  const todayAttendancePct =
    totalActive > 0 ? Math.round((todayAttendanceCount / totalActive) * 100) : 0;

  // Compute average attendance rate over past closed sessions
  const pastClosedSessions = sessions
    .filter(s => s.status === 'closed')
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

  const averageAttendanceCount =
    pastClosedSessions.length > 0
      ? Math.round(
          pastClosedSessions.reduce((acc, s) => {
            const count = attendanceRecords.filter(r => r.session_id === s.id).length;
            return acc + count;
          }, 0) / pastClosedSessions.length
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* 1. Live Active Session Hero Card */}
      {activeSession ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Active Live Session
                </span>
                <span className="text-xs text-slate-400">
                  Opened {new Date(activeSession.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                {currentEvent?.name || 'Fellowship Gathering'}
              </h2>
              <p className="text-sm text-slate-300">
                Date: {activeSession.session_date} • {activeSession.notes || 'Self-service check-in ready'}
              </p>
            </div>

            {/* Attendance Progress & Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <div className="text-center sm:text-left pr-4 sm:border-r border-slate-800">
                <div className="text-2xl font-black text-white">
                  {todayAttendanceCount}{' '}
                  <span className="text-xs text-slate-400 font-normal">/ {totalActive}</span>
                </div>
                <div className="text-xs font-semibold text-emerald-400">
                  {todayAttendancePct}% present
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onLaunchKiosk}
                  className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 active:scale-95"
                >
                  <Smartphone className="w-4 h-4" />
                  Pass Phone (Check-in)
                </button>
                <button
                  type="button"
                  onClick={() => onCloseSession(activeSession.id)}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 font-semibold text-xs sm:text-sm rounded-xl transition border border-slate-700 hover:border-rose-700/50"
                  title="Close session to end self check-in"
                >
                  Close Session
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">No Active Session Today</h3>
            <p className="text-sm text-slate-400">
              Ready to start service? Open today's session to enable self-service phone check-in.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenSessionModal}
            className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            Open Today's Session
          </button>
        </div>
      )}

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Active Roster</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalActive}</div>
          <div className="text-[11px] text-slate-500 mt-1">Verified members</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Average Turnout</span>
            <TrendingUp className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-white">{averageAttendanceCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {pastClosedSessions.length} past sessions
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Drifting Members</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{inactivityAlerts.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Missed ≥ {inactivityThreshold} sessions</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Pending Guests</span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400">{pendingCount}</div>
          <button
            onClick={() => onNavigateTab('pending')}
            className="text-[11px] text-indigo-300 hover:underline mt-1 flex items-center gap-0.5 font-medium"
          >
            Review pending <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 3. 🚨 Pastoral Care / Drifting Away Member Alert Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Pastoral Care Alert: Drifting Members</h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                  {inactivityAlerts.length} Flagged
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Members with 0 attendance in recent sessions who may need welfare follow-up
              </p>
            </div>
          </div>

          {/* Threshold selector */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Missed last:</span>
            <select
              value={inactivityThreshold}
              onChange={e => setInactivityThreshold(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none"
            >
              <option value={2}>2 Sessions</option>
              <option value={3}>3 Sessions</option>
              <option value={4}>4 Sessions</option>
              <option value={5}>5 Sessions</option>
            </select>
          </div>
        </div>

        {inactivityAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inactivityAlerts.map(alert => (
              <div
                key={alert.member.id}
                className="p-4 rounded-2xl bg-slate-950/60 border border-amber-900/30 hover:border-amber-700/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="font-bold text-white text-sm truncate">
                      {alert.member.full_name}
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-950 text-rose-300 border border-rose-800 whitespace-nowrap">
                      {alert.consecutive_missed} Missed
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mb-3 space-y-0.5">
                    <div>
                      Unit:{' '}
                      <span className="text-slate-300 font-medium">
                        {alert.member.department || 'General'}
                      </span>
                    </div>
                    <div>
                      Last Seen:{' '}
                      <span className="text-slate-300 font-medium">
                        {alert.last_attended_date || 'Never recorded'}
                      </span>
                    </div>
                    <div>
                      Overall Rate:{' '}
                      <span className="text-slate-300 font-medium">
                        {alert.attendance_rate_pct}% ({alert.total_attended}/{alert.total_possible})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Follow-up Quick Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                  {alert.member.phone ? (
                    <>
                      <a
                        href={`tel:${alert.member.phone}`}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1"
                        title="Direct Call"
                      >
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span>Call</span>
                      </a>
                      <a
                        href={`https://wa.me/${alert.member.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                          alert.member.full_name
                        )},%20we%20missed%20you%20at%20fellowship!`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold transition flex items-center justify-center gap-1 border border-emerald-800/50"
                        title="Send WhatsApp Follow-up Message"
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-400" />
                        <span>WhatsApp</span>
                      </a>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">No phone on file</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center bg-slate-950/40 rounded-2xl border border-slate-800">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm font-semibold text-white">All Members In Active Orbit</p>
            <p className="text-xs text-slate-400">
              No members have missed {inactivityThreshold} consecutive sessions.
            </p>
          </div>
        )}
      </div>

      {/* 4. Recent Sessions History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Recent Sessions & Headcounts</h3>
          </div>
          <button
            onClick={() => onNavigateTab('events')}
            className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1"
          >
            Manage all sessions <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                <th className="pb-3 font-semibold">Event Name</th>
                <th className="pb-3 font-semibold">Session Date</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Attendance</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sessions.slice(0, 6).map(sess => {
                const ev = events.find(e => e.id === sess.event_id);
                const count = attendanceRecords.filter(r => r.session_id === sess.id).length;
                const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;

                return (
                  <tr key={sess.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 font-bold text-white">{ev?.name || 'Event'}</td>
                    <td className="py-3.5 text-slate-300">{sess.session_date}</td>
                    <td className="py-3.5">
                      {sess.status === 'open' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Live Open
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{count}</span>
                        <span className="text-xs text-slate-400 font-medium">({pct}%)</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => exportSessionCSV(sess, ev?.name || 'Session')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition inline-flex items-center gap-1.5 border border-slate-700"
                        title="Download Session CSV"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Export CSV</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
