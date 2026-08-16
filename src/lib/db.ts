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
  }
}

export const db = new FellowshipDatabase();
