-- MIGRATION 025: Ensure notices table has branch_id, branch_ids array, and foreign key
-- Run in Supabase SQL Editor if needed. Application code handles in-memory joins and resilient fallbacks.

-- 1. Ensure branch_id column exists with foreign key to branches(id)
ALTER TABLE notices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- 2. Add branch_ids UUID[] array column for multi-branch mark-selection
ALTER TABLE notices ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}'::uuid[];

-- 3. Ensure notice_date column exists
ALTER TABLE notices ADD COLUMN IF NOT EXISTS notice_date DATE DEFAULT CURRENT_DATE;

-- 4. Create indexes for efficient querying by branch and date
CREATE INDEX IF NOT EXISTS idx_notices_branch_id ON notices(branch_id);
CREATE INDEX IF NOT EXISTS idx_notices_is_active ON notices(is_active);
CREATE INDEX IF NOT EXISTS idx_notices_notice_date ON notices(notice_date DESC);

-- 5. Force PostgREST to reload schema cache so foreign keys and columns are immediately recognized
NOTIFY pgrst, 'reload schema';
