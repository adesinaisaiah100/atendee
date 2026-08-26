import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://osbwakzvzyrpoarbvezi.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zYndha3p2enlycG9hcmJ2ZXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5MTU2NjMsImV4cCI6MjEwMjQ5MTY2M30.Mp73xw3eg7sSrzX-tkC7Uw5pTLU30I6ABzddnvLTXXY';

export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const SUPABASE_SQL_SCHEMA = `-- ==========================================
-- FELLOWSHIP ATTENDANCE SYSTEM — POSTGRES SCHEMA
-- Execute this in the Supabase SQL Editor
-- ==========================================

-- 1. Organizations / Fellowships
CREATE TABLE IF NOT EXISTS fellowships (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  slug           TEXT UNIQUE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fellowships_slug ON fellowships(slug);

-- 2. Fellowship Admins (Maps Supabase Auth User -> Fellowship Tenant)
CREATE TABLE IF NOT EXISTS fellowship_admins (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fellowship_id  UUID NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  username       TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL UNIQUE,
  role           TEXT NOT NULL DEFAULT 'admin',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admins_username ON fellowship_admins(lower(username));
CREATE INDEX IF NOT EXISTS idx_admins_fellowship ON fellowship_admins(fellowship_id);

-- 3. Known Members
CREATE TABLE IF NOT EXISTS members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fellowship_id  UUID NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  full_name      TEXT NOT NULL,
  phone          TEXT,
  gender         TEXT CHECK (gender IN ('male', 'female', 'other')),
  department     TEXT,
  check_in_code  VARCHAR(16),
  joined_at      DATE NOT NULL DEFAULT current_date,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_members_fellowship ON members(fellowship_id, is_active);
CREATE INDEX IF NOT EXISTS idx_members_code ON members(check_in_code);

-- 4. Event Templates (Recurring)
CREATE TABLE IF NOT EXISTS events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fellowship_id  UUID NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  recurrence     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Dated Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fellowship_id  UUID NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_date   DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at      TIMESTAMPTZ,
  notes          TEXT,
  UNIQUE (event_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_sessions_fellowship_date ON sessions(fellowship_id, session_date);

-- 6. Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'admin_manual', 'code')),
  UNIQUE (session_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_session_member ON attendance_records(session_id, member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member_checked ON attendance_records(member_id, checked_in_at);

-- 7. Pending Members (New / Unrecognized entries)
CREATE TABLE IF NOT EXISTS pending_members (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fellowship_id          UUID NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  session_id             UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  entered_name           TEXT NOT NULL,
  phone                  TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'deleted')),
  merged_into_member_id  UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pending_fellowship_status ON pending_members(fellowship_id, status);

-- 8. Academic Terms / Semesters
CREATE TABLE IF NOT EXISTS terms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fellowship_id  UUID NOT NULL REFERENCES fellowships(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
ALTER TABLE fellowships ENABLE ROW LEVEL SECURITY;
ALTER TABLE fellowship_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

-- Allow public access with anon key for self-check-in & cross-tenant sync
CREATE POLICY "Public Read Fellowships" ON fellowships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read Admins" ON fellowship_admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read Members" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Attendance" ON attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Pending" ON pending_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Terms" ON terms FOR ALL USING (true) WITH CHECK (true);
`;
