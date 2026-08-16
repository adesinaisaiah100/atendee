import { db } from './db';
import type { Session } from '../types';

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    rows
      .map(row =>
        row
          .map(item => {
            const str = String(item ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 1. Export Specific Session Check-in Roster
export async function exportSessionCSV(session: Session, eventName: string) {
  const records = await db.attendance_records.where('session_id').equals(session.id).toArray();
  const memberIds = records.map(r => r.member_id);
  const members = await db.members.where('id').anyOf(memberIds).toArray();
  const memberMap = new Map(members.map(m => [m.id, m]));

  const rows: (string | number)[][] = [
    ['FELLOWSHIP ATTENDANCE ROSTER'],
    ['Event:', eventName],
    ['Date:', session.session_date],
    ['Status:', session.status.toUpperCase()],
    ['Total Present:', records.length],
    ['Exported At:', new Date().toLocaleString()],
    [],
    ['S/N', 'Full Name', 'Phone Number', 'Department', 'Checked In At', 'Source'],
  ];

  records.forEach((rec, idx) => {
    const member = memberMap.get(rec.member_id);
    rows.push([
      idx + 1,
      member?.full_name || 'Unknown Member',
      member?.phone || 'N/A',
      member?.department || 'General',
      new Date(rec.checked_in_at).toLocaleTimeString(),
      rec.source === 'self' ? 'Self Check-in' : 'Admin Manual',
    ]);
  });

  downloadCSV(`Attendance_${eventName.replace(/\s+/g, '_')}_${session.session_date}.csv`, rows);
}

// 2. Export Member Attendance Ledger / Master Rollup
export async function exportAllMembersAttendanceRateCSV(fellowshipId: string, title = 'Member_Attendance_Report') {
  const members = await db.members.where('fellowship_id').equals(fellowshipId).toArray();
  const closedSessions = await db.sessions
    .where('fellowship_id')
    .equals(fellowshipId)
    .and(s => s.status === 'closed')
    .toArray();

  const totalPossible = closedSessions.length;

  const rows: (string | number)[][] = [
    ['FELLOWSHIP MEMBER ATTENDANCE & FREQUENCY LEDGER'],
    ['Total Closed Sessions Counted:', totalPossible],
    ['Export Date:', new Date().toLocaleDateString()],
    [],
    [
      'S/N',
      'Full Name',
      'Phone Number',
      'Department',
      'Active Status',
      'Sessions Attended',
      'Total Possible',
      'Attendance Rate (%)',
      'Joined Date',
    ],
  ];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const attendedRecords = await db.attendance_records.where('member_id').equals(m.id).toArray();
    const attendedCount = attendedRecords.length;
    const rate = totalPossible > 0 ? Math.round((attendedCount / totalPossible) * 100) : 0;

    rows.push([
      i + 1,
      m.full_name,
      m.phone || 'N/A',
      m.department || 'General',
      m.is_active ? 'Active' : 'Deactivated',
      attendedCount,
      totalPossible,
      `${rate}%`,
      m.joined_at,
    ]);
  }

  downloadCSV(`${title}_${new Date().toISOString().split('T')[0]}.csv`, rows);
}
