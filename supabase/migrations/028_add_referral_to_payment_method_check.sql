-- MIGRATION 028: Add 'referral' to payments table payment_method check constraint
-- Safe & idempotent script for Supabase

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('cash','bkash','nagad','rocket','upay','card','bank','online','offline','referral'));

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
