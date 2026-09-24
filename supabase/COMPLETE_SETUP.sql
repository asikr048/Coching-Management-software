-- ==================== 001_schema.sql ====================
-- COACHING MANAGEMENT SOFTWARE - COMPLETE DATABASE SCHEMA
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner','receptionist','teacher','accountant','course_teacher')),
  salary NUMERIC(10,2) DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  subject TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  joined_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  student_id TEXT UNIQUE NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  guardian_name TEXT,
  guardian_phone TEXT NOT NULL,
  guardian_relation TEXT DEFAULT 'Parent',
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female','other')),
  address TEXT,
  school_college TEXT,
  class_level TEXT,
  photo_url TEXT,
  biometric_template TEXT,
  biometric_enrolled BOOLEAN DEFAULT FALSE,
  referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  referred_by_student_id UUID REFERENCES students(id),
  is_active BOOLEAN DEFAULT TRUE,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  subject TEXT,
  class_level TEXT,
  teacher_id UUID REFERENCES staff(id),
  room_id UUID REFERENCES rooms(id),
  schedule TEXT,
  start_date DATE,
  end_date DATE,
  max_seats INTEGER DEFAULT 30,
  current_seats INTEGER DEFAULT 0,
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  admission_fee NUMERIC(10,2) DEFAULT 0,
  fee_type TEXT DEFAULT 'monthly' CHECK (fee_type IN ('monthly','quarterly','one_time')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  enrolled_by UUID REFERENCES staff(id),
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','transferred','completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, batch_id)
);

CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID REFERENCES batches(id),
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  fee_type TEXT DEFAULT 'monthly',
  due_day INTEGER DEFAULT 10,
  late_fee NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id),
  batch_id UUID REFERENCES batches(id),
  enrollment_id UUID REFERENCES enrollments(id),
  amount NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  late_fee NUMERIC(10,2) DEFAULT 0,
  total_paid NUMERIC(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','bkash','nagad','card','bank','online')),
  transaction_id TEXT,
  payment_for TEXT,
  payment_month TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  received_by UUID REFERENCES staff(id),
  receipt_number TEXT UNIQUE DEFAULT '',
  notes TEXT,
  is_refunded BOOLEAN DEFAULT FALSE,
  refund_amount NUMERIC(10,2),
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fee_dues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  due_month TEXT NOT NULL,
  due_amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','waived')),
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, batch_id, due_month)
);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES students(id),
  referee_id UUID NOT NULL REFERENCES students(id),
  commission_amount NUMERIC(10,2) DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 10,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  approved_by UUID REFERENCES staff(id),
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referee_id)
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  entry_method TEXT DEFAULT 'manual' CHECK (entry_method IN ('fingerprint','manual','qr')),
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  fee_alert_triggered BOOLEAN DEFAULT FALSE,
  note TEXT,
  marked_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, batch_id, date)
);

CREATE TABLE biometric_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id),
  branch_id UUID REFERENCES branches(id),
  scan_at TIMESTAMPTZ DEFAULT NOW(),
  recognized BOOLEAN DEFAULT FALSE,
  fee_alert BOOLEAN DEFAULT FALSE,
  entry_granted BOOLEAN DEFAULT TRUE,
  device_id TEXT,
  raw_data JSONB
);

CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  batch_id UUID REFERENCES batches(id),
  title TEXT NOT NULL,
  exam_type TEXT DEFAULT 'written' CHECK (exam_type IN ('mcq','written','mixed')),
  subject TEXT,
  total_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 33,
  exam_date DATE,
  duration_minutes INTEGER DEFAULT 60,
  instructions TEXT,
  answer_key_url TEXT,
  created_by UUID REFERENCES staff(id),
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id),
  student_id UUID NOT NULL REFERENCES students(id),
  obtained_marks NUMERIC(6,2),
  grade TEXT,
  rank INTEGER,
  entered_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'book' CHECK (type IN ('book','notes','worksheet','other')),
  batch_id UUID REFERENCES batches(id),
  subject TEXT,
  total_stock INTEGER DEFAULT 0,
  available_stock INTEGER DEFAULT 0,
  price NUMERIC(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE material_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id),
  student_id UUID NOT NULL REFERENCES students(id),
  issued_by UUID REFERENCES staff(id),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  return_due_date DATE,
  returned_at TIMESTAMPTZ,
  condition_on_return TEXT,
  notes TEXT
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES staff(id),
  branch_id UUID REFERENCES branches(id),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_price NUMERIC(10,2),
  discount_code TEXT,
  discount_expires_at TIMESTAMPTZ,
  access_days INTEGER DEFAULT 365,
  commission_rate NUMERIC(5,2) DEFAULT 30,
  category TEXT,
  level TEXT DEFAULT 'beginner',
  language TEXT DEFAULT 'Bengali',
  is_published BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','pending_review','published','rejected')),
  total_sales INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT DEFAULT 'video' CHECK (content_type IN ('video','pdf','quiz','text')),
  content_url TEXT,
  duration_minutes INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_preview BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id),
  student_id UUID REFERENCES students(id),
  buyer_name TEXT,
  buyer_phone TEXT,
  buyer_email TEXT,
  amount_paid NUMERIC(10,2) NOT NULL,
  payment_method TEXT,
  transaction_id TEXT,
  teacher_earnings NUMERIC(10,2),
  platform_earnings NUMERIC(10,2),
  access_expires_at TIMESTAMPTZ,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id),
  purchase_id UUID REFERENCES course_purchases(id),
  reviewer_name TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sms_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  student_id UUID REFERENCES students(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES staff(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  category TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  paid_by UUID REFERENCES staff(id),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_students_branch ON students(branch_id);
CREATE INDEX idx_students_referral_code ON students(referral_code);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_batch ON enrollments(batch_id);
CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX idx_attendance_batch_date ON attendance(batch_id, date);
CREATE INDEX idx_fee_dues_student ON fee_dues(student_id);
CREATE INDEX idx_fee_dues_status ON fee_dues(status);
CREATE INDEX idx_sms_queue_status ON sms_queue(status);
CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_courses_status ON courses(status);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER AS $$
DECLARE year TEXT := TO_CHAR(NOW(), 'YYYY'); seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 9) AS INTEGER)), 0) + 1 INTO seq FROM students WHERE student_id LIKE 'EDU-' || year || '-%';
  NEW.student_id := 'EDU-' || year || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER set_student_id BEFORE INSERT ON students FOR EACH ROW WHEN (NEW.student_id IS NULL OR NEW.student_id = '') EXECUTE FUNCTION generate_student_id();

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER set_referral_code BEFORE INSERT ON students FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE year TEXT := TO_CHAR(NOW(), 'YYYY'); seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 10) AS INTEGER)), 0) + 1 INTO seq FROM payments WHERE receipt_number LIKE 'RCP-' || year || '-%';
  NEW.receipt_number := 'RCP-' || year || '-' || LPAD(seq::TEXT, 6, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER set_receipt_number BEFORE INSERT ON payments FOR EACH ROW WHEN (NEW.receipt_number IS NULL OR NEW.receipt_number = '') EXECUTE FUNCTION generate_receipt_number();

CREATE OR REPLACE FUNCTION update_batch_seats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE batches SET current_seats = current_seats + 1 WHERE id = NEW.batch_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE batches SET current_seats = current_seats - 1 WHERE id = NEW.batch_id;
    ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE batches SET current_seats = current_seats + 1 WHERE id = NEW.batch_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER update_seats_on_enrollment AFTER INSERT OR UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION update_batch_seats();

CREATE OR REPLACE FUNCTION update_course_sales()
RETURNS TRIGGER AS $$ BEGIN UPDATE courses SET total_sales = total_sales + 1 WHERE id = NEW.course_id; RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER increment_course_sales AFTER INSERT ON course_purchases FOR EACH ROW EXECUTE FUNCTION update_course_sales();

-- ==================== 002_add_referral_columns.sql ====================
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

-- ==================== 002_batch_details.sql ====================
-- Add schedule and description fields to batches
ALTER TABLE batches ADD COLUMN IF NOT EXISTS schedule_days TEXT DEFAULT '';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS schedule_time TEXT DEFAULT '';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

-- ==================== 003_slider_images.sql ====================
-- Slider images for homepage carousel
CREATE TABLE IF NOT EXISTS slider_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== 004_user_profiles.sql ====================
-- User profiles with auto-generated ID for login
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  auth_user_id UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create a sequence for auto-incrementing user IDs
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 10001;

-- ==================== 005_manager_roles.sql ====================
-- Migration: Add super_manager and manager roles
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check 
  CHECK (role IN ('owner','super_manager','manager','receptionist','teacher','accountant','course_teacher'));

-- ==================== 006_payment_system.sql ====================
-- Migration 006: Payment System
-- payment_accounts: bKash/Nagad/Rocket/Upay numbers (Owner-managed)
CREATE TABLE IF NOT EXISTS payment_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  method TEXT NOT NULL CHECK (method IN ('bkash','nagad','rocket','upay')),
  account_number TEXT NOT NULL,
  account_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- payment_approvers: Staff designated by Owner to approve payments
CREATE TABLE IF NOT EXISTS payment_approvers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  added_by UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id)
);

