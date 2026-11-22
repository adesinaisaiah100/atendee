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

export type SessionExportMode = 'all' | 'present' | 'absent';

// 1. Export Specific Session Roster (Full Register, Present Only, or Absentees Only)
export async function exportSessionCSV(
  session: Session,
  eventName: string,
  mode: SessionExportMode = 'all'
) {
  const allRecords = await db.attendance_records.where('session_id').equals(session.id).toArray();
  const presentRecords = allRecords.filter(r => r.status !== 'removed');
  const presentByMemberId = new Map(presentRecords.map(r => [r.member_id, r]));

  const fellowshipMembers = (
    await db.members.where('fellowship_id').equals(session.fellowship_id).toArray()
  ).sort((a, b) => a.full_name.localeCompare(b.full_name));

  const activeMembers = fellowshipMembers.filter(m => m.is_active);
  const absentMembers = activeMembers.filter(m => !presentByMemberId.has(m.id));
  const presentMembers = activeMembers.filter(m => presentByMemberId.has(m.id));

  const safeEvent = eventName.replace(/\s+/g, '_');

  if (mode === 'absent') {
    const rows: (string | number)[][] = [
      ['ABSENTEES REPORT'],
      ['Event:', eventName],
      ['Date:', session.session_date],
      ['Status:', session.status.toUpperCase()],
      ['Total Absent:', absentMembers.length],
      ['Total Present:', presentMembers.length],
      ['Active Roster:', activeMembers.length],
      ['Exported At:', new Date().toLocaleString()],
      [],
      ['S/N', 'Full Name', 'Phone Number', 'Hostel / Hall', 'Room / Block', 'Unit', 'Check-in Code', 'Status'],
    ];

    absentMembers.forEach((m, idx) => {
      rows.push([
        idx + 1,
        m.full_name,
        m.phone || 'N/A',
        m.hostel || 'N/A',
        m.room_or_block || '',
        m.department || 'No Unit',
        m.check_in_code || 'N/A',
        'Absent',
      ]);
    });

    downloadCSV(`Absentees_${safeEvent}_${session.session_date}.csv`, rows);
    return;
  }

  if (mode === 'present') {
    const rows: (string | number)[][] = [
      ['PRESENT ATTENDANCE ROSTER'],
      ['Event:', eventName],
      ['Date:', session.session_date],
      ['Status:', session.status.toUpperCase()],
      ['Total Present:', presentRecords.length],
      ['Exported At:', new Date().toLocaleString()],
      [],
      ['S/N', 'Full Name', 'Phone Number', 'Hostel / Hall', 'Room / Block', 'Unit', 'Check-in Code', 'Checked In At', 'Source'],
    ];

    const memberMap = new Map(fellowshipMembers.map(m => [m.id, m]));
    presentRecords.forEach((rec, idx) => {
      const member = memberMap.get(rec.member_id);
      let sourceLabel = 'Self Check-in';
      if (rec.source === 'admin_manual') sourceLabel = 'Admin Manual';
      if (rec.source === 'code') sourceLabel = 'Code Entry';

      rows.push([
        idx + 1,
        member?.full_name || 'Unknown Member',
        member?.phone || 'N/A',
        member?.hostel || 'N/A',
        member?.room_or_block || '',
        member?.department || 'No Unit',
        member?.check_in_code || 'N/A',
        new Date(rec.checked_in_at).toLocaleTimeString(),
        sourceLabel,
      ]);
    });

    downloadCSV(`Present_${safeEvent}_${session.session_date}.csv`, rows);
    return;
  }

  // Default: Full Register (both Present and Absent clearly marked)
  const rows: (string | number)[][] = [
    ['FELLOWSHIP FULL ATTENDANCE REGISTER'],
    ['Event:', eventName],
    ['Date:', session.session_date],
    ['Status:', session.status.toUpperCase()],
    ['Present:', presentMembers.length],
    ['Absent:', absentMembers.length],
    ['Active Roster:', activeMembers.length],
    ['Exported At:', new Date().toLocaleString()],
    [],
    ['S/N', 'Full Name', 'Status', 'Phone Number', 'Hostel / Hall', 'Room / Block', 'Unit', 'Check-in Code', 'Checked In At', 'Source'],
  ];

  activeMembers.forEach((m, idx) => {
    const rec = presentByMemberId.get(m.id);
    let sourceLabel = '';
    if (rec) {
      sourceLabel = 'Self Check-in';
      if (rec.source === 'admin_manual') sourceLabel = 'Admin Manual';
      if (rec.source === 'code') sourceLabel = 'Code Entry';
    }

    rows.push([
      idx + 1,
      m.full_name,
      rec ? 'Present' : 'Absent',
      m.phone || 'N/A',
      m.hostel || 'N/A',
      m.room_or_block || '',
      m.department || 'No Unit',
      m.check_in_code || 'N/A',
      rec ? new Date(rec.checked_in_at).toLocaleTimeString() : '—',
      sourceLabel || '—',
    ]);
  });

  downloadCSV(`Register_${safeEvent}_${session.session_date}.csv`, rows);
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
      'Check-in Code',
      'Phone Number',
      'Hostel / Hall',
      'Room / Block',
      'Unit',
      'Active Status',
      'Sessions Attended',
      'Total Possible',
      'Attendance Rate (%)',
      'Joined Date',
    ],
  ];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const attendedRecords = (
      await db.attendance_records.where('member_id').equals(m.id).toArray()
    ).filter(r => r.status !== 'removed');
    const attendedCount = attendedRecords.length;
    const rate = totalPossible > 0 ? Math.round((attendedCount / totalPossible) * 100) : 0;

    rows.push([
      i + 1,
      m.full_name,
      m.check_in_code || 'N/A',
      m.phone || 'N/A',
      m.hostel || 'N/A',
      m.room_or_block || '',
      m.department || 'No Unit',
      m.is_active ? 'Active' : 'Deactivated',
      attendedCount,
      totalPossible,
      `${rate}%`,
      m.joined_at,
    ]);
  }

  downloadCSV(`${title}_${new Date().toISOString().split('T')[0]}.csv`, rows);
}
