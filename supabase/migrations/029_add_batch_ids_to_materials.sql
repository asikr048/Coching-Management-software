-- ==============================================================================
-- Migration 029: Ensure batch_ids, description, and branch_id exist on materials table
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Add batch_ids column (stores JSON array of batch UUIDs for multi-batch assignment)
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;

-- 2. Add description column if missing
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Add branch_id column if missing
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Index for fast querying
CREATE INDEX IF NOT EXISTS idx_materials_batch_ids ON public.materials USING gin (batch_ids);

-- 5. Refresh PostgREST schema cache so the API recognizes the columns immediately
NOTIFY pgrst, 'reload schema';
