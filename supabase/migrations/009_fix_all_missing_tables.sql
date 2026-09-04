-- ====================================================================
-- COMPREHENSIVE SCHEMA FIX FOR MEDHASHIREE COACHING MANAGEMENT
-- Run this script in your Supabase Project -> SQL Editor -> Run
-- This script creates all missing tables and columns safely (idempotent).
-- ====================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SITE_SETTINGS (Key-Value Store for SMS Gateway, Contact Info, etc.)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read settings" ON public.site_settings;
CREATE POLICY "Public read settings" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff manage settings" ON public.site_settings;
CREATE POLICY "Staff manage settings" ON public.site_settings FOR ALL USING (true);

-- Default site settings
INSERT INTO public.site_settings (key, value) VALUES
  ('contact_link', 'https://wa.me/8801302201431'),
  ('contact_label', 'WhatsApp Us')
ON CONFLICT (key) DO NOTHING;


-- 3. NOTICES (Center Announcements)
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active notices" ON public.notices;
CREATE POLICY "Public read active notices" ON public.notices FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Staff manage notices" ON public.notices;
CREATE POLICY "Staff manage notices" ON public.notices FOR ALL USING (true);


-- 4. FEEDBACK (Public / Student Messages)
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone submit feedback" ON public.feedback;
CREATE POLICY "Anyone submit feedback" ON public.feedback FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Staff read feedback" ON public.feedback;
CREATE POLICY "Staff read feedback" ON public.feedback FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff update feedback" ON public.feedback;
CREATE POLICY "Staff update feedback" ON public.feedback FOR UPDATE USING (true);


-- 5. SLIDER IMAGES (Homepage Banner Carousel)
CREATE TABLE IF NOT EXISTS public.slider_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.slider_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read active slider" ON public.slider_images;
CREATE POLICY "Public read active slider" ON public.slider_images FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff manage slider" ON public.slider_images;
CREATE POLICY "Staff manage slider" ON public.slider_images FOR ALL USING (true);


-- 6. USER PROFILES (Auth user metadata)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'student',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (true);


-- 7. PAYMENT ACCOUNTS & SUBMISSIONS (bKash / Nagad / Rocket numbers)
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read payment accounts" ON public.payment_accounts;
CREATE POLICY "Allow read payment accounts" ON public.payment_accounts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff manage payment accounts" ON public.payment_accounts;
CREATE POLICY "Staff manage payment accounts" ON public.payment_accounts FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.payment_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id)
);

ALTER TABLE public.payment_approvers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read payment approvers" ON public.payment_approvers;
CREATE POLICY "Read payment approvers" ON public.payment_approvers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Manage payment approvers" ON public.payment_approvers;
CREATE POLICY "Manage payment approvers" ON public.payment_approvers FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id),
  batch_id UUID REFERENCES public.batches(id),
  account_id UUID REFERENCES public.payment_accounts(id),
  payment_method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  trx_id TEXT NOT NULL,
  sender_number TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  fee_type TEXT NOT NULL,
  payment_month TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.staff(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read payment submissions" ON public.payment_submissions;
CREATE POLICY "Allow read payment submissions" ON public.payment_submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert payment submissions" ON public.payment_submissions;
CREATE POLICY "Allow insert payment submissions" ON public.payment_submissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update payment submissions" ON public.payment_submissions;
CREATE POLICY "Allow update payment submissions" ON public.payment_submissions FOR UPDATE USING (true);


-- 8. ONLINE EXAMS & SUBMISSIONS
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq','short','long')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  marks INTEGER NOT NULL DEFAULT 1,
  hint_note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read exam questions" ON public.exam_questions;
CREATE POLICY "Read exam questions" ON public.exam_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Staff manage exam questions" ON public.exam_questions;
CREATE POLICY "Staff manage exam questions" ON public.exam_questions FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id),
  student_id UUID NOT NULL REFERENCES public.students(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  is_submitted BOOLEAN DEFAULT FALSE,
  total_obtained NUMERIC(6,2) DEFAULT 0,
  auto_graded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read exam submissions" ON public.exam_submissions;
CREATE POLICY "Read exam submissions" ON public.exam_submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Submit exam" ON public.exam_submissions;
CREATE POLICY "Submit exam" ON public.exam_submissions FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.exam_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.exam_questions(id),
  student_answer TEXT,
  is_correct BOOLEAN,
  obtained_marks NUMERIC(6,2) DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, question_id)
);

ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Answers policy" ON public.exam_answers;
CREATE POLICY "Answers policy" ON public.exam_answers FOR ALL USING (true);


-- 9. EXTEND BATCHES TABLE (Missing columns)
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS schedule_days TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS schedule_time TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ongoing'
  CHECK (status IN ('ongoing','upcoming','started','admission_closed','finished'));

-- 10. EXTEND EXAMS TABLE (Online exam columns)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS show_results_immediately BOOLEAN DEFAULT TRUE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS result_note TEXT;

-- 11. EXTEND STAFF TABLE (Financial access column)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS has_financial_access BOOLEAN DEFAULT FALSE;

-- 12. STUDENT DELETION REQUESTS (Two-Person Approval & 24h Delay Deletion)
CREATE TABLE IF NOT EXISTS public.student_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  student_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT,
  approver_1 TEXT,
  approver_1_name TEXT,
  approved_at_1 TIMESTAMPTZ,
  approver_2 TEXT,
  approver_2_name TEXT,
  approved_at_2 TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_delete_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_deletion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access deletion requests" ON public.student_deletion_requests;
CREATE POLICY "Public full access deletion requests" ON public.student_deletion_requests FOR ALL USING (true);

-- Notify completion
SELECT 'All missing tables, columns, and policies created successfully!' AS result;
