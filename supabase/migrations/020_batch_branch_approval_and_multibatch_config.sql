-- MIGRATION 020: Branch-Tied Batches, Cross-Branch Approval Workflow & Multi-Batch Exam Configuration
-- Safe & idempotent script for Supabase

-- 1. Enhance batches table with approval status and cross-branch tracking
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'
  CHECK (approval_status IN ('approved', 'pending_approval', 'rejected'));

ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS origin_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS origin_batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;

-- Default any existing batches to 'approved'
UPDATE public.batches SET approval_status = 'approved' WHERE approval_status IS NULL;

-- 2. Enhance exams table with multi-batch support (batch_ids)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- If an existing exam has a batch_id, populate batch_ids array with it
UPDATE public.exams 
SET batch_ids = json_build_array(batch_id)::jsonb 
WHERE batch_id IS NOT NULL AND (batch_ids IS NULL OR batch_ids = '[]'::jsonb);

-- 3. Ensure materials table has branch_id and batch_ids
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_batches_branch_approval ON public.batches(branch_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_batches_origin_batch ON public.batches(origin_batch_id);
CREATE INDEX IF NOT EXISTS idx_exams_branch ON public.exams(branch_id);
CREATE INDEX IF NOT EXISTS idx_materials_branch ON public.materials(branch_id);
