-- Migration 012: Referrals System Enhancement
-- Support written referral names when not linked to an existing student ID

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'referrals' AND column_name = 'referrer_id'
  ) THEN
    ALTER TABLE public.referrals ALTER COLUMN referrer_id DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_name TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE INDEX IF NOT EXISTS idx_students_referred_by_code ON public.students(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referee_id ON public.referrals(referee_id);
