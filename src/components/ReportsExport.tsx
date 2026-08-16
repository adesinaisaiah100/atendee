import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Download,
  Calendar,
  Layers,
  Search,
} from 'lucide-react';
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

  // Group summary metrics
  const highAttendanceCount = memberScores.filter(s => s.pct >= 75).length;
  const mediumAttendanceCount = memberScores.filter(s => s.pct >= 50 && s.pct < 75).length;
  const atRiskCount = memberScores.filter(s => s.pct < 50).length;

  const handleExportTermCSV = () => {
    const termObj = terms.find(t => t.id === selectedTermId);
    const title = termObj ? `Term_Report_${termObj.name.replace(/\s+/g, '_')}` : 'Fellowship_Attendance_Master';

    const rows: (string | number)[][] = [
      ['FELLOWSHIP ATTENDANCE RATE REPORT'],
      ['Scope:', termObj ? termObj.name : 'All Recorded Sessions'],
      ['Total Closed Sessions Evaluated:', closedSessions.length],
      ['Exported At:', new Date().toLocaleString()],
      [],
      ['Rank', 'Full Name', 'Department', 'Phone', 'Attended', 'Possible', 'Attendance Rate (%)', 'Last Seen'],
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
    <div className="space-y-6">
      {/* 1. Header & Global Export Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Reports & Frequency Ledger</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aggregate attendance by session, term/semester, or individual member frequency rate.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportTermCSV}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
        >
          <Download className="w-4 h-4" />
          <span>Export Scope to CSV</span>
        </button>
      </div>

      {/* 2. Filter & Scope Selector */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Term filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Semester / Term Scope
          </label>
          <select
            value={selectedTermId}
            onChange={e => setSelectedTermId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-medium focus:outline-none"
          >
            <option value="all">All Dates & Semesters</option>
            {terms.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.start_date} to {t.end_date})
              </option>
            ))}
          </select>
        </div>

        {/* Event template filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Event Filter
          </label>
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-medium focus:outline-none"
          >
            <option value="all">All Events Combined</option>
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
            <Search className="w-3.5 h-3.5 text-slate-400" /> Search Name
          </label>
          <input
            type="text"
            placeholder="Filter member list..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 3. High-Level Frequency Distribution Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center justify-between">
            <span>High Frequency (≥75%)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{highAttendanceCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Core regular attendees</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center justify-between">
            <span>Moderate Frequency (50-74%)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{mediumAttendanceCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Occasional attendees</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400 font-semibold mb-1 flex items-center justify-between">
            <span>Low / At Risk (&lt;50%)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{atRiskCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Needs pastoral outreach</p>
        </div>
      </div>

      {/* 4. Full Member Scorecard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Member Frequency Rankings ({closedSessions.length} Sessions Counted)
          </h3>
          <span className="text-xs text-slate-400">Sorted by Attendance Rate</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider bg-slate-950/40">
                <th className="py-3 px-4 font-semibold">Rank</th>
                <th className="py-3 px-4 font-semibold">Member</th>
                <th className="py-3 px-4 font-semibold">Unit</th>
                <th className="py-3 px-4 font-semibold">Attended</th>
                <th className="py-3 px-4 font-semibold">Attendance Rate</th>
                <th className="py-3 px-4 font-semibold">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredScores.map((item, idx) => (
                <tr key={item.member.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 text-slate-500 font-mono font-bold">{idx + 1}</td>
                  <td className="py-3 px-4 font-bold text-white">
                    <div>{item.member.full_name}</div>
                    {item.member.phone && (
                      <div className="text-[11px] text-slate-500 font-mono font-normal">
                        {item.member.phone}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-xs">
                      {item.member.department || 'General'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-mono">
                    {item.attendedCount} / {item.totalPossible}
                  </td>
                  <td className="py-3 px-4">
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
                  <td className="py-3 px-4 text-slate-400 font-mono text-xs">
                    {item.lastSeen || 'Never recorded'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
