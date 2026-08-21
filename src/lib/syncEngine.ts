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
}

export async function flushSyncQueue(): Promise<{ syncedCount: number; errors: any[] }> {
  const queue = await db.sync_queue.toArray();
  if (queue.length === 0) return { syncedCount: 0, errors: [] };

  const errors: any[] = [];
  let syncedCount = 0;

  if (isSupabaseConfigured()) {
    for (const item of queue) {
      try {
        if (item.type === 'attendance_record' && item.action === 'insert') {
          const { error } = await supabase
            .from('attendance_records')
            .upsert(item.payload, { onConflict: 'session_id,member_id' });
          if (error) throw error;
        } else if (item.type === 'pending_member' && item.action === 'insert') {
          const { error } = await supabase.from('pending_members').insert(item.payload);
          if (error) throw error;
        } else if (item.type === 'member' && item.action === 'insert') {
          const { error } = await supabase.from('members').insert(item.payload);
          if (error) throw error;
        } else if (item.type === 'session' && item.action === 'update') {
          const { error } = await supabase.from('sessions').update(item.payload).eq('id', item.payload.id);
          if (error) throw error;
        }

        if (item.id) await db.sync_queue.delete(item.id);
        syncedCount++;
      } catch (err) {
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

// 1. Optimistic local check-in
export async function checkInMemberOptimistic(
  sessionId: string,
  memberId: string,
  source: AttendanceSource = 'self'
): Promise<AttendanceRecord> {
  const recordId = `a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

  // 3. Trigger immediate sync if online
  if (navigator.onLine) {
    flushSyncQueue().catch(console.error);
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
  const pendingId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

  if (navigator.onLine) {
    flushSyncQueue().catch(console.error);
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
  missedThreshold = 3
): Promise<InactivityAlert[]> {
  const activeMembers = await db.members
    .where('fellowship_id')
    .equals(fellowshipId)
    .and(m => m.is_active)
    .toArray();

  let sessionsQuery = db.sessions.where('fellowship_id').equals(fellowshipId);
  if (eventId) {
    sessionsQuery = db.sessions.where('event_id').equals(eventId);
  }

  const allSessions = await sessionsQuery.toArray();
  // Sort sessions by date descending
  const sortedSessions = allSessions.sort(
    (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
  );

  const pastClosedSessions = sortedSessions.filter(s => s.status === 'closed');
  const recentSessions = pastClosedSessions.slice(0, missedThreshold);

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
      const attendedSessions = pastClosedSessions
        .filter(s => attendedSessionIds.has(s.id))
        .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

      const lastAttendedDate = attendedSessions.length > 0 ? attendedSessions[0].session_date : null;
      const totalPossible = pastClosedSessions.length;
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
