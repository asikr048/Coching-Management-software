-- ==============================================================================
-- Migration 034: Add unique admission-time QR code to students and enrollments
-- Run this in your Supabase Dashboard -> SQL Editor (or apply via migration tool)
-- ==============================================================================

-- 1. Add qr_code column to students
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- 2. Add qr_code column to enrollments
ALTER TABLE public.enrollments 
  ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- 3. Backfill existing students where qr_code is NULL
UPDATE public.students s
SET qr_code = 'MSQR-' || 
  TO_CHAR(COALESCE(s.created_at, s.enrollment_date::timestamptz, NOW()), 'YYYYMMDD') || '-' || 
  LPAD(COALESCE(NULLIF(regexp_replace(s.student_id, '\D', '', 'g'), ''), '1'), 4, '0') || '-' || 
  UPPER(SUBSTRING(MD5(s.id::text || COALESCE(s.created_at::text, 'admission')) FROM 1 FOR 4))
WHERE s.qr_code IS NULL OR s.qr_code = '';

-- 4. Backfill existing enrollments where qr_code is NULL
UPDATE public.enrollments e
SET qr_code = 'MSQR-' || 
  TO_CHAR(COALESCE(e.created_at, NOW()), 'YYYYMMDD') || '-' || 
  LPAD(COALESCE(e.roll_no::text, '1'), 3, '0') || '-' || 
  UPPER(SUBSTRING(MD5(e.id::text || COALESCE(e.created_at::text, 'enrollment')) FROM 1 FOR 4))
FROM public.students s
WHERE e.student_id = s.id AND (e.qr_code IS NULL OR e.qr_code = '');

-- 5. Indexes for fast QR scanning lookup
CREATE INDEX IF NOT EXISTS idx_students_qr_code ON public.students (qr_code);
CREATE INDEX IF NOT EXISTS idx_enrollments_qr_code ON public.enrollments (qr_code);

-- 6. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
