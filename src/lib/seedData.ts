import { db } from './db';
import type {
  Fellowship,
  EventTemplate,
  Term,
} from '../types';

export const DEFAULT_FELLOWSHIP_ID = 'f0000000-0000-0000-0000-000000000001';

export const initialFellowship: Fellowship = {
  id: DEFAULT_FELLOWSHIP_ID,
  name: 'My Fellowship',
  pin_code: '1234',
  created_at: new Date().toISOString(),
};

// Default event blueprints to get started quickly
export const defaultInitialEvents: EventTemplate[] = [
  {
    id: 'e0000001-0000-0000-0000-000000000001',
    fellowship_id: DEFAULT_FELLOWSHIP_ID,
    name: 'Sunday Worship Service',
    recurrence: 'weekly:sunday',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'e0000002-0000-0000-0000-000000000002',
    fellowship_id: DEFAULT_FELLOWSHIP_ID,
    name: 'Midweek Fellowship',
    recurrence: 'weekly:thursday',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const defaultInitialTerm: Term = {
  id: 't0000001-0000-0000-0000-000000000001',
  fellowship_id: DEFAULT_FELLOWSHIP_ID,
  name: `${new Date().getFullYear()} Annual Period`,
  start_date: `${new Date().getFullYear()}-01-01`,
  end_date: `${new Date().getFullYear()}-12-31`,
  created_at: new Date().toISOString(),
};

/**
 * Initialize clean state with zero mock people or fake attendance.
 * Only sets up the organization template and default gathering templates if empty.
 */
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

    // 2. Default standard gathering templates
    for (const ev of defaultInitialEvents) {
      await db.events.put(ev);
    }

    // 3. Default current year term
    await db.terms.put(defaultInitialTerm);
  });
}
