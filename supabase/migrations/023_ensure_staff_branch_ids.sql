-- MIGRATION 023: Ensure staff branch_ids array and permissions
-- Idempotent script for Supabase SQL Editor

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS has_super_financial_access BOOLEAN DEFAULT FALSE;

-- Ensure owner has full access
UPDATE public.staff SET has_super_financial_access = TRUE WHERE role = 'owner';

-- Populate branch_ids from branch_id if branch_ids is empty
UPDATE public.staff 
SET branch_ids = ARRAY[branch_id] 
WHERE branch_id IS NOT NULL AND (branch_ids IS NULL OR branch_ids = '{}'::uuid[]);

-- Create junction table if missing
CREATE TABLE IF NOT EXISTS public.staff_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, branch_id)
);
