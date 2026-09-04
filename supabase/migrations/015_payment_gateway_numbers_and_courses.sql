-- 015_payment_gateway_numbers_and_courses.sql
-- Allow payment_submissions for courses as well as batches
ALTER TABLE payment_submissions ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);
ALTER TABLE payment_submissions ALTER COLUMN batch_id DROP NOT NULL;
ALTER TABLE payment_submissions ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'batch';

-- Ensure payment_accounts has unique constraint on method
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_accounts_method_key'
  ) THEN
    ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_method_key UNIQUE (method);
  END IF;
END $$;

-- Default payment accounts if not present
INSERT INTO payment_accounts (method, account_number, account_name, is_active)
VALUES
  ('bkash', '01302201431', 'Send Money (Personal)', true),
  ('nagad', '01302201431', 'Send Money (Personal)', true),
  ('rocket', '01302201431', 'Send Money (Personal)', true),
  ('upay', '01302201431', 'Send Money (Personal)', true)
ON CONFLICT (method) DO NOTHING;

-- Default settings keys
INSERT INTO site_settings (key, value)
VALUES
  ('payment_number_bkash', '01302201431'),
  ('payment_number_nagad', '01302201431'),
  ('payment_number_rocket', '01302201431'),
  ('payment_number_upay', '01302201431'),
  ('payment_type_bkash', 'Send Money'),
  ('payment_type_nagad', 'Send Money'),
  ('payment_type_rocket', 'Send Money'),
  ('payment_type_upay', 'Send Money')
ON CONFLICT (key) DO NOTHING;