-- payment_submissions: Student payment submissions (pending approval)
CREATE TABLE IF NOT EXISTS payment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id),
  batch_id UUID NOT NULL REFERENCES batches(id),
  amount NUMERIC(10,2) NOT NULL,
  total_fee NUMERIC(10,2) NOT NULL,
  due_amount NUMERIC(10,2) DEFAULT 0,
  due_date DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bkash','nagad','rocket','upay','offline')),
  sender_number TEXT,
  transaction_id TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by UUID REFERENCES staff(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add rocket and upay to payments table payment_method check
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('cash','bkash','nagad','rocket','upay','card','bank','online','offline'));

-- ==================== 007_batch_status_and_online_exams.sql ====================
-- MIGRATION 007: Batch Status + Online Exam System
-- Run in Supabase SQL Editor

-- 1. Add status column to batches for lifecycle management
ALTER TABLE batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ongoing' 
  CHECK (status IN ('ongoing','upcoming','started','admission_closed','finished'));

-- Update existing active batches to 'ongoing'
UPDATE batches SET status = 'ongoing' WHERE is_active = true AND status IS NULL;
UPDATE batches SET status = 'finished' WHERE is_active = false AND status IS NULL;

-- 2. Online Exam Questions
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq','short','long')),
  question_text TEXT NOT NULL,
  options JSONB, -- for MCQ: ["option1","option2","option3","option4"]
  correct_answer TEXT, -- for MCQ: the correct option text; for short: expected answer
  marks INTEGER NOT NULL DEFAULT 1,
  hint_note TEXT, -- shown to student in results review as learning note
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Student Exam Submissions (overall submission)
CREATE TABLE IF NOT EXISTS exam_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id),
  student_id UUID NOT NULL REFERENCES students(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  is_submitted BOOLEAN DEFAULT FALSE,
  total_obtained NUMERIC(6,2) DEFAULT 0,
  auto_graded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

-- 4. Individual Question Answers
CREATE TABLE IF NOT EXISTS exam_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES exam_questions(id),
  student_answer TEXT,
  is_correct BOOLEAN,
  obtained_marks NUMERIC(6,2) DEFAULT 0,
  feedback TEXT, -- teacher's per-question feedback note
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, question_id)
);

-- 5. Add is_online flag to exams table  
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS show_results_immediately BOOLEAN DEFAULT TRUE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS result_note TEXT; -- Overall note shown with results

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam ON exam_submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_student ON exam_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers_submission ON exam_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_fee_dues_student ON fee_dues(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_dues_batch ON fee_dues(batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_batch ON attendance(batch_id);

-- ==================== 007_notices_feedback_settings.sql ====================
-- Notices: posted by anyone with staff access (manager, owner, etc.)
CREATE TABLE IF NOT EXISTS notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback: submitted by anyone (public)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site settings: key-value store for configurable values
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default contact link
INSERT INTO site_settings (key, value) VALUES
  ('contact_link', 'https://wa.me/8801302201431'),
  ('contact_label', 'WhatsApp Us')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active notices" ON notices FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage notices" ON notices FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid()));
CREATE POLICY "Anyone submit feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff read feedback" ON feedback FOR SELECT USING (EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid()));
CREATE POLICY "Staff update feedback" ON feedback FOR UPDATE USING (EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid()));
CREATE POLICY "Public read settings" ON site_settings FOR SELECT USING (true);
CREATE POLICY "Staff manage settings" ON site_settings FOR ALL USING (EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid() AND role IN ('owner','super_manager','manager')));

-- ==================== 008_financial_access.sql ====================
-- MIGRATION 008: Financial Access Permission
-- Only the Owner can grant this. Without it, no one can do financial operations.
-- Run in Supabase SQL Editor

ALTER TABLE staff ADD COLUMN IF NOT EXISTS has_financial_access BOOLEAN DEFAULT FALSE;

-- Owner always has financial access
UPDATE staff SET has_financial_access = true WHERE role = 'owner';

-- ==================== 009_fix_all_missing_tables.sql ====================
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

