-- Migration 031: Resequence duplicate batch roll numbers (1, 2, 3...)
-- Ensures strict sequential rolls (1, 2, 3...) starting from 1 for every batch,
-- resolving any duplicate rolls (e.g. multiple Roll 1s) caused by client defaults.

-- 1. Re-sequence all enrollments partitioned by batch_id
DO $$
BEGIN
  WITH ranked AS (
    SELECT 
      id, 
      ROW_NUMBER() OVER (
        PARTITION BY batch_id 
        ORDER BY enrollment_date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
      ) AS r_num
    FROM public.enrollments
  )
  UPDATE public.enrollments e
  SET roll_no = ranked.r_num
  FROM ranked
  WHERE e.id = ranked.id 
    AND (e.roll_no IS NULL OR e.roll_no <> ranked.r_num);
END $$;

-- 2. Sync updated roll_no and batch_roll to students table
DO $$
BEGIN
  UPDATE public.students s
  SET roll_no = e.roll_no,
      batch_roll = e.roll_no
  FROM public.enrollments e
  WHERE e.student_id = s.id 
    AND e.status = 'active'
    AND (s.roll_no IS NULL OR s.roll_no <> e.roll_no OR s.batch_roll IS NULL OR s.batch_roll <> e.roll_no);
END $$;

-- 3. Trigger enhancement: Ensure roll_no is always MAX + 1 if duplicate or null
CREATE OR REPLACE FUNCTION public.auto_assign_batch_roll_no()
RETURNS TRIGGER AS $$
DECLARE
  next_roll INTEGER;
  existing_count INTEGER;
BEGIN
  -- Check if roll_no is missing or already taken in this batch
  IF NEW.roll_no IS NOT NULL AND NEW.roll_no > 0 THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.enrollments
    WHERE batch_id = NEW.batch_id AND roll_no = NEW.roll_no AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
      -- Duplicate detected! Auto-assign MAX + 1
      SELECT COALESCE(MAX(roll_no), 0) + 1 INTO next_roll
      FROM public.enrollments
      WHERE batch_id = NEW.batch_id;
      
      NEW.roll_no := next_roll;
    END IF;
  ELSE
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
