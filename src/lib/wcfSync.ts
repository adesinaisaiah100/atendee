import { db } from './db';
import { supabase } from './supabase';
import type {
  AttendanceRecord,
  EventTemplate,
  Fellowship,
  Member,
  Session,
  WcfEventCode,
  WcfSyncLog,
} from '../types';

const EVENT_MAP_STORAGE_KEY = 'atendee_wcf_event_map';

export interface WcfAbsenteePayload {
  fullName: string;
  phone: string;
  hostel: string;
  roomOrBlock?: string;
  unit?: string;
  newMember: boolean;
  lastCheckInDate: string;
}

export interface WcfSyncOutcome {
  status: 'synced' | 'failed' | 'skipped';
  reason?: 'not_wcf' | 'unmapped_event' | 'no_absentees' | 'offline' | 'api_error';
  eventCode?: WcfEventCode;
  processed: number;
  newMembersAdded: number;
  membersUpdated: number;
  skippedNoPhone: number;
  message: string;
}

/**
 * Strict WCF tenant guard:
 * - If VITE_WCF_FELLOWSHIP_ID is configured, requires exact UUID match.
 * - Else if VITE_WCF_FELLOWSHIP_SLUG is configured, requires exact slug match.
 * - Else matches WCF by slug/name ("wcf", "wcf-*", "*-wcf", or "winners campus fellowship").
 * All other fellowships return false and never call the WCF tracker API.
 */
export function isWcfFellowship(fellowship: Fellowship | null | undefined): boolean {
  if (!fellowship) return false;

  const envId = (import.meta.env.VITE_WCF_FELLOWSHIP_ID as string | undefined)?.trim();
  if (envId) {
    return fellowship.id === envId;
  }

  const envSlug = (import.meta.env.VITE_WCF_FELLOWSHIP_SLUG as string | undefined)?.trim().toLowerCase();
  if (envSlug) {
    return fellowship.slug.trim().toLowerCase() === envSlug;
  }

  const slug = (fellowship.slug || '').trim().toLowerCase();
  const name = (fellowship.name || '').trim().toLowerCase();

  return (
    slug === 'wcf' ||
    slug.startsWith('wcf-') ||
    slug.endsWith('-wcf') ||
    slug.includes('-wcf-') ||
    /\bwcf\b/.test(name) ||
    name.includes('winners campus fellowship')
  );
}

/** Auto-detect one of the 4 allowed WCF tracker event codes from an event name. */
export function detectWcfEventCode(eventName: string): WcfEventCode | null {
  const n = eventName.trim().toLowerCase();
  if (!n) return null;

  if (/\bfjc\b/.test(n) || n.includes('fresher') || n.includes('jewel')) {
    return 'fjc';
  }
  if (n.includes('prayer') || n.includes('intercess')) {
    return 'prayer_meeting';
  }
  if (n.includes('bible') || n.includes('study') || n.includes('digging')) {
    return 'bible_study';
  }
  if (n.includes('sunday') || n.includes('worship') || n.includes('main service')) {
    return 'sunday_service';
  }
  return null;
}

type StoredEventMap = Record<string, WcfEventCode | 'none'>;

