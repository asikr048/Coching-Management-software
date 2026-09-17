-- MIGRATION 022: Batch Classroom Text Field & Branch Seats Tracking
-- Safe & idempotent script for Supabase

-- 1. Add free-text classroom column to batches
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS classroom TEXT DEFAULT '';

-- 2. Add branch_seats JSONB column to batches for multi-branch seat tracking
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS branch_seats JSONB DEFAULT '{}'::jsonb;

-- 3. Ensure payment_submissions has branch_id column
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Ensure enrollments has branch_id column
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_batches_classroom ON public.batches(classroom);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_branch ON public.payment_submissions(branch_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_branch ON public.enrollments(branch_id);
