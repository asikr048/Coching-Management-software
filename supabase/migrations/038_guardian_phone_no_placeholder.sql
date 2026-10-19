-- ==============================================================================
-- Migration 038: Never store a blank/sentinel guardian phone
-- Run this in your Supabase Dashboard -> SQL Editor (or apply via migration tool)
--
-- Migration 035 made the column nullable and purged the legacy
-- "+8801700000000" sentinel, but an older app build (or a manual write) can
-- still put it back. This adds a database-level guard so blank values and the
-- sentinel are always stored as NULL, regardless of application code.
--
-- Safe + idempotent: the UPDATE only touches sentinel/blank rows and the
-- trigger is recreated.
-- ==============================================================================

-- 1. Clean any sentinel/blank values that are already stored
UPDATE public.students
   SET guardian_phone = NULL
 WHERE guardian_phone IS NOT NULL
   AND (btrim(guardian_phone) = '' OR btrim(guardian_phone) = '+8801700000000');

-- 2. Normalize future writes at the database boundary
CREATE OR REPLACE FUNCTION public.normalize_guardian_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.guardian_phone IS NOT NULL THEN
    NEW.guardian_phone := btrim(NEW.guardian_phone);
    IF NEW.guardian_phone = '' OR NEW.guardian_phone = '+8801700000000' THEN
      NEW.guardian_phone := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_guardian_phone ON public.students;

CREATE TRIGGER trg_normalize_guardian_phone
BEFORE INSERT OR UPDATE OF guardian_phone ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.normalize_guardian_phone();

-- 3. Hard guarantee: blank strings and the sentinel can never be stored, even
-- if another trigger or a future app build tries to write them.
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_guardian_phone_no_placeholder;

ALTER TABLE public.students
  ADD CONSTRAINT students_guardian_phone_no_placeholder
  CHECK (
    guardian_phone IS NULL
    OR (btrim(guardian_phone) <> '' AND btrim(guardian_phone) <> '+8801700000000')
  );

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
