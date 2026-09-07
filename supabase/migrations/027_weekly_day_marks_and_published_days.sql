-- MIGRATION 027: Weekly Day Marks, Published Days & Weekly Consolidated Results
-- Safe & idempotent script for Supabase

-- 1. Add day_marks JSONB column to exam_results to store day-by-day marks
-- e.g. { "Saturday": { "marks": 45, "total": 50, "grade": "A+", "exam_name": "Math" } }
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS day_marks JSONB DEFAULT '{}'::jsonb;

-- 2. Add published_days JSONB to exams to track which individual days are published to students
-- e.g. ["Saturday", "Monday"]
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS published_days JSONB DEFAULT '[]'::jsonb;

-- 3. Add is_weekly_published boolean to exams to track if consolidated weekly results are published
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_weekly_published BOOLEAN DEFAULT FALSE;

-- 4. Create index for published status
CREATE INDEX IF NOT EXISTS idx_exams_is_weekly_published ON public.exams(is_weekly_published);

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
