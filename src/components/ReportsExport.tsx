import React, { useState, useMemo } from 'react';
import {
  Download,
  Calendar,
  Layers,
  Search,
  TrendingUp,
  PieChart as PieIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { Member, Session, EventTemplate, AttendanceRecord, Term } from '../types';
import { downloadCSV } from '../lib/exportUtils';

interface ReportsExportProps {
  fellowshipId?: string;
  members: Member[];
  sessions: Session[];
  events: EventTemplate[];
  attendanceRecords: AttendanceRecord[];
  terms: Term[];
}

export const ReportsExport: React.FC<ReportsExportProps> = ({
  members,
  sessions,
  events,
  attendanceRecords,
  terms,
}) => {
  const [selectedTermId, setSelectedTermId] = useState<string>('all');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const activeMembers = useMemo(() => members.filter(m => m.is_active), [members]);

  // Filtered Sessions according to Term and Event
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (selectedEventId !== 'all' && s.event_id !== selectedEventId) return false;
      if (selectedTermId !== 'all') {
        const term = terms.find(t => t.id === selectedTermId);
        if (term) {
          if (s.session_date < term.start_date || s.session_date > term.end_date) return false;
        }
      }
      return true;
    });
  }, [sessions, selectedEventId, selectedTermId, terms]);

  const closedSessions = useMemo(() => {
    return filteredSessions.filter(s => s.status === 'closed');
  }, [filteredSessions]);

  // Compute attendance ledger per member for the selected scope
  const memberScores = useMemo(() => {
    const totalPossible = closedSessions.length;
    const sessionIds = new Set(closedSessions.map(s => s.id));

    return activeMembers
      .map(member => {
        const memberAtt = attendanceRecords.filter(
          r => r.member_id === member.id && sessionIds.has(r.session_id)
        );
        const attendedCount = memberAtt.length;
        const pct = totalPossible > 0 ? Math.round((attendedCount / totalPossible) * 100) : 0;

        // find last seen
        const attendedSessions = closedSessions
          .filter(s => memberAtt.some(r => r.session_id === s.id))
          .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

        const lastSeen = attendedSessions.length > 0 ? attendedSessions[0].session_date : null;

        return {
          member,
          attendedCount,
          totalPossible,
          pct,
          lastSeen,
        };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [activeMembers, closedSessions, attendanceRecords]);

  // Search filtered member scores
  const filteredScores = useMemo(() => {
    if (!searchQuery.trim()) return memberScores;
    const q = searchQuery.toLowerCase();
    return memberScores.filter(
      item =>
        item.member.full_name.toLowerCase().includes(q) ||
        (item.member.department && item.member.department.toLowerCase().includes(q))
    );
  }, [memberScores, searchQuery]);

  // Recharts Bar Data
  const trendBarData = useMemo(() => {
    return [...closedSessions]
      .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
      .slice(-10)
      .map(s => {
        const ev = events.find(e => e.id === s.event_id);
        const count = attendanceRecords.filter(r => r.session_id === s.id).length;
        const formattedDate = new Date(s.session_date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
        return {
          name: `${formattedDate}`,
          attendance: count,
          service: ev?.name || 'Service',
        };
      });
  }, [closedSessions, events, attendanceRecords]);

  // Recharts Donut Pie Data (Consistency Breakdown)
  const pieData = useMemo(() => {
    const high = memberScores.filter(s => s.pct >= 75).length;
    const medium = memberScores.filter(s => s.pct >= 50 && s.pct < 75).length;
    const low = memberScores.filter(s => s.pct < 50).length;

    return [
      { name: 'Regular (≥75%)', value: high, color: '#10b981' },
      { name: 'Occasional (50-74%)', value: medium, color: '#f59e0b' },
      { name: 'Missing / At Risk (<50%)', value: low, color: '#f43f5e' },
    ].filter(item => item.value > 0);
  }, [memberScores]);

  const handleExportTermCSV = () => {
    const termObj = terms.find(t => t.id === selectedTermId);
    const title = termObj ? `Term_Report_${termObj.name.replace(/\s+/g, '_')}` : 'Fellowship_Attendance_Master';

    const rows: (string | number)[][] = [
      ['FELLOWSHIP ATTENDANCE RATE REPORT'],
      ['Scope:', termObj ? termObj.name : 'All Recorded Services'],
      ['Total Services Evaluated:', closedSessions.length],
      ['Exported At:', new Date().toLocaleString()],
      [],
      ['Rank', 'Full Name', 'Unit / Department', 'Phone', 'Attended', 'Possible', 'Attendance Rate (%)', 'Last Seen'],
    ];

    memberScores.forEach((item, idx) => {
      rows.push([
        idx + 1,
        item.member.full_name,
        item.member.department || 'General',
        item.member.phone || 'N/A',
        item.attendedCount,
        item.totalPossible,
        `${item.pct}%`,
        item.lastSeen || 'Never recorded',
      ]);
    });

    downloadCSV(`${title}_${new Date().toISOString().split('T')[0]}.csv`, rows);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header & Export CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-extrabold text-white">Reports &amp; Visual Analytics</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track member consistency, growth trends, and download formatted attendance spreadsheets.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportTermCSV}
          className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Download Excel / CSV</span>
        </button>
      </div>

      {/* 2. Filter & Scope Selector */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Semester / Term filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Semester / Period
          </label>
          <select
            value={selectedTermId}
            onChange={e => setSelectedTermId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-medium focus:outline-none"
          >
            <option value="all">All Dates Combined</option>
            {terms.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.start_date} to {t.end_date})
              </option>
            ))}
          </select>
        </div>

        {/* Service Type filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Gathering Type
          </label>
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-medium focus:outline-none"
          >
            <option value="all">All Services</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-slate-400" /> Search Member
          </label>
          <input
            type="text"
            placeholder="Type name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Recharts Side-by-Side Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart: Turnout per Service */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Turnout per Service
            </h3>
            <p className="text-xs text-slate-400 mb-4">Total number of attendees present</p>
          </div>

          {trendBarData.length > 0 ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendBarData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="attendance" name="Present" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-slate-500">
              No historical services recorded in this scope yet.
            </div>
          )}
        </div>

        {/* Donut Chart: Consistency Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-amber-400" /> Engagement Health
            </h3>
            <p className="text-xs text-slate-400 mb-2">Member consistency distribution</p>
          </div>

          {pieData.length > 0 ? (
            <div className="h-56 w-full flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Custom Mini Legend */}
              <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-300 font-semibold">
                {pieData.map(item => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>
                      {item.name}: <strong>{item.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-slate-500">
              Add members &amp; record services to see consistency chart.
            </div>
          )}
        </div>
      </div>

      {/* 4. Full Member Roster Rankings */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Member Consistency Roster ({closedSessions.length} Services Evaluated)
          </h3>
          <span className="text-xs text-slate-400">Ranked by Consistency %</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4 font-semibold">#</th>
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Unit</th>
                <th className="py-3 px-4 font-semibold">Attended</th>
                <th className="py-3 px-4 font-semibold">Attendance Rate</th>
                <th className="py-3 px-4 font-semibold">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredScores.length > 0 ? (
                filteredScores.map((item, idx) => (
                  <tr key={item.member.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 text-slate-500 font-mono font-bold">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div>{item.member.full_name}</div>
                      {item.member.phone && (
                        <div className="text-[11px] text-slate-500 font-mono font-normal">
                          {item.member.phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-xs">
                        {item.member.department || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      {item.attendedCount} / {item.totalPossible}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.pct >= 75
                                ? 'bg-emerald-500'
                                : item.pct >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-bold ${
                            item.pct >= 75
                              ? 'text-emerald-400'
                              : item.pct >= 50
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {item.pct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                      {item.lastSeen || 'Never recorded'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    No member records to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
