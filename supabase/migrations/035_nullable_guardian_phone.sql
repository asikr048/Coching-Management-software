-- ==============================================================================
-- Migration 035: Make students.guardian_phone nullable
-- Run this in your Supabase Dashboard -> SQL Editor (or apply via migration tool)
--
-- Removes the fake placeholder value "+8801700000000" that the CSV bulk-enroll
-- route stored to satisfy the old NOT NULL constraint, then drops the constraint
-- so blank guardian phones are stored as NULL like the other optional fields.
--
-- Safe + idempotent: ALTER ... DROP NOT NULL is a no-op if already nullable,
-- and the UPDATE only touches rows still holding the placeholder.
-- ==============================================================================

-- 1. Allow NULL guardian phone
ALTER TABLE public.students ALTER COLUMN guardian_phone DROP NOT NULL;

-- 2. Purge the legacy placeholder written by the bulk-enroll route
UPDATE public.students
   SET guardian_phone = NULL
 WHERE guardian_phone = '+8801700000000';

-- 3. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
