import { db } from './db';
import type {
  Fellowship,
  Member,
  EventTemplate,
  Session,
  PendingMember,
  Term,
} from '../types';

export const DEFAULT_FELLOWSHIP_ID = 'f0000000-0000-0000-0000-000000000001';

export const initialFellowship: Fellowship = {
  id: DEFAULT_FELLOWSHIP_ID,
  name: 'Grace Christian Fellowship (UI Chapter)',
  pin_code: '1234',
  created_at: '2026-01-10T08:00:00Z',
};

export const initialEvents: EventTemplate[] = [
  {
    id: 'e0000001-0000-0000-0000-000000000001',
    fellowship_id: DEFAULT_FELLOWSHIP_ID,
    name: 'Thursday Communion Mass',
    recurrence: 'weekly:thursday',
    is_active: true,
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'e0000002-0000-0000-0000-000000000002',
    fellowship_id: DEFAULT_FELLOWSHIP_ID,
    name: 'Sunday Revival Service',
    recurrence: 'weekly:sunday',
    is_active: true,
    created_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'e0000003-0000-0000-0000-000000000003',
    fellowship_id: DEFAULT_FELLOWSHIP_ID,
    name: 'Monday Intercessory Prayer',
    recurrence: 'weekly:monday',
    is_active: true,
    created_at: '2026-01-15T10:00:00Z',
  },
];

export const initialTerms: Term[] = [
  {
    id: 't0000001-0000-0000-0000-000000000001',
    fellowship_id: DEFAULT_FELLOWSHIP_ID,
    name: '2026 Second Semester',
    start_date: '2026-06-01',
    end_date: '2026-11-30',
    created_at: '2026-05-20T12:00:00Z',
  },
];

