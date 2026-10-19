-- ==============================================================================
-- Migration 039: Align exams schema with the current application
-- Run this in your Supabase Dashboard -> SQL Editor (or apply via migration tool)
--
-- Older databases enforced subject/exam_date NOT NULL and a narrow
-- exams_exam_type_check that predates the routine/weekly builders. The app
-- supports one-time exams without a subject and weekly exams without a single
-- exam date, so those constraints must be relaxed.
--
-- Safe + idempotent: no rows are deleted and the check is added NOT VALID so
-- existing data is not scanned or rejected.
-- ==============================================================================

-- 1. Add the missing leaderboard visibility column (migration 017)
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS show_all_results BOOLEAN DEFAULT TRUE;

UPDATE public.exams
   SET show_all_results = TRUE
 WHERE show_all_results IS NULL;

-- 2. Allow weekly exams to omit a single date and one-time exams to omit subject
ALTER TABLE public.exams ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE public.exams ALTER COLUMN exam_date DROP NOT NULL;

-- 3. Replace the stale exam_type check with one that accepts legacy schedule values
ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_exam_type_check;

ALTER TABLE public.exams
  ADD CONSTRAINT exams_exam_type_check
  CHECK (exam_type IN ('mcq', 'written', 'mixed', 'routine', 'weekly', 'one_time'))
  NOT VALID;

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
