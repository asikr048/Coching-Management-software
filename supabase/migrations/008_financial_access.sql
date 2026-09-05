-- MIGRATION 008: Financial Access Permission
-- Only the Owner can grant this. Without it, no one can do financial operations.
-- Run in Supabase SQL Editor

ALTER TABLE staff ADD COLUMN IF NOT EXISTS has_financial_access BOOLEAN DEFAULT FALSE;

-- Owner always has financial access
UPDATE staff SET has_financial_access = true WHERE role = 'owner';