export const initialMembersList: Omit<Member, 'id' | 'fellowship_id' | 'created_at'>[] = [
  { full_name: 'Adebayo Samuel', phone: '+234 803 123 4567', gender: 'male', department: 'Media', joined_at: '2026-01-15', is_active: true },
  { full_name: 'Adeleke David', phone: '+234 812 345 6789', gender: 'male', department: 'Choir', joined_at: '2026-01-18', is_active: true },
  { full_name: 'Adeniyi Deborah', phone: '+234 813 456 7890', gender: 'female', department: 'Ushering', joined_at: '2026-02-01', is_active: true },
  { full_name: 'Adesina Isaiah', phone: '+234 802 345 6789', gender: 'male', department: 'Technical', joined_at: '2026-01-10', is_active: true },
  { full_name: 'Ajayi Victor', phone: '+234 814 567 8901', gender: 'male', department: 'Welfare', joined_at: '2026-02-10', is_active: true },
  { full_name: 'Akande Sarah', phone: '+234 805 678 9012', gender: 'female', department: 'Choir', joined_at: '2026-01-20', is_active: true },
  { full_name: 'Akinola Emmanuel', phone: '+234 807 890 1234', gender: 'male', department: 'Ushering', joined_at: '2026-02-15', is_active: true },
  { full_name: 'Alabi Grace', phone: '+234 816 789 0123', gender: 'female', department: 'Choir', joined_at: '2026-03-01', is_active: true },
  { full_name: 'Bakare Daniel', phone: '+234 818 901 2345', gender: 'male', department: 'Media', joined_at: '2026-01-25', is_active: true },
  { full_name: 'Bello Joshua', phone: '+234 809 012 3456', gender: 'male', department: 'Technical', joined_at: '2026-02-05', is_active: true },
  { full_name: 'Chukwuemeka Praise', phone: '+234 803 234 5678', gender: 'female', department: 'Choir', joined_at: '2026-02-12', is_active: true },
  { full_name: 'Dada Timothy', phone: '+234 815 345 6789', gender: 'male', department: 'Bible Study', joined_at: '2026-01-12', is_active: true },
  { full_name: 'Ezekiel Ruth', phone: '+234 817 456 7890', gender: 'female', department: 'Ushering', joined_at: '2026-03-10', is_active: true },
  { full_name: 'Fasasi Michael', phone: '+234 808 567 8901', gender: 'male', department: 'Welfare', joined_at: '2026-01-15', is_active: true },
  { full_name: 'Ibrahim Blessing', phone: '+234 811 678 9012', gender: 'female', department: 'Choir', joined_at: '2026-02-20', is_active: true },
  { full_name: 'Idowu John', phone: '+234 806 789 0123', gender: 'male', department: 'Technical', joined_at: '2026-01-10', is_active: true },
  { full_name: 'Jegede Esther', phone: '+234 810 890 1234', gender: 'female', department: 'Media', joined_at: '2026-02-14', is_active: true },
  { full_name: 'Kalu Miracle', phone: '+234 804 901 2345', gender: 'female', department: 'Welfare', joined_at: '2026-03-05', is_active: true },
  { full_name: 'Lawal Peter', phone: '+234 812 012 3456', gender: 'male', department: 'Ushering', joined_at: '2026-01-30', is_active: true },
  { full_name: 'Nwankwo Gideon', phone: '+234 803 111 2233', gender: 'male', department: 'Bible Study', joined_at: '2026-02-18', is_active: true },
  { full_name: 'Okafor Chidinma', phone: '+234 813 222 3344', gender: 'female', department: 'Choir', joined_at: '2026-01-10', is_active: true },
  { full_name: 'Okeke Joseph', phone: '+234 815 333 4455', gender: 'male', department: 'Technical', joined_at: '2026-02-22', is_active: true },
  { full_name: 'Oladipo Faith', phone: '+234 817 444 5566', gender: 'female', department: 'Ushering', joined_at: '2026-01-20', is_active: true },
  { full_name: 'Olanrewaju Samuel', phone: '+234 808 555 6677', gender: 'male', department: 'Media', joined_at: '2026-01-15', is_active: true },
  { full_name: 'Olufemi Joy', phone: '+234 809 666 7788', gender: 'female', department: 'Choir', joined_at: '2026-02-08', is_active: true },
  { full_name: 'Olukoya Daniel', phone: '+234 811 777 8899', gender: 'male', department: 'Welfare', joined_at: '2026-01-10', is_active: true },
  { full_name: 'Oluwaseun Mary', phone: '+234 806 888 9900', gender: 'female', department: 'Ushering', joined_at: '2026-03-01', is_active: true },
  { full_name: 'Oyekunle Hannah', phone: '+234 810 999 0011', gender: 'female', department: 'Choir', joined_at: '2026-02-15', is_active: true },
  { full_name: 'Popoola Gabriel', phone: '+234 804 000 1122', gender: 'male', department: 'Technical', joined_at: '2026-01-18', is_active: true },
  { full_name: 'Salako Abigail', phone: '+234 812 111 2233', gender: 'female', department: 'Media', joined_at: '2026-02-28', is_active: true },
  { full_name: 'Taiwo Kehinde', phone: '+234 803 222 3344', gender: 'male', department: 'Ushering', joined_at: '2026-01-10', is_active: true },
  { full_name: 'Uchechi Benjamin', phone: '+234 813 333 4455', gender: 'male', department: 'Bible Study', joined_at: '2026-02-01', is_active: true },
  { full_name: 'Williams Rebecca', phone: '+234 815 444 5566', gender: 'female', department: 'Choir', joined_at: '2026-01-15', is_active: true },
  { full_name: 'Yakubu Moses', phone: '+234 817 555 6677', gender: 'male', department: 'Welfare', joined_at: '2026-03-05', is_active: true },
  { full_name: 'Zion Mercy', phone: '+234 808 666 7788', gender: 'female', department: 'Choir', joined_at: '2026-02-10', is_active: true },
  // 3 Soft-deactivated members to test filters and historical preservation
  { full_name: 'Ezekiel Collins (Graduated)', phone: '+234 809 111 2233', gender: 'male', department: 'Media', joined_at: '2025-09-01', is_active: false },
  { full_name: 'Ige Funmilayo (Relocated)', phone: '+234 811 222 3344', gender: 'female', department: 'Choir', joined_at: '2025-10-15', is_active: false },
];