-- 13. MATERIALS & MATERIAL ISSUES (Study Materials & Distribution Tracking)
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'sheet',
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  subject TEXT,
  total_stock INTEGER DEFAULT 0,
  available_stock INTEGER DEFAULT 0,
  price NUMERIC(8,2) DEFAULT 0,
  description TEXT,
  batch_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.material_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  issued_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  return_due_date DATE,
  returned_at TIMESTAMPTZ,
  condition_on_return TEXT,
  notes TEXT,
  status TEXT DEFAULT 'issued'
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access materials" ON public.materials;
CREATE POLICY "Public full access materials" ON public.materials FOR ALL USING (true);

ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access material_issues" ON public.material_issues;
CREATE POLICY "Public full access material_issues" ON public.material_issues FOR ALL USING (true);

-- Notify completion
SELECT 'All missing tables, columns, and policies created successfully!' AS result;

-- ==================== 010_student_deletion_requests.sql ====================
-- Migration 010: Two-Person Approval and 24-Hour Timelock Student Deletion System
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
CREATE POLICY "Public full access deletion requests"
  ON public.student_deletion_requests
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- ==================== 011_materials_and_distribution.sql ====================
-- Migration 011: Materials & Distribution Schema
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'sheet',
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  subject TEXT,
  total_stock INTEGER DEFAULT 0,
  available_stock INTEGER DEFAULT 0,
  price NUMERIC(8,2) DEFAULT 0,
  description TEXT,
  batch_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;

-- Drop old check constraint if it exists to allow sheet, notes, book, etc.
DO $$$
BEGIN
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$$;

CREATE TABLE IF NOT EXISTS public.material_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  issued_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  return_due_date DATE,
  returned_at TIMESTAMPTZ,
  condition_on_return TEXT,
  notes TEXT,
  status TEXT DEFAULT 'issued'
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access materials" ON public.materials;
CREATE POLICY "Public full access materials" ON public.materials FOR ALL USING (true);

ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access material_issues" ON public.material_issues;
CREATE POLICY "Public full access material_issues" ON public.material_issues FOR ALL USING (true);

-- ==================== 012_referrals_enhancement.sql ====================
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

-- ==================== 013_fix_slider_spelling.sql ====================
-- Fix spelling of MedhaSiri / MedhaShiri to MedhaShiree in slider_images table
UPDATE slider_images 
SET 
  title = REGEXP_REPLACE(title, 'Medha\s*sh?ir[ei]+', 'MedhaShiree', 'gi'),
  subtitle = CASE 
    WHEN subtitle IS NOT NULL THEN REGEXP_REPLACE(subtitle, 'Medha\s*sh?ir[ei]+', 'MedhaShiree', 'gi')
    ELSE subtitle 
  END
WHERE 
  title ILIKE '%medhasiri%' 
  OR title ILIKE '%medhashiri%'
  OR subtitle ILIKE '%medhasiri%' 
  OR subtitle ILIKE '%medhashiri%';

-- ==================== 014_homepage_contact_settings.sql ====================
-- Insert default contact and homepage settings into site_settings
INSERT INTO site_settings (key, value) VALUES
  ('contact_phone', '01302201431'),
  ('contact_email', 'info@medhashiree.com'),
  ('contact_address', 'Rajshahi, Bangladesh'),
  ('contact_link', 'https://wa.me/8801302201431'),
  ('contact_label', 'WhatsApp Us'),
  ('footer_about', 'Rajshahi''s premier coaching center. Quality education, expert teachers, and a proven track record of student success.')
ON CONFLICT (key) DO NOTHING;

-- ==================== 015_payment_gateway_numbers_and_courses.sql ====================
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

-- ==================== 016_ensure_payment_approvals_schema.sql ====================
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

-- ==================== 017_exam_leaderboard_visibility.sql ====================
-- MIGRATION 017: Exam Marks Visibility Control
-- Default is TRUE: All enrolled students can view everyone's marks & batch merit list
-- When FALSE: Each student can only view their own marks privately

ALTER TABLE exams ADD COLUMN IF NOT EXISTS show_all_results BOOLEAN DEFAULT TRUE;

-- Ensure any existing exams default to true
UPDATE exams SET show_all_results = TRUE WHERE show_all_results IS NULL;

-- ==================== 018_multi_branch_and_homepage_system.sql ====================
-- MIGRATION 018: Multi-Branch Coaching Management System, Permissions, Branch SMS APIs & Homepage Content
-- Run in Supabase SQL Editor if needed. All frontend code is resilient with fallback guards.

-- 1. Enhance branches table with rich management & contact details
ALTER TABLE branches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS branch_director TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS director_phone TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_phone TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS established_year TEXT DEFAULT '2018';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS contact_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS sms_gateway_config JSONB DEFAULT '{}'::jsonb;