function readEventMap(): StoredEventMap {
  try {
    const raw = localStorage.getItem(EVENT_MAP_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredEventMap;
  } catch {
    return {};
  }
}

export function getRawWcfEventOverride(eventId: string): WcfEventCode | 'none' | 'auto' {
  const map = readEventMap();
  return map[eventId] ?? 'auto';
}

export function setWcfEventCodeOverride(eventId: string, value: WcfEventCode | 'none' | 'auto') {
  try {
    const map = readEventMap();
    if (value === 'auto') {
      delete map[eventId];
    } else {
      map[eventId] = value;
    }
    localStorage.setItem(EVENT_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore storage errors */
  }
}

/** Resolve the effective WCF event code (manual override > keyword auto-detect). */
export function getWcfEventCodeForEvent(event: EventTemplate | null | undefined): WcfEventCode | null {
  if (!event) return null;
  const override = getRawWcfEventOverride(event.id);
  if (override === 'none') return null;
  if (override !== 'auto') return override;
  return detectWcfEventCode(event.name);
}

function toIsoDate(value: string | undefined, fallbackIso: string): string {
  if (!value) return fallbackIso;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return parsed.toISOString();
}

/** Build the exact absentees array expected by POST /api/v1/sync/attendance. */
export function buildWcfAbsenteesPayload(
  session: Session,
  members: Member[],
  attendanceRecords: AttendanceRecord[]
): { absentees: WcfAbsenteePayload[]; skippedNoPhone: number } {
  const validRecords = attendanceRecords.filter(r => r.status !== 'removed');

  const presentIds = new Set(
    validRecords.filter(r => r.session_id === session.id).map(r => r.member_id)
  );

  // Latest check-in timestamp across ALL sessions for each member
  const lastCheckInByMember = new Map<string, string>();
  for (const r of validRecords) {
    const prev = lastCheckInByMember.get(r.member_id);
    if (!prev || r.checked_in_at > prev) {
      lastCheckInByMember.set(r.member_id, r.checked_in_at);
    }
  }

  const activeAbsentees = members.filter(m => m.is_active && !presentIds.has(m.id));
  const absentees: WcfAbsenteePayload[] = [];
  let skippedNoPhone = 0;

  for (const m of activeAbsentees) {
    const phone = m.phone?.trim();
    if (!phone) {
      skippedNoPhone++;
      continue;
    }

    const rawUnit = m.department?.trim();
    const unit =
      rawUnit && rawUnit !== 'No Unit' && rawUnit !== 'General' ? rawUnit : undefined;

    const fallbackDate = toIsoDate(
      m.joined_at || m.created_at,
      new Date().toISOString()
    );
    const lastCheckInDate = toIsoDate(lastCheckInByMember.get(m.id), fallbackDate);

    absentees.push({
      fullName: m.full_name.trim(),
      phone,
      hostel: m.hostel?.trim() || 'Unknown',
      ...(m.room_or_block?.trim() ? { roomOrBlock: m.room_or_block.trim() } : {}),
      ...(unit ? { unit } : {}),
      newMember: Boolean(m.is_newcomer),
      lastCheckInDate,
    });
  }

  return { absentees, skippedNoPhone };
}

/**
 * Syncs absentees of a completed session to the WCF Evangelism & Follow-up Tracker
 * via our server-side Vercel proxy (/api/wcf-sync).
 * Strictly no-ops for any non-WCF fellowship.
 */
export async function syncSessionToWcfTracker(params: {
  fellowship: Fellowship | null;
  event: EventTemplate | null;
  session: Session;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  eventCodeOverride?: WcfEventCode;
}): Promise<WcfSyncOutcome> {
  const { fellowship, event, session, members, attendanceRecords, eventCodeOverride } = params;

  if (!isWcfFellowship(fellowship)) {
    return {
      status: 'skipped',
      reason: 'not_wcf',
      processed: 0,
      newMembersAdded: 0,
      membersUpdated: 0,
      skippedNoPhone: 0,
      message: 'Skipped: not a WCF fellowship.',
    };
  }

  const eventCode = eventCodeOverride ?? getWcfEventCodeForEvent(event);
  if (!eventCode) {
    return {
      status: 'skipped',
      reason: 'unmapped_event',
      processed: 0,
      newMembersAdded: 0,
      membersUpdated: 0,
      skippedNoPhone: 0,
      message: 'Skipped WCF sync: event is not mapped to one of the 4 WCF services.',
    };
  }

  const { absentees, skippedNoPhone } = buildWcfAbsenteesPayload(
    session,
    members,
    attendanceRecords
  );

  if (absentees.length === 0) {
    const log: WcfSyncLog = {
      session_id: session.id,
      fellowship_id: fellowship!.id,
      event_code: eventCode,
      status: 'skipped',
      synced_at: new Date().toISOString(),
      processed: 0,
      new_members_added: 0,
      members_updated: 0,
      skipped_no_phone: skippedNoPhone,
      error: skippedNoPhone > 0 ? `All ${skippedNoPhone} absentees are missing phone numbers.` : undefined,
    };
    await db.wcf_sync_logs.put(log);

    return {
      status: 'skipped',
      reason: 'no_absentees',
      eventCode,
      processed: 0,
      newMembersAdded: 0,
      membersUpdated: 0,
      skippedNoPhone,
      message:
        skippedNoPhone > 0
          ? `WCF sync skipped: ${skippedNoPhone} absentee(s) have no phone number.`
          : '100% attendance — no absentees to sync to WCF Tracker.',
    };
  }

  if (!navigator.onLine) {
    const log: WcfSyncLog = {
      session_id: session.id,
      fellowship_id: fellowship!.id,
      event_code: eventCode,
      status: 'failed',
      synced_at: new Date().toISOString(),
      processed: 0,
      new_members_added: 0,
      members_updated: 0,
      skipped_no_phone: skippedNoPhone,
      error: 'Device is offline. Tap Retry when back online.',
    };
    await db.wcf_sync_logs.put(log);
    return {
      status: 'failed',
      reason: 'offline',
      eventCode,
      processed: 0,
      newMembersAdded: 0,
      membersUpdated: 0,
      skippedNoPhone,
      message: 'Offline: could not reach WCF Tracker. Tap Retry once online.',
    };
  }

  const sessionDateIso = toIsoDate(
    session.opened_at || `${session.session_date}T09:00:00.000Z`,
    new Date().toISOString()
  );

  try {
    const { data: authData } = await supabase.auth.getSession();
    const accessToken = authData?.session?.access_token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch('/api/wcf-sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fellowshipId: fellowship!.id,
        fellowshipSlug: fellowship!.slug,
        fellowshipName: fellowship!.name,
        event: eventCode,
        sessionDate: sessionDateIso,
        absentees,
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      processed?: number;
      newMembersAdded?: number;
      membersUpdated?: number;
    } | null;

    if (!res.ok || !data?.ok) {
      const errorMsg = data?.error || `Sync failed (HTTP ${res.status})`;
      const log: WcfSyncLog = {
        session_id: session.id,
        fellowship_id: fellowship!.id,
        event_code: eventCode,
        status: 'failed',
        synced_at: new Date().toISOString(),
        processed: 0,
        new_members_added: 0,
        members_updated: 0,
        skipped_no_phone: skippedNoPhone,
        error: errorMsg,
      };
      await db.wcf_sync_logs.put(log);
      return {
        status: 'failed',
        reason: 'api_error',
        eventCode,
        processed: 0,
        newMembersAdded: 0,
        membersUpdated: 0,
        skippedNoPhone,
        message: errorMsg,
      };
    }

    const processed = data.processed ?? absentees.length;
    const newMembersAdded = data.newMembersAdded ?? 0;
    const membersUpdated = data.membersUpdated ?? 0;

    const log: WcfSyncLog = {
      session_id: session.id,
      fellowship_id: fellowship!.id,
      event_code: eventCode,
      status: 'synced',
      synced_at: new Date().toISOString(),
      processed,
      new_members_added: newMembersAdded,
      members_updated: membersUpdated,
      skipped_no_phone: skippedNoPhone,
    };
    await db.wcf_sync_logs.put(log);

    const skippedNote =
      skippedNoPhone > 0 ? ` (${skippedNoPhone} skipped: no phone)` : '';

    return {
      status: 'synced',
      eventCode,
      processed,
      newMembersAdded,
      membersUpdated,
      skippedNoPhone,
      message: `Synced ${processed} absentee${processed === 1 ? '' : 's'} to WCF Tracker${skippedNote}.`,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Network error while syncing to WCF Tracker.';
    const log: WcfSyncLog = {
      session_id: session.id,
      fellowship_id: fellowship!.id,
      event_code: eventCode,
      status: 'failed',
      synced_at: new Date().toISOString(),
      processed: 0,
      new_members_added: 0,
      members_updated: 0,
      skipped_no_phone: skippedNoPhone,
      error: errorMsg,
    };
    await db.wcf_sync_logs.put(log);
    return {
      status: 'failed',
      reason: 'api_error',
      eventCode,
      processed: 0,
      newMembersAdded: 0,
      membersUpdated: 0,
      skippedNoPhone,
      message: errorMsg,
    };
  }
}
