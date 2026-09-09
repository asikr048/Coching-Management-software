-- Migration 024: Batch Roll Numbers (1, 2, 3...)

-- 1. Add roll_no column to enrollments if it doesn't exist
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS roll_no INTEGER;

-- 2. Add roll_no and batch_roll columns to students if they don't exist
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS roll_no INTEGER,
ADD COLUMN IF NOT EXISTS batch_roll INTEGER;

-- 3. Backfill roll_no for all existing enrollments partitioned by batch_id
DO $$
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY batch_id 
      ORDER BY enrollment_date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
    ) AS r_num
    FROM public.enrollments
  )
  UPDATE public.enrollments e
  SET roll_no = ranked.r_num
  FROM ranked
  WHERE e.id = ranked.id AND (e.roll_no IS NULL OR e.roll_no <= 0);
END $$;

-- 4. Sync primary student roll_no from their primary enrollment or batch
DO $$
BEGIN
  UPDATE public.students s
  SET roll_no = e.roll_no,
      batch_roll = e.roll_no
  FROM public.enrollments e
  WHERE e.student_id = s.id AND e.status = 'active'
    AND (s.roll_no IS NULL OR s.roll_no <= 0);
END $$;

-- 5. Trigger function to auto-assign sequential roll_no (MAX + 1 starting from 1) on new enrollment
CREATE OR REPLACE FUNCTION public.auto_assign_batch_roll_no()
RETURNS TRIGGER AS $$
DECLARE
  next_roll INTEGER;
BEGIN
  IF NEW.roll_no IS NULL OR NEW.roll_no <= 0 THEN
    SELECT COALESCE(MAX(roll_no), 0) + 1 INTO next_roll
    FROM public.enrollments
    WHERE batch_id = NEW.batch_id;
    
    NEW.roll_no := next_roll;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_batch_roll_no ON public.enrollments;
CREATE TRIGGER trg_auto_assign_batch_roll_no
BEFORE INSERT ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_batch_roll_no();

-- 6. Indexes for ultra-fast lookup by roll_no and batch_id
CREATE INDEX IF NOT EXISTS idx_enrollments_batch_roll ON public.enrollments(batch_id, roll_no);
CREATE INDEX IF NOT EXISTS idx_students_roll_no ON public.students(roll_no);