-- 2. Enhance staff table for multi-branch access and super financial access
ALTER TABLE staff ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE staff ADD COLUMN IF NOT EXISTS has_super_financial_access BOOLEAN DEFAULT FALSE;

-- Ensure owner always has super financial access
UPDATE staff SET has_super_financial_access = TRUE WHERE role = 'owner';

-- 3. Junction table for explicit multi-branch relationships
CREATE TABLE IF NOT EXISTS staff_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, branch_id)
);

-- 4. Blog Posts table for Homepage & Content Editor
CREATE TABLE IF NOT EXISTS blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  author_name TEXT DEFAULT 'MedhaShiree Faculty',
  category TEXT DEFAULT 'Academic News',
  is_published BOOLEAN DEFAULT TRUE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Achievements table for Student Accolades & Results
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  year TEXT DEFAULT '2026',
  category TEXT DEFAULT 'Board Exam',
  student_name TEXT,
  result_details TEXT,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Ensure notices table has branch_id and notice_date
ALTER TABLE notices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE notices ADD COLUMN IF NOT EXISTS notice_date DATE DEFAULT CURRENT_DATE;

-- 7. Ensure batches, students, fee_dues, and exams have branch_id
ALTER TABLE batches ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE fee_dues ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- 8. Enable Row Level Security & Policies
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active branches" ON branches FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage branches" ON branches FOR ALL USING (
  EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid() AND role IN ('owner', 'super_manager', 'manager'))
);

CREATE POLICY "Public read published blogs" ON blogs FOR SELECT USING (is_published = true);
CREATE POLICY "Staff manage blogs" ON blogs FOR ALL USING (
  EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid() AND role IN ('owner', 'super_manager', 'manager'))
);

CREATE POLICY "Public read active achievements" ON achievements FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage achievements" ON achievements FOR ALL USING (
  EXISTS (SELECT 1 FROM staff WHERE auth_user_id = auth.uid() AND role IN ('owner', 'super_manager', 'manager'))
);

-- 9. Insert a default Main Branch if none exist
INSERT INTO branches (name, address, location, phone, email, is_active, established_year, branch_director, manager)
SELECT 'Rajshahi Main Branch', 'Rajshahi Sadar, Rajshahi', 'Rajshahi', '01302201431', 'info@medhashiree.com', true, '2018', 'Academic Director', 'Branch Manager'
WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1);

-- ==================== 019_performance_indexes_for_scale.sql ====================
-- ====================================================================
-- MIGRATION 019: High-Concurrency Performance Indexes for 100+ to 1,000+ Students
-- Ensures sub-10ms query execution across Exams, Results, Attendance, and Billing.
-- Run in Supabase SQL Editor -> Run
-- ====================================================================

