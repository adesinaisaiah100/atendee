import { db } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { generateUniqueCode } from './codeGenerator';
import type { AttendanceRecord, PendingMember, InactivityAlert, Member, AttendanceSource } from '../types';

export type NetworkStatus = 'online' | 'offline' | 'syncing';

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

export async function flushSyncQueue(): Promise<{ syncedCount: number; errors: any[] }> {
  const queue = await db.sync_queue.toArray();
  if (queue.length === 0) return { syncedCount: 0, errors: [] };

  const errors: any[] = [];
  let syncedCount = 0;

  if (isSupabaseConfigured()) {
    for (const item of queue) {
      try {
        const payload = cleanPayload(item.payload);

        // Skip or sanitize non-UUID items to prevent Postgres crash
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
            const { error } = await supabase.from('attendance_records').delete().eq('id', payload.id);
            if (error) throw error;
          }
        } else if (item.type === 'pending_member') {
          if (item.action === 'insert') {
            const { error } = await supabase.from('pending_members').insert(payload);
            if (error) throw error;
          } else if (item.action === 'update') {
            const { error } = await supabase.from('pending_members').update(payload).eq('id', payload.id);
            if (error) throw error;
          } else if (item.action === 'delete') {
            const { error } = await supabase.from('pending_members').delete().eq('id', payload.id);
            if (error) throw error;
          }
        } else if (item.type === 'member') {
          if (item.action === 'insert') {
            const { error } = await supabase.from('members').insert(payload);
            if (error) throw error;
          } else if (item.action === 'update') {
            const { error } = await supabase.from('members').update(payload).eq('id', payload.id);
            if (error) throw error;
          } else if (item.action === 'delete') {
            const { error } = await supabase.from('members').delete().eq('id', payload.id);
            if (error) throw error;
          }
        } else if (item.type === 'session') {
          if (item.action === 'insert') {
            const { error } = await supabase.from('sessions').insert(payload);
            if (error) throw error;
          } else if (item.action === 'update') {
            const { error } = await supabase.from('sessions').update(payload).eq('id', payload.id);
            if (error) throw error;
          } else if (item.action === 'delete') {
            const { error } = await supabase.from('sessions').delete().eq('id', payload.id);
            if (error) throw error;
          }
        } else if (item.type === 'event') {
          if (item.action === 'insert') {
            const { error } = await supabase.from('events').insert(payload);
            if (error) throw error;
          } else if (item.action === 'update') {
            const { error } = await supabase.from('events').update(payload).eq('id', payload.id);
            if (error) throw error;
          } else if (item.action === 'delete') {
            const { error } = await supabase.from('events').delete().eq('id', payload.id);
            if (error) throw error;
          }
        } else if (item.type === 'fellowship') {
          if (item.action === 'insert' || item.action === 'update') {
            const { error } = await supabase.from('fellowships').upsert(payload);
            if (error) throw error;
          }
        } else if (item.type === 'term') {
          if (item.action === 'insert' || item.action === 'update') {
            const { error } = await supabase.from('terms').upsert(payload);
            if (error) throw error;
          }
        }

        if (item.id) await db.sync_queue.delete(item.id);
        syncedCount++;
      } catch (err) {
        console.error('Sync item error:', item, err);
        errors.push({ item, err });
      }
    }
  } else {
    // Local-first simulated sync
    await new Promise(resolve => setTimeout(resolve, 600));
    await db.sync_queue.clear();
    syncedCount = queue.length;
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
      const localMembers = await db.members.where('fellowship_id').equals(fellowshipId).toArray();
      for (const lm of localMembers) {
        if (!cloudMemberIds.has(lm.id)) {
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
      const localEvents = await db.events.where('fellowship_id').equals(fellowshipId).toArray();
      for (const le of localEvents) {
        if (!cloudEventIds.has(le.id)) {
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
      const localSessions = await db.sessions.where('fellowship_id').equals(fellowshipId).toArray();
      for (const ls of localSessions) {
        if (!cloudSessionIds.has(ls.id)) {
          await db.sessions.delete(ls.id);
        }
      }
      if (sessionsData.length > 0) {
        await db.sessions.bulkPut(sessionsData);
      }

      const sessionIds = sessionsData.map(s => s.id);
      // 5. Reconcile Attendance Records for these sessions
      if (sessionIds.length > 0) {
        const { data: attData } = await supabase
          .from('attendance_records')
          .select('*')
          .in('session_id', sessionIds);

        if (attData !== null) {
          const cloudAttIds = new Set(attData.map(a => a.id));
          const localAtt = await db.attendance_records.where('session_id').anyOf(sessionIds).toArray();
          for (const la of localAtt) {
            if (!cloudAttIds.has(la.id)) {
              await db.attendance_records.delete(la.id);
            }
          }
          if (attData.length > 0) {
            await db.attendance_records.bulkPut(attData);
          }
        }
      } else {
        // No cloud sessions exist, clear local orphan records
        const localSessions = await db.sessions.where('fellowship_id').equals(fellowshipId).toArray();
        const orphanSessionIds = localSessions.map(s => s.id);
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
      const localPending = await db.pending_members.where('fellowship_id').equals(fellowshipId).toArray();
      for (const lp of localPending) {
        if (!cloudPendingIds.has(lp.id)) {
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

// 1. Optimistic local check-in
export async function checkInMemberOptimistic(
  sessionId: string,
  memberId: string,
  source: AttendanceSource = 'self'
): Promise<AttendanceRecord> {
  const recordId = crypto.randomUUID();
  const record: AttendanceRecord = {
    id: recordId,
    session_id: sessionId,
    member_id: memberId,
    checked_in_at: new Date().toISOString(),
    source,
    sync_status: navigator.onLine ? 'synced' : 'pending_sync',
  };

  // 1. Write to Dexie immediately
  await db.attendance_records.put(record);

  // 2. Queue for background sync
  await queueMutation('attendance_record', 'insert', record);

  // 3. Direct fast write if online
  if (navigator.onLine && isSupabaseConfigured()) {
    try {
      await supabase.from('attendance_records').insert(cleanPayload(record));
    } catch (err) {
      console.warn('Direct attendance record insert error:', err);
    }
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

  if (navigator.onLine && isSupabaseConfigured()) {
    try {
      await supabase.from('pending_members').insert(cleanPayload(pending));
    } catch (err) {
      console.warn('Direct pending member insert error:', err);
    }
  }

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
    await queueMutation('pending_member', 'delete', { id: pendingId });
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

    if (!existingAtt) {
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
    const attendedSessionIds = new Set(allMemberAtt.map(a => a.session_id));

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
