-- 016_ensure_payment_approvals_schema.sql
-- Ensure all columns and constraints for payment_submissions exist

ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'batch';
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS fee_due_id UUID REFERENCES public.fee_dues(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS due_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS total_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS sender_number TEXT;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.payment_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Drop NOT NULL on batch_id if it exists to allow course purchases without a batch
ALTER TABLE IF EXISTS public.payment_submissions ALTER COLUMN batch_id DROP NOT NULL;

-- Enable RLS and ensure policies permit proper reading & writing
ALTER TABLE IF EXISTS public.payment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read payment submissions" ON public.payment_submissions;
CREATE POLICY "Allow read payment submissions" ON public.payment_submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert payment submissions" ON public.payment_submissions;
CREATE POLICY "Allow insert payment submissions" ON public.payment_submissions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update payment submissions" ON public.payment_submissions;
CREATE POLICY "Allow update payment submissions" ON public.payment_submissions FOR UPDATE USING (true);
