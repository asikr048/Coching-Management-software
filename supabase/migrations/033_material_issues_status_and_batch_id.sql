-- ==============================================================================
-- Migration 033: Ensure status and batch_id exist on material_issues table
-- Run this in your Supabase Dashboard -> SQL Editor (or apply via migration tool)
-- ==============================================================================

-- 1. Add status column with default 'issued'
ALTER TABLE public.material_issues 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'issued';

-- 2. Add batch_id column referencing public.batches
ALTER TABLE public.material_issues 
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;

-- 3. Backfill any existing records where status is null:
UPDATE public.material_issues 
SET status = CASE 
  WHEN returned_at IS NOT NULL THEN 'returned' 
  ELSE 'issued' 
END 
WHERE status IS NULL;

-- 4. Indexes for fast status and batch queries
CREATE INDEX IF NOT EXISTS idx_material_issues_status ON public.material_issues (status);
CREATE INDEX IF NOT EXISTS idx_material_issues_batch_id ON public.material_issues (batch_id);

-- 5. Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
