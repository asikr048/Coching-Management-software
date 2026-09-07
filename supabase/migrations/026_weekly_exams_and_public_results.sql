-- MIGRATION 026: One-Time vs Weekly Exams, Recurring Days, Exam Pausing, and Public Online Results
-- Safe & idempotent script for Supabase

-- 1. Add exam_schedule_type column (default: 'one_time')
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_schedule_type TEXT DEFAULT 'one_time'
  CHECK (exam_schedule_type IN ('one_time', 'weekly'));

-- 2. Add recurring_days for weekly exams (e.g., ["Saturday", "Monday"])
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS recurring_days JSONB DEFAULT '[]'::jsonb;

-- 3. Add is_paused for pausing weekly exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;

-- 4. Add is_public_result to publish merit list to the public Online Result portal
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_public_result BOOLEAN DEFAULT FALSE;

-- 5. Add schedule_notice_id to link with notice board if routine is published to notices
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS schedule_notice_id UUID REFERENCES public.notices(id) ON DELETE SET NULL;

-- 6. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_exams_schedule_type ON public.exams(exam_schedule_type);
CREATE INDEX IF NOT EXISTS idx_exams_is_public_result ON public.exams(is_public_result);
CREATE INDEX IF NOT EXISTS idx_exams_is_paused ON public.exams(is_paused);

-- 7. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
