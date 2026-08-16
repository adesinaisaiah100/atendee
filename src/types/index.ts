export type Gender = 'male' | 'female' | 'other';
export type SessionStatus = 'open' | 'closed';
export type AttendanceSource = 'self' | 'admin_manual';
export type PendingStatus = 'pending' | 'merged' | 'deleted';
export type SyncStatus = 'synced' | 'pending_sync' | 'error';

export interface Fellowship {
  id: string;
  name: string;
  pin_code: string; // 4-digit PIN for kiosk lock
  created_at: string;
}

export interface Member {
  id: string;
  fellowship_id: string;
  full_name: string;
  phone?: string;
  gender?: Gender;
  department?: string; // Optional fellowship department (Choir, Ushering, Media, etc.)
  joined_at: string;
  is_active: boolean;
  created_at: string;
}

export interface EventTemplate {
  id: string;
  fellowship_id: string;
  name: string; // e.g. "Thursday Communion Mass", "Sunday Service", "Monday Prayer"
  recurrence?: string; // e.g. "weekly:thursday", "weekly:sunday"
  is_active: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  fellowship_id: string;
  event_id: string;
  session_date: string; // YYYY-MM-DD
  status: SessionStatus;
  opened_at: string;
  closed_at?: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  member_id: string;
  checked_in_at: string;
  source: AttendanceSource;
  sync_status?: SyncStatus;
}

export interface PendingMember {
  id: string;
  fellowship_id: string;
  session_id: string;
  entered_name: string;
  phone?: string;
  status: PendingStatus;
  merged_into_member_id?: string;
  created_at: string;
  resolved_at?: string;
  sync_status?: SyncStatus;
}

export interface Term {
  id: string;
  fellowship_id: string;
  name: string; // e.g. "2026 First Semester", "Harmattan Quarter 2026"
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface SyncQueueItem {
  id?: number;
  type: 'attendance_record' | 'pending_member' | 'member' | 'session' | 'event' | 'term';
  action: 'insert' | 'update' | 'delete';
  payload: any;
  created_at: string;
  attempts: number;
}

export interface InactivityAlert {
  member: Member;
  consecutive_missed: number;
  last_attended_date: string | null;
  attendance_rate_pct: number;
  total_attended: number;
  total_possible: number;
}

export interface MemberAttendanceStats {
  member_id: string;
  full_name: string;
  phone?: string;
  sessions_attended: number;
  sessions_possible: number;
  attendance_pct: number;
  last_seen: string | null;
}
