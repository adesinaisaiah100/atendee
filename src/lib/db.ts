import Dexie, { type Table } from 'dexie';
import type {
  Fellowship,
  Member,
  EventTemplate,
  Session,
  AttendanceRecord,
  PendingMember,
  Term,
  SyncQueueItem,
} from '../types';

export class FellowshipDatabase extends Dexie {
  fellowships!: Table<Fellowship, string>;
  members!: Table<Member, string>;
  events!: Table<EventTemplate, string>;
  sessions!: Table<Session, string>;
  attendance_records!: Table<AttendanceRecord, string>;
  pending_members!: Table<PendingMember, string>;
  terms!: Table<Term, string>;
  sync_queue!: Table<SyncQueueItem, number>;

  constructor() {
    super('FellowshipAttendanceDB');

    // v1 original schema
    this.version(1).stores({
      fellowships: 'id, name',
      members: 'id, fellowship_id, full_name, is_active, department',
      events: 'id, fellowship_id, is_active',
      sessions: 'id, fellowship_id, event_id, session_date, status, [event_id+session_date]',
      attendance_records: 'id, session_id, member_id, sync_status, [session_id+member_id]',
      pending_members: 'id, fellowship_id, session_id, status, sync_status',
      terms: 'id, fellowship_id, start_date, end_date',
      sync_queue: '++id, type, action, created_at',
    });

    // v2 adds slug to fellowships, check_in_code to members
    this.version(2).stores({
      fellowships: 'id, name, slug',
      members: 'id, fellowship_id, full_name, is_active, department, check_in_code',
      events: 'id, fellowship_id, is_active',
      sessions: 'id, fellowship_id, event_id, session_date, status, [event_id+session_date]',
      attendance_records: 'id, session_id, member_id, sync_status, [session_id+member_id]',
      pending_members: 'id, fellowship_id, session_id, status, sync_status',
      terms: 'id, fellowship_id, start_date, end_date',
      sync_queue: '++id, type, action, created_at',
    }).upgrade(async (tx) => {
      // Migrate existing fellowships: add slug + recovery_email
      const fellowships = await tx.table('fellowships').toArray();
      for (const f of fellowships) {
        if (!f.slug) {
          f.slug = generateSlug(f.name);
        }
        await tx.table('fellowships').put(f);
      }

      // Migrate existing members: generate check_in_code
      const members = await tx.table('members').toArray();
      const usedCodes = new Set<string>();
      const prefix = fellowships.length > 0 ? getCodePrefix(fellowships[0].name) : 'CODE';

      for (const m of members) {
        if (!m.check_in_code) {
          let code: string;
          do {
            code = `${prefix}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
          } while (usedCodes.has(code));
          usedCodes.add(code);
          m.check_in_code = code;
          await tx.table('members').put(m);
        } else {
          usedCodes.add(m.check_in_code);
        }
      }
    });
  }
}

/** Generate URL-safe slug from fellowship name */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 48) || 'fellowship';
}

/** Extract code prefix from fellowship name (first word, uppercased, max 8 chars) */
function getCodePrefix(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] || 'CODE';
  return firstWord.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
}

export const db = new FellowshipDatabase();
