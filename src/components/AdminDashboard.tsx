import React, { useMemo } from 'react';
import {
  Users,
  Calendar,
  Smartphone,
  Plus,
  HeartHandshake,
  FileSpreadsheet,
  ChevronRight,
  TrendingUp,
  Phone,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type {
  Session,
  EventTemplate,
  Member,
  AttendanceRecord,
  InactivityAlert,
} from '../types';
import { exportAllMembersAttendanceRateCSV } from '../lib/exportUtils';

interface AdminDashboardProps {
  fellowshipId: string;
  activeSession: Session | null;
  events: EventTemplate[];
  members: Member[];
  sessions: Session[];
  attendanceRecords: AttendanceRecord[];
  inactivityAlerts: InactivityAlert[];
  pendingCount?: number;
  onLaunchKiosk: () => void;
  onQuickStartSession: () => void;
  onOpenAddMember: () => void;
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
  inactivityAlerts,
  onLaunchKiosk,
  onQuickStartSession,
  onOpenAddMember,
  onCloseSession,
  onNavigateTab,
}) => {
  const activeMembers = useMemo(() => members.filter(m => m.is_active), [members]);
  const totalActive = activeMembers.length;

  const currentEvent = activeSession
    ? events.find(e => e.id === activeSession.event_id)
    : null;

  const todayAttendanceCount = activeSession
    ? attendanceRecords.filter(r => r.session_id === activeSession.id).length
    : 0;

  const todayAttendancePct =
    totalActive > 0 ? Math.round((todayAttendanceCount / totalActive) * 100) : 0;

  // Prepare Recharts trend data for past closed sessions
  const chartData = useMemo(() => {
    const sorted = [...sessions]
      .filter(s => s.status === 'closed' || s.id === activeSession?.id)
      .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
      .slice(-8); // Show latest 8 services

    return sorted.map(sess => {
      const ev = events.find(e => e.id === sess.event_id);
      const count = attendanceRecords.filter(r => r.session_id === sess.id).length;
      const formattedDate = new Date(sess.session_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

      return {
        name: `${formattedDate} (${ev?.name?.split(' ')[0] || 'Service'})`,
        date: sess.session_date,
        headcount: count,
        service: ev?.name || 'Service',
      };
    });
  }, [sessions, activeSession, events, attendanceRecords]);


  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-10">
      {/* 1. Live Service Card or 1-Tap Launcher */}
      {activeSession ? (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500 text-slate-950">
                  <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                  Service is Live!
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Started {new Date(activeSession.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white">
                {currentEvent?.name || 'Fellowship Gathering'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Date: {activeSession.session_date}
              </p>
            </div>

            {/* Attendance Big Meter */}
            <div className="flex items-center gap-3 bg-slate-950/80 p-3 sm:p-4 rounded-2xl border border-slate-800">
              <div className="text-center pr-3 border-r border-slate-800">
                <div className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {todayAttendanceCount}
                </div>
                <div className="text-[11px] text-slate-400 font-semibold">
                  of {totalActive} Present ({todayAttendancePct}%)
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onLaunchKiosk}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Pass Phone</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCloseSession(activeSession.id)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg transition"
                >
                  End Service
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-white">No Attendance in Progress</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Ready to take attendance? Start today's service in 1 click and hand the phone around.
            </p>
          </div>
          <button
            type="button"
            onClick={onQuickStartSession}
            className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 active:scale-95 text-slate-950 font-extrabold text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
          >
            <Plus className="w-5 h-5" />
            <span>Start Today's Attendance</span>
          </button>
        </div>
      )}

      {/* 2. Simple Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={onOpenAddMember}
          className="p-4 bg-slate-900 hover:bg-slate-800/80 active:scale-95 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition flex flex-col justify-between shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white">+ Add Person</div>
            <div className="text-[11px] text-slate-400">Add to roster</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('events')}
          className="p-4 bg-slate-900 hover:bg-slate-800/80 active:scale-95 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition flex flex-col justify-between shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white">Services &amp; Gatherings</div>
            <div className="text-[11px] text-slate-400">View or open date</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('missing')}
          className="p-4 bg-slate-900 hover:bg-slate-800/80 active:scale-95 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition flex flex-col justify-between shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white">
              Missing ({inactivityAlerts.length})
            </div>
            <div className="text-[11px] text-slate-400">Pastoral outreach</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => exportAllMembersAttendanceRateCSV(fellowshipId, 'Attendance_Master')}
          className="p-4 bg-slate-900 hover:bg-slate-800/80 active:scale-95 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition flex flex-col justify-between shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white">Export Excel/CSV</div>
            <div className="text-[11px] text-slate-400">1-click download</div>
          </div>
        </button>
      </div>

      {/* 3. Recharts Attendance Trend Visualization */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Recent Attendance Numbers
            </h3>
            <p className="text-xs text-slate-400">Headcount attendance for each service</p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-300 font-semibold">Attendees Present</span>
            </div>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Bar
                  dataKey="headcount"
                  name="Attendees Count"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800">
            <Calendar className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">No Services Recorded Yet</p>
            <p className="text-xs text-slate-500">
              When you record your first service, attendance numbers will display here automatically!
            </p>
          </div>
        )}
      </div>

      {/* 4. Missing Members Quick Welfare Follow-up */}
      {inactivityAlerts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Who's Missing? (Welfare Follow-up)</h3>
                <p className="text-xs text-slate-400">
                  {inactivityAlerts.length} member{inactivityAlerts.length > 1 ? 's' : ''} haven't been seen in recent services
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('missing')}
              className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-0.5"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inactivityAlerts.slice(0, 3).map(alert => (
              <div
                key={alert.member.id}
                className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm truncate">
                    {alert.member.full_name}
                  </div>
                  <div className="text-[11px] text-rose-400 font-semibold">
                    Missed last {alert.consecutive_missed} services
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {alert.member.phone && (
                    <>
                      <a
                        href={`tel:${alert.member.phone}`}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
                        title="Call"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                      <a
                        href={`https://wa.me/${alert.member.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(
                          alert.member.full_name
                        )},%20we%20missed%20you%20at%20fellowship!`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-emerald-950 text-emerald-400 hover:bg-emerald-900 transition border border-emerald-800/40"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Clean Empty State (When starting fresh) */}
      {totalActive === 0 && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 rounded-3xl text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Welcome to Your Fellowship App!</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Get started in 30 seconds: Add your members to the roster, then tap "Pass Phone" during service to start taking attendance.
          </p>

          <button
            type="button"
            onClick={onOpenAddMember}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm rounded-2xl transition shadow-lg shadow-emerald-950"
          >
            + Add Your First Member
          </button>
        </div>
      )}
    </div>
  );
};