-- 1. Students & Enrollments Scalability
CREATE INDEX IF NOT EXISTS idx_students_branch_active ON public.students(branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_students_search ON public.students(name, student_id, phone);
CREATE INDEX IF NOT EXISTS idx_enrollments_batch_status ON public.enrollments(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);

-- 2. Online Exams & High-Concurrency Submissions
CREATE INDEX IF NOT EXISTS idx_exams_batch_active ON public.exams(batch_id, is_online);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_sort ON public.exam_questions(exam_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam_score ON public.exam_submissions(exam_id, total_obtained DESC);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_student_exam ON public.exam_submissions(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers_submission_q ON public.exam_answers(submission_id, question_id);

-- 3. Fee Dues & Payments Speed
CREATE INDEX IF NOT EXISTS idx_fee_dues_student_status ON public.fee_dues(student_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_student_date ON public.payments(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON public.payments(branch_id);

-- 4. Attendance Queries
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON public.attendance(batch_id, date);

-- 5. SMS Queue Throughput
CREATE INDEX IF NOT EXISTS idx_sms_queue_status ON public.sms_queue(status, created_at DESC);

SELECT 'All high-concurrency performance indexes created successfully!' AS result;

-- ==================== 019_seed_default_notices.sql ====================
-- 019_seed_default_notices.sql
-- Seed default institutional notices into notices table if none exist

INSERT INTO public.notices (title, content, is_active, created_at, notice_date)
SELECT
  'ভর্তি বিজ্ঞপ্তি : ২০২৫-২৬ সেশনে ভর্তি কার্যক্রম চলমান রয়েছে।',
  'সকল শাখার সকল ব্যাচে নতুন সেশনের ক্লাস আগামী ১০ তারিখ হতে শুরু হবে। আসন সংখ্যা সীমিত বিধায় দ্রুত যোগাযোগ করুন।',
  true,
  NOW(),
  CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.notices LIMIT 1);

INSERT INTO public.notices (title, content, is_active, created_at, notice_date)
SELECT
  'এইচএসসি মডেল টেস্ট ২০২৬ এর সময়সূচি প্রকাশিত হয়েছে।',
  'আগামী রবিবার হতে পদার্থবিজ্ঞান ও রসায়ন মডেল টেস্টের চূড়ান্ত সময়সূচি অনুযায়ী পরীক্ষা গ্রহণ করা হবে।',
  true,
  NOW() - INTERVAL '2 days',
  CURRENT_DATE - INTERVAL '2 days'
WHERE (SELECT COUNT(*) FROM public.notices) = 1;

INSERT INTO public.notices (title, content, is_active, created_at, notice_date)
SELECT
  'অভিভাবক সমাবেশ ও ত্রৈমাসিক ফলাফল প্রকাশ সংক্রান্ত নোটিশ।',
  'সকল অভিভাবকবৃন্দকে আগামী শুক্রবারে কোচিং অডিটোরিয়ামে উপস্থিত থাকার জন্য বিনীত অনুরোধ করা হচ্ছে।',
  true,
  NOW() - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '5 days'
WHERE (SELECT COUNT(*) FROM public.notices) = 2;

-- Mark seeded in site_settings so automatic re-seeding does not occur if an admin deletes all notices
INSERT INTO public.site_settings (key, value)
VALUES ('notices_seeded', 'true')
ON CONFLICT (key) DO NOTHING;

-- ==================== 020_batch_branch_approval_and_multibatch_config.sql ====================
-- MIGRATION 020: Branch-Tied Batches, Cross-Branch Approval Workflow & Multi-Batch Exam Configuration
-- Safe & idempotent script for Supabase

-- 1. Enhance batches table with approval status and cross-branch tracking
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'
  CHECK (approval_status IN ('approved', 'pending_approval', 'rejected'));

ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS origin_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS origin_batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;

-- Default any existing batches to 'approved'
UPDATE public.batches SET approval_status = 'approved' WHERE approval_status IS NULL;

-- 2. Enhance exams table with multi-batch support (batch_ids)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- If an existing exam has a batch_id, populate batch_ids array with it
UPDATE public.exams 
SET batch_ids = json_build_array(batch_id)::jsonb 
WHERE batch_id IS NOT NULL AND (batch_ids IS NULL OR batch_ids = '[]'::jsonb);

-- 3. Ensure materials table has branch_id and batch_ids
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_batches_branch_approval ON public.batches(branch_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_batches_origin_batch ON public.batches(origin_batch_id);
CREATE INDEX IF NOT EXISTS idx_exams_branch ON public.exams(branch_id);
CREATE INDEX IF NOT EXISTS idx_materials_branch ON public.materials(branch_id);

-- ==================== 021_feedback_branch_id.sql ====================
-- MIGRATION 021: Harmonize columns across feedback, achievements, and blogs
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Ensure achievements columns are compatible with both naming conventions
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS exam_year TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS result_details TEXT;

-- Ensure blogs columns are compatible with both naming conventions
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS tags TEXT[];

-- ==================== 022_batch_classroom_and_branch_seats.sql ====================
-- MIGRATION 022: Batch Classroom Text Field & Branch Seats Tracking
-- Safe & idempotent script for Supabase

-- 1. Add free-text classroom column to batches
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS classroom TEXT DEFAULT '';

-- 2. Add branch_seats JSONB column to batches for multi-branch seat tracking
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS branch_seats JSONB DEFAULT '{}'::jsonb;

-- 3. Ensure payment_submissions has branch_id column
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Ensure enrollments has branch_id column
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_batches_classroom ON public.batches(classroom);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_branch ON public.payment_submissions(branch_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_branch ON public.enrollments(branch_id);

-- ==================== 023_ensure_staff_branch_ids.sql ====================
-- MIGRATION 023: Ensure staff branch_ids array and permissions
-- Idempotent script for Supabase SQL Editor

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS has_super_financial_access BOOLEAN DEFAULT FALSE;

-- Ensure owner has full access
UPDATE public.staff SET has_super_financial_access = TRUE WHERE role = 'owner';

-- Populate branch_ids from branch_id if branch_ids is empty
UPDATE public.staff 
SET branch_ids = ARRAY[branch_id] 
WHERE branch_id IS NOT NULL AND (branch_ids IS NULL OR branch_ids = '{}'::uuid[]);

-- Create junction table if missing
CREATE TABLE IF NOT EXISTS public.staff_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, branch_id)
);

-- ==================== 024_add_branch_director_role.sql ====================
-- Migration 024: Add branch_director role to staff table check constraint
-- A Branch Director acts like a branch owner within their assigned/permitted branches.

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check 
  CHECK (role IN ('owner', 'branch_director', 'super_manager', 'manager', 'receptionist', 'teacher', 'accountant', 'course_teacher'));

-- ==================== 024_batch_roll_numbers.sql ====================
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

-- ==================== 025_add_notices_branch_columns.sql ====================
-- MIGRATION 025: Ensure notices table has branch_id, branch_ids array, and foreign key
-- Run in Supabase SQL Editor if needed. Application code handles in-memory joins and resilient fallbacks.

-- 1. Ensure branch_id column exists with foreign key to branches(id)
ALTER TABLE notices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- 2. Add branch_ids UUID[] array column for multi-branch mark-selection
ALTER TABLE notices ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}'::uuid[];

-- 3. Ensure notice_date column exists
ALTER TABLE notices ADD COLUMN IF NOT EXISTS notice_date DATE DEFAULT CURRENT_DATE;

-- 4. Create indexes for efficient querying by branch and date
CREATE INDEX IF NOT EXISTS idx_notices_branch_id ON notices(branch_id);
CREATE INDEX IF NOT EXISTS idx_notices_is_active ON notices(is_active);
CREATE INDEX IF NOT EXISTS idx_notices_notice_date ON notices(notice_date DESC);

-- 5. Force PostgREST to reload schema cache so foreign keys and columns are immediately recognized
NOTIFY pgrst, 'reload schema';

-- ==================== 026_weekly_exams_and_public_results.sql ====================
-- MIGRATION 026: One-Time vs Weekly Exams, Recurring Days, Exam Pausing, and Public Online Results
-- Safe & idempotent script for Supabase

-- 1. Add exam_schedule_type column (default: 'one_time')
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_schedule_type TEXT DEFAULT 'one_time'
  CHECK (exam_schedule_type IN ('one_time', 'weekly'));

-- 2. Add recurring_days for weekly exams (e.g., ["Saturday", "Monday"])
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS recurring_days JSONB DEFAULT '[]'::jsonb;

-- 3. Add is_paused for pausing weekly exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;

-- 4. Add is_public_result to publish merit list to the public Online Result portal
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_public_result BOOLEAN DEFAULT FALSE;

-- 5. Add schedule_notice_id to link with notice board if routine is published to notices
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS schedule_notice_id UUID REFERENCES public.notices(id) ON DELETE SET NULL;

-- 6. Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_exams_schedule_type ON public.exams(exam_schedule_type);
CREATE INDEX IF NOT EXISTS idx_exams_is_public_result ON public.exams(is_public_result);
CREATE INDEX IF NOT EXISTS idx_exams_is_paused ON public.exams(is_paused);

-- 7. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- ==================== 027_weekly_day_marks_and_published_days.sql ====================
-- MIGRATION 027: Weekly Day Marks, Published Days & Weekly Consolidated Results
-- Safe & idempotent script for Supabase

-- 1. Add day_marks JSONB column to exam_results to store day-by-day marks
-- e.g. { "Saturday": { "marks": 45, "total": 50, "grade": "A+", "exam_name": "Math" } }
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS day_marks JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS result_note TEXT;

-- 2. Add published_days JSONB to exams to track which individual days are published to students
-- e.g. ["Saturday", "Monday"]
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS published_days JSONB DEFAULT '[]'::jsonb;

-- 3. Add is_weekly_published boolean to exams to track if consolidated weekly results are published
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_weekly_published BOOLEAN DEFAULT FALSE;

-- 4. Create index for published status
CREATE INDEX IF NOT EXISTS idx_exams_is_weekly_published ON public.exams(is_weekly_published);

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- ==================== 028_add_referral_to_payment_method_check.sql ====================
-- MIGRATION 028: Add 'referral' to payments table payment_method check constraint
-- Safe & idempotent script for Supabase

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('cash','bkash','nagad','rocket','upay','card','bank','online','offline','referral'));

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- ==================== 029_add_batch_ids_to_materials.sql ====================
-- ==============================================================================
-- Migration 029: Ensure batch_ids, description, and branch_id exist on materials table
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Add batch_ids column (stores JSON array of batch UUIDs for multi-batch assignment)
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;

-- 2. Add description column if missing
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Add branch_id column if missing
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 4. Add course_id column if missing (for linking study materials directly to online courses)
ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

-- 5. Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_materials_batch_ids ON public.materials USING gin (batch_ids);
CREATE INDEX IF NOT EXISTS idx_materials_course_id ON public.materials (course_id);

-- 6. Drop restrictive type check constraint so 'sheet', 'exam_paper', etc. are allowed
ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;

-- 7. Refresh PostgREST schema cache so the API recognizes the columns immediately
NOTIFY pgrst, 'reload schema';

-- ==================== 030_branch_deletion_schedule.sql ====================
-- Migration 030: 48-Hour Branch Deletion Timelock and Red Warning System
-- Adds columns to branches table for scheduling deletion with a 48-hour cooling period

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_pending_deletion BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Table for logging branch deletion audit history
CREATE TABLE IF NOT EXISTS public.branch_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT,
  scheduled_delete_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'timelock', -- 'timelock', 'cancelled', 'executed'
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branch_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access branch deletion requests" ON public.branch_deletion_requests;
CREATE POLICY "Public full access branch deletion requests"
  ON public.branch_deletion_requests
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- ==================== 031_resequence_duplicate_batch_rolls.sql ====================
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

-- ==================== 032_ensure_enrollments_branch_id.sql ====================
-- Migration 032: Ensure enrollments and slider_images have branch_id column
-- Safe and idempotent script for Supabase

-- 1. Enrollments branch_id
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_branch ON public.enrollments(branch_id);

-- 2. Slider Images branch_id
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_slider_images_branch ON public.slider_images(branch_id);


-- ==================== 033_material_issues_status_and_batch_id.sql ====================
-- ==============================================================================
-- Migration 033: Ensure status and batch_id exist on material_issues table
-- Run this in your Supabase Dashboard -> SQL Editor (or apply via migration tool)
-- ==============================================================================

-- 1. Add status column with default 'issued'
ALTER TABLE public.material_issues 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'issued';

-- 2. Add batch_id column referencing public.batches
ALTER TABLE public.material_issues 
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;

-- 3. Backfill any existing records where status is null:
UPDATE public.material_issues 
SET status = CASE 
  WHEN returned_at IS NOT NULL THEN 'returned' 
  ELSE 'issued' 
END 
WHERE status IS NULL;

-- 4. Indexes for fast status and batch queries
CREATE INDEX IF NOT EXISTS idx_material_issues_status ON public.material_issues (status);
CREATE INDEX IF NOT EXISTS idx_material_issues_batch_id ON public.material_issues (batch_id);

-- 5. Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';

-- ==================== 034_student_and_enrollment_qr_code.sql ====================
-- ==============================================================================
-- Migration 034: Add unique admission-time QR code to students and enrollments
-- Run this in your Supabase Dashboard -> SQL Editor (or apply via migration tool)
-- ==============================================================================

-- 1. Add qr_code column to students
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- 2. Add qr_code column to enrollments
ALTER TABLE public.enrollments 
  ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- 3. Backfill existing students where qr_code is NULL
UPDATE public.students s
SET qr_code = 'MSQR-' || 
  TO_CHAR(COALESCE(s.created_at, s.enrollment_date::timestamptz, NOW()), 'YYYYMMDD') || '-' || 
  LPAD(COALESCE(NULLIF(regexp_replace(s.student_id, '\D', '', 'g'), ''), '1'), 4, '0') || '-' || 
  UPPER(SUBSTRING(MD5(s.id::text || COALESCE(s.created_at::text, 'admission')) FROM 1 FOR 4))
WHERE s.qr_code IS NULL OR s.qr_code = '';

-- 4. Backfill existing enrollments where qr_code is NULL
UPDATE public.enrollments e
SET qr_code = 'MSQR-' || 
  TO_CHAR(COALESCE(e.created_at, NOW()), 'YYYYMMDD') || '-' || 
  LPAD(COALESCE(e.roll_no::text, '1'), 3, '0') || '-' || 
  UPPER(SUBSTRING(MD5(e.id::text || COALESCE(e.created_at::text, 'enrollment')) FROM 1 FOR 4))
FROM public.students s
WHERE e.student_id = s.id AND (e.qr_code IS NULL OR e.qr_code = '');

-- 5. Indexes for fast QR scanning lookup
CREATE INDEX IF NOT EXISTS idx_students_qr_code ON public.students (qr_code);
CREATE INDEX IF NOT EXISTS idx_enrollments_qr_code ON public.enrollments (qr_code);

-- 6. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

