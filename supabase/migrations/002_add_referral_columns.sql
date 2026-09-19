-- Migration: Add dedicated referral columns to payments and payment_submissions tables
-- Previously referral info was packed into the notes TEXT field as a formatted string,
-- which was fragile and not queryable.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS referral_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS referral_reason TEXT;

ALTER TABLE payment_submissions ADD COLUMN IF NOT EXISTS referral_name TEXT;
ALTER TABLE payment_submissions ADD COLUMN IF NOT EXISTS referral_reason TEXT;

-- Backfill existing referral data from notes field where possible
UPDATE payments
SET 
  referral_name = TRIM(substring(notes FROM 'Referral:\s*([^|]+)')),
  referral_reason = TRIM(substring(notes FROM 'Reason:\s*(.+)'))
WHERE payment_method = 'referral'
  AND notes IS NOT NULL
  AND notes LIKE '%Referral:%'
  AND referral_name IS NULL;

UPDATE payment_submissions
SET 
  referral_name = TRIM(substring(notes FROM 'Referral:\s*([^|]+)')),
  referral_reason = TRIM(substring(notes FROM 'Reason:\s*(.+)'))
WHERE payment_method = 'referral'
  AND notes IS NOT NULL
  AND notes LIKE '%Referral:%'
  AND referral_name IS NULL;
