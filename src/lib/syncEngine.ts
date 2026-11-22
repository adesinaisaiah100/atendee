import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { generateUniqueCode } from './codeGenerator';
import type { AttendanceRecord, PendingMember, InactivityAlert, Member, AttendanceSource } from '../types';

export type NetworkStatus = 'online' | 'offline' | 'syncing';

const DEVICE_KEY = 'atendee_device_id';
const MAX_ATTEMPTS = 8;

/** Stable per-browser id so every mark can be traced to the device that made it. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'unknown-device';
  }
}

export async function queueMutation(type: any, action: 'insert' | 'update' | 'delete', payload: any) {
  await db.sync_queue.add({
    type,
    action,
    payload,
    created_at: new Date().toISOString(),
    attempts: 0,
  });

  if (navigator.onLine && isSupabaseConfigured()) {
    flushSyncQueue().catch(console.warn);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanPayload(payload: any) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = { ...payload };
  delete copy.sync_status;
  return copy;
}

/** Attendance rows are keyed by (session_id, member_id) on the server, never by local id. */
function attendancePayload(payload: any) {
  const copy = cleanPayload(payload);
  delete copy.id;
  return copy;
}

async function queuedIdsFor(type: string): Promise<Set<string>> {
  const items = await db.sync_queue.where('type').equals(type).toArray();
  const ids = new Set<string>();
  for (const item of items) {
    const id = item.payload?.id;
    if (typeof id === 'string') ids.add(id);
  }
  return ids;
}

export async function countFailedSync(): Promise<number> {
  return db.sync_queue.filter(item => (item.attempts || 0) >= MAX_ATTEMPTS).count();
}

export async function retryFailedSync(): Promise<void> {
  await db.sync_queue.toCollection().modify({ attempts: 0 });
  await flushSyncQueue();
}

let inFlightFlush: Promise<{ syncedCount: number; errors: any[] }> | null = null;

/** Single-flight: the 10s poll, focus, online and mutation triggers all share one run. */
export async function flushSyncQueue(): Promise<{ syncedCount: number; errors: any[] }> {
  if (inFlightFlush) return inFlightFlush;
  inFlightFlush = runFlush().finally(() => {
    inFlightFlush = null;
  });
  return inFlightFlush;
}

