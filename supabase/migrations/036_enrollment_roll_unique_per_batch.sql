-- Migration 036: Enforce unique roll numbers per batch.
--
-- Previously a trigger silently rewrote a duplicate roll to MAX(roll_no)+1, so
-- two students could quietly swap/steal each other's roll. Roll uniqueness is
-- now enforced by the database and duplicates raise a clear error instead, so
-- callers (bulk CSV upload, single add, edit) must resolve clashes up front.
--
-- IMPORTANT: apply this in the Supabase SQL editor.

-- 1. Clean up legacy data so the unique index can be created.

-- 1a. Non-positive rolls are not real roll numbers -> treat as "unassigned".
UPDATE public.enrollments
SET roll_no = NULL
WHERE roll_no IS NOT NULL AND roll_no <= 0;

-- 1b. Reassign duplicate rolls within a batch to fresh numbers after the
--     current maximum (the first occurrence keeps its number, the rest move).
WITH ranked AS (
  SELECT id,
         batch_id,
         ROW_NUMBER() OVER (PARTITION BY batch_id ORDER BY created_at, id) AS seq,
         MAX(roll_no) OVER (PARTITION BY batch_id) AS max_roll,
         ROW_NUMBER() OVER (PARTITION BY batch_id, roll_no ORDER BY created_at, id) AS dup_seq
  FROM public.enrollments
  WHERE roll_no IS NOT NULL
)
UPDATE public.enrollments e
SET roll_no = ranked.max_roll + ranked.seq
FROM ranked
WHERE e.id = ranked.id
  AND ranked.dup_seq > 1;

-- 2. Enforce uniqueness per batch. NULLs are allowed and remain distinct.
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_batch_roll_unique
  ON public.enrollments (batch_id, roll_no);

-- 3. Trigger now only fills in a MISSING roll; it never silently rewrites a
--    supplied one. A supplied duplicate raises a unique-violation error.
CREATE OR REPLACE FUNCTION public.auto_assign_batch_roll_no()
RETURNS TRIGGER AS $$
DECLARE
  next_roll INTEGER;
BEGIN
  IF NEW.roll_no IS NULL OR NEW.roll_no <= 0 THEN
    SELECT COALESCE(MAX(roll_no), 0) + 1 INTO next_roll
    FROM public.enrollments
    WHERE batch_id = NEW.batch_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
    NEW.roll_no := next_roll;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Remove legacy trigger names and (re)create the canonical trigger.
DROP TRIGGER IF EXISTS trg_auto_assign_batch_roll_no ON public.enrollments;
DROP TRIGGER IF EXISTS auto_assign_roll_trigger ON public.enrollments;
CREATE TRIGGER auto_assign_roll_trigger
  BEFORE INSERT OR UPDATE OF roll_no ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_batch_roll_no();
