-- ============================================================
-- v5 Migration: Member Hostel + Room/Block fields & Public RPCs
-- Safe to run in Supabase SQL Editor (idempotent)
-- ============================================================

-- 1. Add hostel and room_or_block columns to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS hostel TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS room_or_block TEXT;
CREATE INDEX IF NOT EXISTS idx_members_hostel ON members(fellowship_id, hostel);

-- 2. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- NOTE: If your public_join and public_join_session SECURITY DEFINER RPCs
-- currently accept (p_slug, p_full_name, p_phone, p_department) and
-- (p_token, p_full_name, p_phone, p_department, p_device_id),
-- add optional defaulted parameters:
--   p_hostel TEXT DEFAULT NULL,
--   p_room_or_block TEXT DEFAULT NULL
-- and store them into members(hostel, room_or_block).
-- The frontend automatically falls back to the legacy signature if PGRST202 occurs.