export async function initializeSeedData(forceReset = false) {
  const existingFellowship = await db.fellowships.get(DEFAULT_FELLOWSHIP_ID);
  if (existingFellowship && !forceReset) {
    return;
  }

  await db.transaction('rw', [
    db.fellowships,
    db.events,
    db.members,
    db.sessions,
    db.attendance_records,
    db.pending_members,
    db.terms,
  ], async () => {
    if (forceReset) {
      await db.fellowships.clear();
      await db.events.clear();
      await db.members.clear();
      await db.sessions.clear();
      await db.attendance_records.clear();
      await db.pending_members.clear();
      await db.terms.clear();
    }

    // 1. Fellowship
    await db.fellowships.put(initialFellowship);

    // 2. Events
    for (const ev of initialEvents) {
      await db.events.put(ev);
    }

    // 3. Terms
    for (const term of initialTerms) {
      await db.terms.put(term);
    }

    // 4. Members
    const createdMembers: Member[] = [];
    let counter = 1;
    for (const m of initialMembersList) {
      const memberId = `m0000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
      const memberObj: Member = {
        id: memberId,
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        full_name: m.full_name,
        phone: m.phone,
        gender: m.gender,
        department: m.department,
        joined_at: m.joined_at,
        is_active: m.is_active,
        created_at: new Date().toISOString(),
      };
      await db.members.put(memberObj);
      createdMembers.push(memberObj);
      counter++;
    }

    const activeMembers = createdMembers.filter(m => m.is_active);

    // 5. Past Historical Sessions (to power Drifting Members and Frequency analytics)
    const thursdayEventId = initialEvents[0].id;
    const sundayEventId = initialEvents[1].id;

    const historicalSessions: Session[] = [
      {
        id: 's0000001-0000-0000-0000-000000000001',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        event_id: thursdayEventId,
        session_date: '2026-07-23',
        status: 'closed',
        opened_at: '2026-07-23T17:00:00Z',
        closed_at: '2026-07-23T19:30:00Z',
        notes: 'Mid-term prayer & communion',
      },
      {
        id: 's0000002-0000-0000-0000-000000000002',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        event_id: sundayEventId,
        session_date: '2026-07-26',
        status: 'closed',
        opened_at: '2026-07-26T08:00:00Z',
        closed_at: '2026-07-26T11:00:00Z',
        notes: 'Special thanksgiving service',
      },
      {
        id: 's0000003-0000-0000-0000-000000000003',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        event_id: thursdayEventId,
        session_date: '2026-07-30',
        status: 'closed',
        opened_at: '2026-07-30T17:00:00Z',
        closed_at: '2026-07-30T19:30:00Z',
      },
      {
        id: 's0000004-0000-0000-0000-000000000004',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        event_id: sundayEventId,
        session_date: '2026-08-02',
        status: 'closed',
        opened_at: '2026-08-02T08:00:00Z',
        closed_at: '2026-08-02T11:00:00Z',
      },
      {
        id: 's0000005-0000-0000-0000-000000000005',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        event_id: thursdayEventId,
        session_date: '2026-08-06',
        status: 'closed',
        opened_at: '2026-08-06T17:00:00Z',
        closed_at: '2026-08-06T19:30:00Z',
      },
      {
        id: 's0000006-0000-0000-0000-000000000006',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        event_id: sundayEventId,
        session_date: '2026-08-09',
        status: 'closed',
        opened_at: '2026-08-09T08:00:00Z',
        closed_at: '2026-08-09T11:00:00Z',
      },
      {
        id: 's0000007-0000-0000-0000-000000000007',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        event_id: thursdayEventId,
        session_date: '2026-08-13',
        status: 'closed',
        opened_at: '2026-08-13T17:00:00Z',
        closed_at: '2026-08-13T19:30:00Z',
      },
      // Today's Open Active Session!
      {
        id: 's0000008-0000-0000-0000-000000000008',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        event_id: thursdayEventId,
        session_date: new Date().toISOString().split('T')[0],
        status: 'open',
        opened_at: new Date().toISOString(),
        notes: 'Today Live Mass & Communion (Pass-the-Phone Check-in active)',
      },
    ];

    for (const sess of historicalSessions) {
      await db.sessions.put(sess);
    }

    // 6. Attendance records for past sessions
    // Make some members regular attendees (80-100%), some moderate (50%), and 4-5 members drifting (0% in last 3-4 sessions)
    let attCounter = 1;
    const driftingMemberIds = [
      activeMembers[2]?.id, // Adeniyi Deborah
      activeMembers[8]?.id, // Bakare Daniel
      activeMembers[14]?.id, // Ibrahim Blessing
      activeMembers[20]?.id, // Okafor Chidinma
    ].filter(Boolean);

    for (const sess of historicalSessions.slice(0, 7)) {
      for (const member of activeMembers) {
        // If member is in drifting list, they only attended session 1 or none
        if (driftingMemberIds.includes(member.id)) {
          if (sess.id === historicalSessions[0].id) {
            await db.attendance_records.put({
              id: `a0000000-0000-0000-0000-${String(attCounter++).padStart(12, '0')}`,
              session_id: sess.id,
              member_id: member.id,
              checked_in_at: `${sess.session_date}T17:35:00Z`,
              source: 'self',
              sync_status: 'synced',
            });
          }
          continue;
        }

        // 75% attendance probability for active regulars
        const hash = (member.full_name.charCodeAt(0) + sess.session_date.charCodeAt(sess.session_date.length - 1)) % 10;
        if (hash < 8) {
          await db.attendance_records.put({
            id: `a0000000-0000-0000-0000-${String(attCounter++).padStart(12, '0')}`,
            session_id: sess.id,
            member_id: member.id,
            checked_in_at: `${sess.session_date}T17:25:00Z`,
            source: hash % 2 === 0 ? 'self' : 'admin_manual',
            sync_status: 'synced',
          });
        }
      }
    }

    // Today's session initial check-ins (first 5 members to show live pulse)
    const todaySession = historicalSessions[7];
    for (let i = 0; i < 6; i++) {
      if (activeMembers[i]) {
        await db.attendance_records.put({
          id: `a0000000-0000-0000-0000-${String(attCounter++).padStart(12, '0')}`,
          session_id: todaySession.id,
          member_id: activeMembers[i].id,
          checked_in_at: new Date().toISOString(),
          source: 'self',
          sync_status: 'synced',
        });
      }
    }

    // 7. Pending Members to review
    const pendingList: PendingMember[] = [
      {
        id: 'p0000001-0000-0000-0000-000000000001',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        session_id: todaySession.id,
        entered_name: 'Chidinma O.',
        phone: '+234 813 222 3344',
        status: 'pending',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        sync_status: 'synced',
      },
      {
        id: 'p0000002-0000-0000-0000-000000000002',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        session_id: todaySession.id,
        entered_name: 'Kemi Adebisi (First Timer)',
        phone: '+234 809 777 4411',
        status: 'pending',
        created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        sync_status: 'synced',
      },
      {
        id: 'p0000003-0000-0000-0000-000000000003',
        fellowship_id: DEFAULT_FELLOWSHIP_ID,
        session_id: historicalSessions[6].id,
        entered_name: 'Brother Tunde Visitor',
        phone: '+234 802 999 1234',
        status: 'pending',
        created_at: '2026-08-13T17:50:00Z',
        sync_status: 'synced',
      },
    ];

    for (const p of pendingList) {
      await db.pending_members.put(p);
    }
  });
}