async function runFlush(): Promise<{ syncedCount: number; errors: any[] }> {
  if (isSupabaseConfigured() && !navigator.onLine) {
    return { syncedCount: 0, errors: [] };
  }

  const queue = await db.sync_queue.orderBy('id').toArray();
  if (queue.length === 0) return { syncedCount: 0, errors: [] };

  if (!isSupabaseConfigured()) {
    // Local-only demo mode: drain so the UI never shows a stuck outbox.
    await db.sync_queue.clear();
    return { syncedCount: queue.length, errors: [] };
  }

  const errors: any[] = [];
  let syncedCount = 0;

  for (const item of queue) {
    if ((item.attempts || 0) >= MAX_ATTEMPTS) continue;

    try {
      const raw = item.payload;
      const payload = item.type === 'attendance_record' ? attendancePayload(raw) : cleanPayload(raw);

      if (payload?.id && !UUID_REGEX.test(payload.id)) {
        if (item.id) await db.sync_queue.delete(item.id);
        continue;
      }

      if (item.type === 'attendance_record') {
        if (item.action === 'insert' || item.action === 'update') {
          const { error } = await supabase
            .from('attendance_records')
            .upsert(payload, { onConflict: 'session_id,member_id' });
          if (error) throw error;
        } else if (item.action === 'delete') {
          let query = supabase.from('attendance_records').delete().eq('id', raw.id);
          if (raw.fellowship_id) query = query.eq('fellowship_id', raw.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        }
      } else if (item.type === 'pending_member') {
        if (item.action === 'insert') {
          const { error } = await supabase.from('pending_members').upsert(payload);
          if (error) throw error;
        } else if (item.action === 'update') {
          const { id, ...fields } = payload;
          let query = supabase.from('pending_members').update(fields).eq('id', id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        } else if (item.action === 'delete') {
          let query = supabase.from('pending_members').delete().eq('id', payload.id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        }
      } else if (item.type === 'member') {
        if (item.action === 'insert') {
          const { error } = await supabase.from('members').upsert(payload);
          if (error) throw error;
        } else if (item.action === 'update') {
          const { id, ...fields } = payload;
          let query = supabase.from('members').update(fields).eq('id', id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        } else if (item.action === 'delete') {
          let query = supabase.from('members').delete().eq('id', payload.id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        }
      } else if (item.type === 'session') {
        if (item.action === 'insert') {
          const { error } = await supabase.from('sessions').upsert(payload);
          if (error) throw error;
        } else if (item.action === 'update') {
          const { id, ...fields } = payload;
          let query = supabase.from('sessions').update(fields).eq('id', id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        } else if (item.action === 'delete') {
          let query = supabase.from('sessions').delete().eq('id', payload.id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        }
      } else if (item.type === 'event') {
        if (item.action === 'insert') {
          const { error } = await supabase.from('events').upsert(payload);
          if (error) throw error;
        } else if (item.action === 'update') {
          const { id, ...fields } = payload;
          let query = supabase.from('events').update(fields).eq('id', id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        } else if (item.action === 'delete') {
          let query = supabase.from('events').delete().eq('id', payload.id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        }
      } else if (item.type === 'fellowship') {
        if (item.action === 'insert') {
          const { error } = await supabase.from('fellowships').upsert(payload);
          if (error) throw error;
        } else if (item.action === 'update') {
          const { id, ...fields } = payload;
          const { error } = await supabase.from('fellowships').update(fields).eq('id', id);
          if (error) throw error;
        }
      } else if (item.type === 'term') {
        if (item.action === 'insert') {
          const { error } = await supabase.from('terms').upsert(payload);
          if (error) throw error;
        } else if (item.action === 'update') {
          const { id, ...fields } = payload;
          let query = supabase.from('terms').update(fields).eq('id', id);
          if (payload.fellowship_id) query = query.eq('fellowship_id', payload.fellowship_id);
          const { error } = await query;
          if (error) throw error;
        }
      }

      if (item.id) await db.sync_queue.delete(item.id);
      syncedCount++;
    } catch (err: any) {
      // 23505 = another device already wrote this exact row. Treat as applied.
      if (err?.code === '23505' || err?.status === 409) {
        if (item.id) await db.sync_queue.delete(item.id);
        syncedCount++;
        continue;
      }
      console.error('Sync item error:', item, err);
      errors.push({ item, err });
      if (item.id) {
        await db.sync_queue.update(item.id, { attempts: (item.attempts || 0) + 1 });
      }
    }
  }

  return { syncedCount, errors };
}


/**
 * Hydrate tenant data from Supabase into local Dexie store
 */
export async function hydrateFellowshipData(fellowshipId: string): Promise<void> {
  if (!fellowshipId || !isSupabaseConfigured()) return;

  try {
    // 0. Auto-Migrate any legacy non-UUID local records on this device
    const localEvents = await db.events.where('fellowship_id').equals(fellowshipId).toArray();
    for (const ev of localEvents) {
      if (!UUID_REGEX.test(ev.id)) {
        const oldId = ev.id;
        const newId = crypto.randomUUID();
        await db.events.delete(oldId);
        const migratedEv = { ...ev, id: newId };
        await db.events.put(migratedEv);

        // Update sessions referencing this event
        const relatedSessions = await db.sessions.where('event_id').equals(oldId).toArray();
        for (const sess of relatedSessions) {
          const oldSessId = sess.id;
          const newSessId = UUID_REGEX.test(oldSessId) ? oldSessId : crypto.randomUUID();
          await db.sessions.delete(oldSessId);
          const migratedSess = { ...sess, id: newSessId, event_id: newId };
          await db.sessions.put(migratedSess);

          // Update attendance records referencing this session
          const relatedAtt = await db.attendance_records.where('session_id').equals(oldSessId).toArray();
          for (const att of relatedAtt) {
            const oldAttId = att.id;
            const newAttId = UUID_REGEX.test(oldAttId) ? oldAttId : crypto.randomUUID();
            await db.attendance_records.delete(oldAttId);
            await db.attendance_records.put({ ...att, id: newAttId, session_id: newSessId });
          }

          // Push session to Supabase
          try {
            await supabase.from('sessions').upsert({
              id: newSessId,
              fellowship_id: fellowshipId,
              event_id: newId,
              session_date: sess.session_date,
              status: sess.status,
              opened_at: sess.opened_at,
              closed_at: sess.closed_at,
            });
          } catch (err) {
            console.warn('Session migration error:', err);
          }
        }

        // Push event to Supabase
        try {
          await supabase.from('events').upsert({
            id: newId,
            fellowship_id: fellowshipId,
            name: migratedEv.name,
            is_active: migratedEv.is_active,
            created_at: migratedEv.created_at,
          });
        } catch (err) {
          console.warn('Event migration error:', err);
        }
      }
    }

    // 1. Fetch Fellowship
    const { data: fData } = await supabase
      .from('fellowships')
      .select('*')
      .eq('id', fellowshipId)
      .maybeSingle();

    if (fData) {
      await db.fellowships.put({
        id: fData.id,
        name: fData.name,
        slug: fData.slug,
        created_at: fData.created_at,
      });
    }

    // 2. Reconcile Members
    const { data: membersData } = await supabase
      .from('members')
      .select('*')
      .eq('fellowship_id', fellowshipId);

    if (membersData !== null) {
      const cloudMemberIds = new Set(membersData.map(m => m.id));
      const pendingMemberIds = await queuedIdsFor('member');
      const localMembers = await db.members.where('fellowship_id').equals(fellowshipId).toArray();
      for (const lm of localMembers) {
        if (!cloudMemberIds.has(lm.id) && !pendingMemberIds.has(lm.id)) {
          await db.members.delete(lm.id);
        }
      }
      if (membersData.length > 0) {
        await db.members.bulkPut(membersData);
      }
    }

    // 3. Reconcile Events
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('fellowship_id', fellowshipId);

    if (eventsData !== null) {
      const cloudEventIds = new Set(eventsData.map(e => e.id));
      const pendingEventIds = await queuedIdsFor('event');
      const localEvents = await db.events.where('fellowship_id').equals(fellowshipId).toArray();
      for (const le of localEvents) {
        if (!cloudEventIds.has(le.id) && !pendingEventIds.has(le.id)) {
          await db.events.delete(le.id);
        }
      }
      if (eventsData.length > 0) {
        await db.events.bulkPut(eventsData);
      }
    }

    // 4. Reconcile Sessions
    const { data: sessionsData } = await supabase
      .from('sessions')
      .select('*')
      .eq('fellowship_id', fellowshipId);

    if (sessionsData !== null) {
      const cloudSessionIds = new Set(sessionsData.map(s => s.id));
      const pendingSessionIds = await queuedIdsFor('session');
      const localSessions = await db.sessions.where('fellowship_id').equals(fellowshipId).toArray();
      for (const ls of localSessions) {
        if (!cloudSessionIds.has(ls.id) && !pendingSessionIds.has(ls.id)) {
          await db.sessions.delete(ls.id);
        }
      }
      if (sessionsData.length > 0) {
        await db.sessions.bulkPut(sessionsData);
      }

      const sessionIds = sessionsData.map(s => s.id);
      // 5. Reconcile Attendance Records for these sessions — by (session, member), never by id,
      //    and never at the expense of a mark this device has not pushed yet.
      if (sessionIds.length > 0) {
        const { data: attData } = await supabase
          .from('attendance_records')
          .select('*')
          .in('session_id', sessionIds);

        if (attData !== null) {
          const cloudByKey = new Map(
            (attData as AttendanceRecord[]).map(a => [`${a.session_id}:${a.member_id}`, a])
          );
          const localAtt = await db.attendance_records.where('session_id').anyOf(sessionIds).toArray();
          const queuedAtt = await db.sync_queue
            .where('type')
            .equals('attendance_record')
            .toArray();
          const queuedKeys = new Set(
            queuedAtt.map(i => `${i.payload?.session_id}:${i.payload?.member_id}`)
          );

          for (const la of localAtt) {
            const key = `${la.session_id}:${la.member_id}`;
            const cloud = cloudByKey.get(key);

            if (!cloud) {
              // Not on the server yet. Keep it if this device still owes the push.
              if (!queuedKeys.has(key)) {
                await db.attendance_records.delete(la.id);
              }
              continue;
            }

            cloudByKey.delete(key);

            const localTime = new Date(la.updated_at || la.checked_in_at).getTime();
            const cloudTime = new Date(cloud.updated_at || cloud.checked_in_at).getTime();
            const keepLocal = la.sync_status === 'pending_sync' || localTime > cloudTime;

            if (!keepLocal) {
              // Preserve the local primary key so Dexie does not churn ids between polls.
              await db.attendance_records.put({ ...cloud, id: la.id });
            }
          }

          for (const cloud of cloudByKey.values()) {
            await db.attendance_records.put(cloud);
          }
        }
      } else {
        // No cloud sessions exist; only clear local attendance records for sessions
        // that are NOT waiting in the local sync queue.
        const localSessions = await db.sessions.where('fellowship_id').equals(fellowshipId).toArray();
        const orphanSessionIds = localSessions
          .filter(s => !pendingSessionIds.has(s.id))
          .map(s => s.id);
        if (orphanSessionIds.length > 0) {
          await db.attendance_records.where('session_id').anyOf(orphanSessionIds).delete();
        }
      }
    }

    // 6. Reconcile Terms
    const { data: termsData } = await supabase
      .from('terms')
      .select('*')
      .eq('fellowship_id', fellowshipId);

    if (termsData !== null) {
      const cloudTermIds = new Set(termsData.map(t => t.id));
      const localTerms = await db.terms.where('fellowship_id').equals(fellowshipId).toArray();
      for (const lt of localTerms) {
        if (!cloudTermIds.has(lt.id)) {
          await db.terms.delete(lt.id);
        }
      }
      if (termsData.length > 0) {
        await db.terms.bulkPut(termsData);
      }
    }

    // 7. Reconcile Pending Members
    const { data: pendingData } = await supabase
      .from('pending_members')
      .select('*')
      .eq('fellowship_id', fellowshipId);

    if (pendingData !== null) {
      const cloudPendingIds = new Set(pendingData.map(p => p.id));
      const pendingQueued = await queuedIdsFor('pending_member');
      const localPending = await db.pending_members.where('fellowship_id').equals(fellowshipId).toArray();
      for (const lp of localPending) {
        if (!cloudPendingIds.has(lp.id) && !pendingQueued.has(lp.id)) {
          await db.pending_members.delete(lp.id);
        }
      }
      if (pendingData.length > 0) {
        await db.pending_members.bulkPut(pendingData);
      }
    }
  } catch (err) {
    console.error('Hydration error for fellowship', fellowshipId, err);
  }
}

/**
 * Mark a member present for a session.
 *
 * One row per (session_id, member_id) — the server enforces it with a unique
 * constraint, so two phones marking the same person converge on the same row
 * instead of racing to create duplicates. Local id is reused when the row
 * already exists; upserts never send `id` so the server keeps its own.
 */
export async function markAttendance(
  sessionId: string,
  memberId: string,
  source: AttendanceSource = 'admin_manual'
): Promise<AttendanceRecord | null> {
  if (!sessionId || !memberId) return null;

  const session = await db.sessions.get(sessionId);
  let fellowshipId = session?.fellowship_id;

  if (!fellowshipId && isSupabaseConfigured() && navigator.onLine) {
    const { data } = await supabase
      .from('sessions')
      .select('fellowship_id')
      .eq('id', sessionId)
      .maybeSingle();
    fellowshipId = (data as { fellowship_id?: string } | null)?.fellowship_id;
  }

  if (!fellowshipId) {
    console.error('markAttendance: session has no tenant', sessionId);
    return null;
  }

  const member = await db.members.get(memberId);
  if (member && member.fellowship_id !== fellowshipId) {
    console.error('markAttendance: member and session belong to different fellowships', {
      sessionFellowship: fellowshipId,
      memberFellowship: member.fellowship_id,
    });
    return null;
  }

  const now = new Date().toISOString();
  const existing = await db.attendance_records
    .where('[session_id+member_id]')
    .equals([sessionId, memberId])
    .first();

  const record: AttendanceRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    fellowship_id: fellowshipId,
    session_id: sessionId,
    member_id: memberId,
    // First mark wins: never rewind the timestamp when a second device confirms.
    checked_in_at:
      existing && existing.checked_in_at <= now ? existing.checked_in_at : now,
    source: existing?.source ?? source,
    status: 'present',
    device_id: existing?.device_id ?? getDeviceId(),
    updated_at: now,
    sync_status: navigator.onLine ? 'synced' : 'pending_sync',
  };

  await db.attendance_records.put(record);
  await queueMutation('attendance_record', existing ? 'update' : 'insert', record);

  return record;
}

/**
 * Undo a mark. Tombstones instead of deleting so a stale device can never
 * resurrect or erase someone by racing a DELETE.
 *
 * During an open session, presence is monotonic: only the device that made the
 * mark (or an explicit force from the owner) may undo it.
 */
export async function unmarkAttendance(
  sessionId: string,
  memberId: string,
  options: { force?: boolean } = {}
): Promise<AttendanceRecord | null> {
  const existing = await db.attendance_records
    .where('[session_id+member_id]')
    .equals([sessionId, memberId])
    .first();

  if (!existing) return null;

  const session = await db.sessions.get(sessionId);
  const madeHere = existing.device_id === getDeviceId();

  if (!options.force && session?.status === 'open' && !madeHere) {
    return null;
  }

  const now = new Date().toISOString();
  const record: AttendanceRecord = {
    ...existing,
    status: 'removed',
    updated_at: now,
    sync_status: navigator.onLine ? 'synced' : 'pending_sync',
  };

  await db.attendance_records.put(record);
  await queueMutation('attendance_record', 'update', record);
  return record;
}

/** Back-compat wrapper used by the kiosk / check-in views. */
export async function checkInMemberOptimistic(
  sessionId: string,
  memberId: string,
  source: AttendanceSource = 'self'
): Promise<AttendanceRecord> {
  const record = await markAttendance(sessionId, memberId, source);
  if (!record) {
    throw new Error('Could not record attendance for this session.');
  }
  return record;
}

// 2. Register pending member
export async function registerPendingMember(
  fellowshipId: string,
  sessionId: string,
  enteredName: string,
  phone?: string
): Promise<PendingMember> {
  const pendingId = crypto.randomUUID();
  const pending: PendingMember = {
    id: pendingId,
    fellowship_id: fellowshipId,
    session_id: sessionId,
    entered_name: enteredName.trim(),
    phone: phone?.trim(),
    status: 'pending',
    created_at: new Date().toISOString(),
    sync_status: navigator.onLine ? 'synced' : 'pending_sync',
  };

  await db.pending_members.put(pending);
  await queueMutation('pending_member', 'insert', pending);

  return pending;
}

// 3. Resolve Pending Member (Merge or Create New)
export async function resolvePendingMemberAction(
  pendingId: string,
  resolution: 'merge_existing' | 'create_new' | 'delete',
  existingMemberId?: string,
  newMemberData?: Partial<Member>
) {
  const pending = await db.pending_members.get(pendingId);
  if (!pending) return;

  if (resolution === 'delete') {
    await db.pending_members.delete(pendingId);
    await queueMutation('pending_member', 'delete', {
      id: pendingId,
      fellowship_id: pending.fellowship_id,
    });
    return;
  }

  if (resolution === 'merge_existing' && existingMemberId) {
    // 1. Mark pending as merged
    await db.pending_members.update(pendingId, {
      status: 'merged',
      merged_into_member_id: existingMemberId,
      resolved_at: new Date().toISOString(),
    });

    // 2. Retroactively ensure attendance record exists for existing member
    const existingAtt = await db.attendance_records
      .where('[session_id+member_id]')
      .equals([pending.session_id, existingMemberId])
      .first();

    if (!existingAtt || existingAtt.status === 'removed') {
      await checkInMemberOptimistic(pending.session_id, existingMemberId, 'admin_manual');
    }
  }

  if (resolution === 'create_new' && newMemberData?.full_name) {
    const newMemberId = crypto.randomUUID();
    const fellowship = await db.fellowships.get(pending.fellowship_id);
    const code = await generateUniqueCode(pending.fellowship_id, fellowship?.name || 'Fellowship');

    const newMember: Member = {
      id: newMemberId,
      fellowship_id: pending.fellowship_id,
      full_name: newMemberData.full_name,
      phone: newMemberData.phone || pending.phone,
      gender: newMemberData.gender || 'other',
      department: newMemberData.department || 'General',
      check_in_code: code,
      joined_at: new Date().toISOString().split('T')[0],
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await db.members.put(newMember);
    await queueMutation('member', 'insert', newMember);

    // Mark pending as merged into new member
    await db.pending_members.update(pendingId, {
      status: 'merged',
      merged_into_member_id: newMemberId,
      resolved_at: new Date().toISOString(),
    });

    // Retroactively create attendance record
    await checkInMemberOptimistic(pending.session_id, newMemberId, 'admin_manual');
  }
}

// 4. Compute Inactivity / Pastoral Care Alerts
export async function computeInactivityAlerts(
  fellowshipId: string,
  eventId?: string,
  missedThreshold = 1,
  includeOpenSessions = true
): Promise<InactivityAlert[]> {
  const activeMembers = await db.members
    .where('fellowship_id')
    .equals(fellowshipId)
    .and(m => m.is_active)
    .toArray();

  let sessionsQuery = db.sessions.where('fellowship_id').equals(fellowshipId);
  if (eventId && eventId !== 'all') {
    sessionsQuery = db.sessions.where('event_id').equals(eventId);
  }

  const allSessions = await sessionsQuery.toArray();
  // Sort sessions by date descending
  const sortedSessions = allSessions.sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );

  const eligibleSessions = includeOpenSessions
    ? sortedSessions
    : sortedSessions.filter(s => s.status === 'closed');

  const recentSessions = eligibleSessions.slice(0, missedThreshold);

  if (recentSessions.length === 0) return [];

  const alerts: InactivityAlert[] = [];

  for (const member of activeMembers) {
    const allMemberAtt = await db.attendance_records.where('member_id').equals(member.id).toArray();
    const attendedSessionIds = new Set(
      allMemberAtt.filter(a => a.status !== 'removed').map(a => a.session_id)
    );

    // Check consecutive missed in recentSessions
    let consecutiveMissed = 0;
    for (const session of recentSessions) {
      if (!attendedSessionIds.has(session.id)) {
        consecutiveMissed++;
      } else {
        break; // streak of absence broken
      }
    }

    if (consecutiveMissed >= Math.min(missedThreshold, recentSessions.length)) {
      // Find latest attended date
      const attendedSessions = eligibleSessions
        .filter(s => attendedSessionIds.has(s.id))
        .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

      const lastAttendedDate = attendedSessions.length > 0 ? attendedSessions[0].session_date : null;
      const totalPossible = eligibleSessions.length;
      const totalAttended = attendedSessions.length;
      const ratePct = totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 0;

      alerts.push({
        member,
        consecutive_missed: consecutiveMissed,
        last_attended_date: lastAttendedDate,
        attendance_rate_pct: ratePct,
        total_attended: totalAttended,
        total_possible: totalPossible,
      });
    }
  }

  // Sort by highest consecutive missed first
  return alerts.sort((a, b) => b.consecutive_missed - a.consecutive_missed);
}
