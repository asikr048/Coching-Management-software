-- ==============================================================================
-- PROTTASHA COACHING MANAGEMENT SOFTWARE - COMPLETE DATABASE SETUP
-- Safe, 100% Idempotent Script for Supabase SQL Editor
-- Handles existing tables, existing owner account, and partial migrations.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 10001;

-- ==============================================================================
-- 3. TABLES (CREATE IF NOT EXISTS)
-- ==============================================================================

-- 3.1 BRANCHES
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  location TEXT,
  description TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  branch_director TEXT,
  director_phone TEXT,
  manager TEXT,
  manager_phone TEXT,
  whatsapp TEXT,
  established_year TEXT DEFAULT '2018',
  contact_info JSONB DEFAULT '{}'::jsonb,
  sms_gateway_config JSONB DEFAULT '{}'::jsonb,
  is_pending_deletion BOOLEAN DEFAULT false,
  deletion_scheduled_at TIMESTAMPTZ,
  deletion_requested_at TIMESTAMPTZ,
  deletion_requested_by TEXT,
  deletion_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 STAFF
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_ids UUID[] DEFAULT '{}'::uuid[],
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'owner',
  salary NUMERIC(10,2) DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  subject TEXT,
  has_financial_access BOOLEAN DEFAULT FALSE,
  has_super_financial_access BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  joined_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 STAFF BRANCHES JUNCTION
CREATE TABLE IF NOT EXISTS public.staff_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, branch_id)
);

-- 3.4 STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  student_id TEXT UNIQUE NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  guardian_name TEXT,
  guardian_phone TEXT NOT NULL,
  guardian_relation TEXT DEFAULT 'Parent',
  date_of_birth DATE,
  gender TEXT,
  address TEXT,
  school_college TEXT,
  class_level TEXT,
  photo_url TEXT,
  biometric_template TEXT,
  biometric_enrolled BOOLEAN DEFAULT FALSE,
  referral_code TEXT UNIQUE,
  referred_by_code TEXT,
  referred_by_student_id UUID REFERENCES public.students(id),
  roll_no INTEGER,
  batch_roll INTEGER,
  qr_code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 ROOMS
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.6 BATCHES
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  subject TEXT,
  class_level TEXT,
  teacher_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  schedule TEXT,
  schedule_days TEXT DEFAULT '',
  schedule_time TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  max_seats INTEGER DEFAULT 30,
  current_seats INTEGER DEFAULT 0,
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  admission_fee NUMERIC(10,2) DEFAULT 0,
  fee_type TEXT DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  status TEXT DEFAULT 'ongoing',
  classroom TEXT DEFAULT '',
  branch_seats JSONB DEFAULT '{}'::jsonb,
  approval_status TEXT DEFAULT 'approved',
  origin_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  origin_batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.7 ENROLLMENTS
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  enrolled_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  roll_no INTEGER,
  qr_code TEXT,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, batch_id)
);

-- 3.8 FEE STRUCTURES
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  fee_type TEXT DEFAULT 'monthly',
  due_day INTEGER DEFAULT 10,
  late_fee NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.9 PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  late_fee NUMERIC(10,2) DEFAULT 0,
  total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  transaction_id TEXT,
  payment_for TEXT,
  payment_month TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  received_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  receipt_number TEXT DEFAULT '',
  referral_name TEXT,
  referral_reason TEXT,
  notes TEXT,
  is_refunded BOOLEAN DEFAULT FALSE,
  refund_amount NUMERIC(10,2),
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.10 PAYMENT ACCOUNTS
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.11 PAYMENT APPROVERS
CREATE TABLE IF NOT EXISTS public.payment_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  added_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id)
);

-- 3.12 PAYMENT SUBMISSIONS
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  course_id UUID,
  account_id UUID REFERENCES public.payment_accounts(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'offline',
  account_number TEXT DEFAULT '',
  trx_id TEXT DEFAULT '',
  transaction_id TEXT,
  sender_number TEXT DEFAULT '',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_fee NUMERIC(10,2) DEFAULT 0,
  due_amount NUMERIC(10,2) DEFAULT 0,
  due_date DATE,
  fee_type TEXT DEFAULT 'monthly',
  item_type TEXT DEFAULT 'batch',
  payment_month TEXT,
  referral_name TEXT,
  referral_reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.13 FEE DUES
CREATE TABLE IF NOT EXISTS public.fee_dues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  due_month TEXT NOT NULL,
  due_amount NUMERIC(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, batch_id, due_month)
);

-- 3.14 REFERRALS
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  commission_amount NUMERIC(10,2) DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 10,
  status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referee_id)
);

-- 3.15 ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'present',
  entry_method TEXT DEFAULT 'manual',
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  fee_alert_triggered BOOLEAN DEFAULT FALSE,
  note TEXT,
  marked_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  entered_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, batch_id, date)
);

-- 3.16 BIOMETRIC LOGS
CREATE TABLE IF NOT EXISTS public.biometric_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  scan_at TIMESTAMPTZ DEFAULT NOW(),
  recognized BOOLEAN DEFAULT FALSE,
  fee_alert BOOLEAN DEFAULT FALSE,
  entry_granted BOOLEAN DEFAULT TRUE,
  device_id TEXT,
  raw_data JSONB
);

-- 3.17 EXAMS
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  batch_ids JSONB DEFAULT '[]'::jsonb,
  title TEXT NOT NULL,
  exam_type TEXT DEFAULT 'written',
  subject TEXT,
  total_marks INTEGER DEFAULT 100,
  pass_marks INTEGER DEFAULT 33,
  exam_date DATE,
  duration_minutes INTEGER DEFAULT 60,
  instructions TEXT,
  answer_key_url TEXT,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  time_limit_minutes INTEGER,
  show_results_immediately BOOLEAN DEFAULT TRUE,
  result_note TEXT,
  exam_schedule_type TEXT DEFAULT 'one_time',
  recurring_days JSONB DEFAULT '[]'::jsonb,
  is_paused BOOLEAN DEFAULT FALSE,
  is_public_result BOOLEAN DEFAULT FALSE,
  schedule_notice_id UUID,
  published_days JSONB DEFAULT '[]'::jsonb,
  is_weekly_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.18 EXAM RESULTS
CREATE TABLE IF NOT EXISTS public.exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  obtained_marks NUMERIC(6,2),
  grade TEXT,
  rank INTEGER,
  entered_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  day_marks JSONB DEFAULT '{}'::jsonb,
  result_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

-- 3.19 EXAM QUESTIONS
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  marks INTEGER NOT NULL DEFAULT 1,
  hint_note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.20 EXAM SUBMISSIONS
CREATE TABLE IF NOT EXISTS public.exam_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  is_submitted BOOLEAN DEFAULT FALSE,
  total_obtained NUMERIC(6,2) DEFAULT 0,
  auto_graded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

-- 3.21 EXAM ANSWERS
CREATE TABLE IF NOT EXISTS public.exam_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.exam_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  is_correct BOOLEAN,
  obtained_marks NUMERIC(6,2) DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, question_id)
);

-- 3.22 MATERIALS
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'sheet',
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  batch_ids JSONB DEFAULT '[]'::jsonb,
  subject TEXT,
  total_stock INTEGER DEFAULT 0,
  available_stock INTEGER DEFAULT 0,
  price NUMERIC(8,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.23 MATERIAL ISSUES
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

-- 3.24 COURSES
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
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
  approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  total_sales INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.25 COURSE CONTENT
CREATE TABLE IF NOT EXISTS public.course_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT DEFAULT 'video',
  content_url TEXT,
  duration_minutes INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_preview BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.26 COURSE PURCHASES
CREATE TABLE IF NOT EXISTS public.course_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
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

-- 3.27 COURSE REVIEWS
CREATE TABLE IF NOT EXISTS public.course_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES course_purchases(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  rating INTEGER,
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.28 SMS QUEUE
CREATE TABLE IF NOT EXISTS public.sms_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.29 AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.30 EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  paid_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.31 NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  target_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  target_audience TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.32 SLIDER IMAGES
CREATE TABLE IF NOT EXISTS public.slider_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT DEFAULT '',
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.33 USER PROFILES
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  role TEXT DEFAULT 'student',
  auth_user_id UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.34 SITE SETTINGS
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.35 NOTICES
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_ids UUID[] DEFAULT '{}'::uuid[],
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  target_audience TEXT DEFAULT 'all',
  target_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  notice_date DATE DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.36 FEEDBACK
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  rating INTEGER,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.37 STUDENT DELETION REQUESTS
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.38 BRANCH DELETION REQUESTS
CREATE TABLE IF NOT EXISTS public.branch_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_by_name TEXT,
  scheduled_delete_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'timelock',
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.39 BLOGS
CREATE TABLE IF NOT EXISTS public.blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  author_name TEXT DEFAULT 'Faculty',
  category TEXT DEFAULT 'Academic News',
  is_published BOOLEAN DEFAULT TRUE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.40 ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  year TEXT DEFAULT '2026',
  category TEXT DEFAULT 'Board Exam',
  student_name TEXT,
  result_details TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==============================================================================
-- 4. EXHAUSTIVE COLUMN RETROFITTING
-- Guarantees every table has all required columns regardless of prior state
-- ==============================================================================

-- 4.1 branches columns
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_director TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS director_phone TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS manager_phone TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS established_year TEXT DEFAULT '2018';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS contact_info JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS sms_gateway_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_pending_deletion BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.2 staff columns
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS has_financial_access BOOLEAN DEFAULT FALSE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS has_super_financial_access BOOLEAN DEFAULT FALSE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS joined_at DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.3 students columns
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_id TEXT DEFAULT '';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS guardian_relation TEXT DEFAULT 'Parent';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_college TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_level TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS biometric_template TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS biometric_enrolled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS referred_by_student_id UUID REFERENCES public.students(id);
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS roll_no INTEGER;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS batch_roll INTEGER;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS enrollment_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.4 batches columns
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS class_level TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS room_id UUID;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS schedule TEXT;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS schedule_days TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS schedule_time TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS max_seats INTEGER DEFAULT 30;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS current_seats INTEGER DEFAULT 0;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS admission_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT 'monthly';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ongoing';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS classroom TEXT DEFAULT '';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS branch_seats JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS origin_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS origin_batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.5 enrollments columns
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS enrolled_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS roll_no INTEGER;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS enrollment_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.6 payments columns (CRITICAL: ensure paid_at exists on all existing tables)
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS late_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS total_paid NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_for TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_month TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_number TEXT DEFAULT '';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS referral_name TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS referral_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT FALSE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill paid_at and total_paid where null
UPDATE public.payments SET paid_at = COALESCE(paid_at, created_at, NOW()) WHERE paid_at IS NULL;
UPDATE public.payments SET total_paid = COALESCE(total_paid, amount, 0) WHERE total_paid IS NULL;

-- 4.7 payment_accounts columns
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'bkash';
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS account_number TEXT DEFAULT '';
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payment_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.8 payment_submissions columns
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS course_id UUID;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.payment_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'offline';
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS account_number TEXT DEFAULT '';
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS trx_id TEXT DEFAULT '';
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS sender_number TEXT DEFAULT '';
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS total_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS due_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT 'monthly';
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'batch';
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS payment_month TEXT;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS referral_name TEXT;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS referral_reason TEXT;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payment_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payment_submissions ALTER COLUMN batch_id DROP NOT NULL;

-- 4.9 fee_dues columns
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS due_month TEXT;
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS due_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.fee_dues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.10 referrals columns
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_id UUID;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referee_id UUID;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 10;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.11 attendance columns
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'present';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS entry_method TEXT DEFAULT 'manual';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS fee_alert_triggered BOOLEAN DEFAULT FALSE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS marked_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.12 exams columns
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_type TEXT DEFAULT 'written';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS total_marks INTEGER DEFAULT 100;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS pass_marks INTEGER DEFAULT 33;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_date DATE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS answer_key_url TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS show_results_immediately BOOLEAN DEFAULT TRUE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS result_note TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_schedule_type TEXT DEFAULT 'one_time';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS recurring_days JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_public_result BOOLEAN DEFAULT FALSE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS schedule_notice_id UUID REFERENCES public.notices(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS published_days JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_weekly_published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.13 exam_results columns
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS exam_id UUID;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS obtained_marks NUMERIC(6,2);
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS rank INTEGER;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS day_marks JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS result_note TEXT;
ALTER TABLE public.exam_results ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.14 materials columns
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'sheet';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS total_stock INTEGER DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS available_stock INTEGER DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS price NUMERIC(8,2) DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.15 material_issues columns
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS material_id UUID;
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS return_due_date DATE;
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS condition_on_return TEXT;
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.material_issues ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'issued';

-- 4.16 notices columns
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS branch_ids UUID[] DEFAULT '{}'::uuid[];
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS target_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS notice_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.17 feedback columns
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.18 courses columns
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS teacher_id UUID;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10,2);
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS discount_expires_at TIMESTAMPTZ;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS access_days INTEGER DEFAULT 365;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 30;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'beginner';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'Bengali';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4.19 notifications columns
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.20 user_profiles columns
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.21 sms_queue columns
ALTER TABLE public.sms_queue ADD COLUMN IF NOT EXISTS to_phone TEXT;
ALTER TABLE public.sms_queue ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.sms_queue ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
ALTER TABLE public.sms_queue ADD COLUMN IF NOT EXISTS student_id UUID;
ALTER TABLE public.sms_queue ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.sms_queue ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.sms_queue ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.sms_queue ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.22 expenses columns
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.23 slider_images columns
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS subtitle TEXT DEFAULT '';
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS link_url TEXT DEFAULT '';
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.24 blogs columns
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;
ALTER TABLE public.blogs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.25 achievements columns
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.26 feedback columns
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 5;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4.27 site_settings columns
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS value TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();



-- ==============================================================================
-- 5. SAFELY UPDATE CHECK CONSTRAINTS
-- ==============================================================================

-- 5.1 staff_role_check
ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff ADD CONSTRAINT staff_role_check 
  CHECK (role IN ('owner', 'branch_director', 'super_manager', 'manager', 'receptionist', 'teacher', 'accountant', 'course_teacher'));

-- 5.2 payments_payment_method_check
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('cash','bkash','nagad','rocket','upay','card','bank','online','offline','referral'));

-- 5.3 payment_submissions status check
ALTER TABLE public.payment_submissions DROP CONSTRAINT IF EXISTS payment_submissions_status_check;
ALTER TABLE public.payment_submissions ADD CONSTRAINT payment_submissions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- 5.4 batches status check
ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE public.batches ADD CONSTRAINT batches_status_check
  CHECK (status IN ('ongoing','upcoming','started','admission_closed','finished'));

-- 5.5 materials type check relax
DO $$
BEGIN
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;


-- ==============================================================================
-- 6. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_students_branch ON public.students(branch_id);
CREATE INDEX IF NOT EXISTS idx_students_referral_code ON public.students(referral_code);
CREATE INDEX IF NOT EXISTS idx_students_qr_code ON public.students(qr_code);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_batch ON public.enrollments(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_branch ON public.enrollments(branch_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_qr_code ON public.enrollments(qr_code);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON public.payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON public.attendance(batch_id, date);
CREATE INDEX IF NOT EXISTS idx_fee_dues_student ON public.fee_dues(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_dues_status ON public.fee_dues(status);
CREATE INDEX IF NOT EXISTS idx_fee_dues_branch ON public.fee_dues(branch_id);
CREATE INDEX IF NOT EXISTS idx_sms_queue_status ON public.sms_queue(status);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_exams_branch ON public.exams(branch_id);
CREATE INDEX IF NOT EXISTS idx_exams_schedule_type ON public.exams(exam_schedule_type);
CREATE INDEX IF NOT EXISTS idx_exams_is_public_result ON public.exams(is_public_result);
CREATE INDEX IF NOT EXISTS idx_exams_is_paused ON public.exams(is_paused);
CREATE INDEX IF NOT EXISTS idx_exams_is_weekly_published ON public.exams(is_weekly_published);
CREATE INDEX IF NOT EXISTS idx_materials_branch ON public.materials(branch_id);
CREATE INDEX IF NOT EXISTS idx_material_issues_status ON public.material_issues(status);
CREATE INDEX IF NOT EXISTS idx_material_issues_batch_id ON public.material_issues(batch_id);
CREATE INDEX IF NOT EXISTS idx_notices_branch_id ON public.notices(branch_id);
CREATE INDEX IF NOT EXISTS idx_notices_is_active ON public.notices(is_active);
CREATE INDEX IF NOT EXISTS idx_notices_notice_date ON public.notices(notice_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_branch ON public.payment_submissions(branch_id);


-- ==============================================================================
-- 7. TRIGGERS & FUNCTIONS
-- ==============================================================================

-- 7.1 update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_students_updated_at ON public.students;
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_batches_updated_at ON public.batches;
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_updated_at ON public.staff;
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_courses_updated_at ON public.courses;
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7.2 generate_student_id
CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS TRIGGER AS $$
DECLARE
  year TEXT := TO_CHAR(NOW(), 'YYYY');
  seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 9) AS INTEGER)), 0) + 1 
  INTO seq 
  FROM public.students 
  WHERE student_id LIKE 'EDU-' || year || '-%';

  NEW.student_id := 'EDU-' || year || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_student_id ON public.students;
CREATE TRIGGER set_student_id 
  BEFORE INSERT ON public.students 
  FOR EACH ROW 
  WHEN (NEW.student_id IS NULL OR NEW.student_id = '') 
  EXECUTE FUNCTION public.generate_student_id();

-- 7.3 generate_referral_code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_referral_code ON public.students;
CREATE TRIGGER set_referral_code 
  BEFORE INSERT ON public.students 
  FOR EACH ROW 
  EXECUTE FUNCTION public.generate_referral_code();

-- 7.4 generate_receipt_number
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
  year TEXT := TO_CHAR(NOW(), 'YYYY');
  seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 10) AS INTEGER)), 0) + 1 
  INTO seq 
  FROM public.payments 
  WHERE receipt_number LIKE 'RCP-' || year || '-%';

  NEW.receipt_number := 'RCP-' || year || '-' || LPAD(seq::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_receipt_number ON public.payments;
CREATE TRIGGER set_receipt_number 
  BEFORE INSERT ON public.payments 
  FOR EACH ROW 
  WHEN (NEW.receipt_number IS NULL OR NEW.receipt_number = '') 
  EXECUTE FUNCTION public.generate_receipt_number();

-- 7.5 update_batch_seats
CREATE OR REPLACE FUNCTION public.update_batch_seats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE public.batches SET current_seats = current_seats + 1 WHERE id = NEW.batch_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE public.batches SET current_seats = GREATEST(current_seats - 1, 0) WHERE id = NEW.batch_id;
    ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE public.batches SET current_seats = current_seats + 1 WHERE id = NEW.batch_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_seats_on_enrollment ON public.enrollments;
CREATE TRIGGER update_seats_on_enrollment 
  AFTER INSERT OR UPDATE ON public.enrollments 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_batch_seats();

-- 7.6 update_course_sales
CREATE OR REPLACE FUNCTION public.update_course_sales()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.courses SET total_sales = total_sales + 1 WHERE id = NEW.course_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS increment_course_sales ON public.course_purchases;
CREATE TRIGGER increment_course_sales 
  AFTER INSERT ON public.course_purchases 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_course_sales();

-- 7.7 auto_assign_batch_roll_no
CREATE OR REPLACE FUNCTION public.auto_assign_batch_roll_no()
RETURNS TRIGGER AS $$
DECLARE
  next_roll INTEGER;
  existing_count INTEGER;
BEGIN
  IF NEW.roll_no IS NOT NULL AND NEW.roll_no > 0 THEN
    SELECT COUNT(*) INTO existing_count
    FROM public.enrollments
    WHERE batch_id = NEW.batch_id AND roll_no = NEW.roll_no AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF existing_count > 0 THEN
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

DROP TRIGGER IF EXISTS auto_assign_roll_trigger ON public.enrollments;
CREATE TRIGGER auto_assign_roll_trigger
  BEFORE INSERT OR UPDATE OF roll_no ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_batch_roll_no();


-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slider_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Idempotent Permissive Policies for Web Application Operations
DROP POLICY IF EXISTS "Public full access branches" ON public.branches;
CREATE POLICY "Public full access branches" ON public.branches FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access staff" ON public.staff;
CREATE POLICY "Public full access staff" ON public.staff FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access staff_branches" ON public.staff_branches;
CREATE POLICY "Public full access staff_branches" ON public.staff_branches FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access students" ON public.students;
CREATE POLICY "Public full access students" ON public.students FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access rooms" ON public.rooms;
CREATE POLICY "Public full access rooms" ON public.rooms FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access batches" ON public.batches;
CREATE POLICY "Public full access batches" ON public.batches FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access enrollments" ON public.enrollments;
CREATE POLICY "Public full access enrollments" ON public.enrollments FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access fee_structures" ON public.fee_structures;
CREATE POLICY "Public full access fee_structures" ON public.fee_structures FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access payments" ON public.payments;
CREATE POLICY "Public full access payments" ON public.payments FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access payment_accounts" ON public.payment_accounts;
CREATE POLICY "Public full access payment_accounts" ON public.payment_accounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access payment_approvers" ON public.payment_approvers;
CREATE POLICY "Public full access payment_approvers" ON public.payment_approvers FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access payment_submissions" ON public.payment_submissions;
CREATE POLICY "Public full access payment_submissions" ON public.payment_submissions FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access fee_dues" ON public.fee_dues;
CREATE POLICY "Public full access fee_dues" ON public.fee_dues FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access referrals" ON public.referrals;
CREATE POLICY "Public full access referrals" ON public.referrals FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access attendance" ON public.attendance;
CREATE POLICY "Public full access attendance" ON public.attendance FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access biometric_logs" ON public.biometric_logs;
CREATE POLICY "Public full access biometric_logs" ON public.biometric_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access exams" ON public.exams;
CREATE POLICY "Public full access exams" ON public.exams FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access exam_results" ON public.exam_results;
CREATE POLICY "Public full access exam_results" ON public.exam_results FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access exam_questions" ON public.exam_questions;
CREATE POLICY "Public full access exam_questions" ON public.exam_questions FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access exam_submissions" ON public.exam_submissions;
CREATE POLICY "Public full access exam_submissions" ON public.exam_submissions FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access exam_answers" ON public.exam_answers;
CREATE POLICY "Public full access exam_answers" ON public.exam_answers FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access materials" ON public.materials;
CREATE POLICY "Public full access materials" ON public.materials FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access material_issues" ON public.material_issues;
CREATE POLICY "Public full access material_issues" ON public.material_issues FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access courses" ON public.courses;
CREATE POLICY "Public full access courses" ON public.courses FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access course_content" ON public.course_content;
CREATE POLICY "Public full access course_content" ON public.course_content FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access course_purchases" ON public.course_purchases;
CREATE POLICY "Public full access course_purchases" ON public.course_purchases FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access course_reviews" ON public.course_reviews;
CREATE POLICY "Public full access course_reviews" ON public.course_reviews FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access sms_queue" ON public.sms_queue;
CREATE POLICY "Public full access sms_queue" ON public.sms_queue FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access audit_logs" ON public.audit_logs;
CREATE POLICY "Public full access audit_logs" ON public.audit_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access expenses" ON public.expenses;
CREATE POLICY "Public full access expenses" ON public.expenses FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access notifications" ON public.notifications;
CREATE POLICY "Public full access notifications" ON public.notifications FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access slider_images" ON public.slider_images;
CREATE POLICY "Public full access slider_images" ON public.slider_images FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access user_profiles" ON public.user_profiles;
CREATE POLICY "Public full access user_profiles" ON public.user_profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access site_settings" ON public.site_settings;
CREATE POLICY "Public full access site_settings" ON public.site_settings FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access notices" ON public.notices;
CREATE POLICY "Public full access notices" ON public.notices FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access feedback" ON public.feedback;
CREATE POLICY "Public full access feedback" ON public.feedback FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access student_deletion_requests" ON public.student_deletion_requests;
CREATE POLICY "Public full access student_deletion_requests" ON public.student_deletion_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access branch_deletion_requests" ON public.branch_deletion_requests;
CREATE POLICY "Public full access branch_deletion_requests" ON public.branch_deletion_requests FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access blogs" ON public.blogs;
CREATE POLICY "Public full access blogs" ON public.blogs FOR ALL USING (true);

DROP POLICY IF EXISTS "Public full access achievements" ON public.achievements;
CREATE POLICY "Public full access achievements" ON public.achievements FOR ALL USING (true);


-- ==============================================================================
-- 9. DATA BACKFILLS & CLEANUP
-- ==============================================================================

-- 9.1 Backfill students qr_code
UPDATE public.students s
SET qr_code = 'MSQR-' || 
  TO_CHAR(COALESCE(s.created_at, s.enrollment_date::timestamptz, NOW()), 'YYYYMMDD') || '-' || 
  LPAD(COALESCE(NULLIF(regexp_replace(s.student_id, '\D', '', 'g'), ''), '1'), 4, '0') || '-' || 
  UPPER(SUBSTRING(MD5(s.id::text || COALESCE(s.created_at::text, 'admission')) FROM 1 FOR 4))
WHERE s.qr_code IS NULL OR s.qr_code = '';

-- 9.2 Backfill enrollments qr_code
UPDATE public.enrollments e
SET qr_code = 'MSQR-' || 
  TO_CHAR(COALESCE(e.created_at, NOW()), 'YYYYMMDD') || '-' || 
  LPAD(COALESCE(e.roll_no::text, '1'), 3, '0') || '-' || 
  UPPER(SUBSTRING(MD5(e.id::text || COALESCE(e.created_at::text, 'enrollment')) FROM 1 FOR 4))
FROM public.students s
WHERE e.student_id = s.id AND (e.qr_code IS NULL OR e.qr_code = '');

-- 9.3 Ensure sequential roll numbers for enrollments
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

-- 9.4 Sync roll numbers to students
UPDATE public.students s
SET roll_no = e.roll_no,
    batch_roll = e.roll_no
FROM public.enrollments e
WHERE e.student_id = s.id 
  AND e.status = 'active'
  AND (s.roll_no IS NULL OR s.roll_no <> e.roll_no OR s.batch_roll IS NULL OR s.batch_roll <> e.roll_no);

-- 9.5 Populate default site settings if not present
INSERT INTO public.site_settings (key, value) VALUES
  ('contact_link', 'https://wa.me/8801302201431'),
  ('contact_label', 'WhatsApp Us'),
  ('institute_name', 'Prottasha Coaching Academy'),
  ('institute_name_bn', 'প্রত্যাশা কোচিং একাডেমি'),
  ('theme_color', 'emerald')
ON CONFLICT (key) DO NOTHING;


-- ==============================================================================
-- 10. DEFAULT BRANCH & SAFE OWNER ACCOUNT LINKING
-- ==============================================================================
DO $$
DECLARE
  v_branch_id UUID;
  v_owner_auth_id UUID;
  v_owner_email TEXT;
BEGIN
  -- 10.1 Ensure at least one Branch exists
  INSERT INTO public.branches (name, address, location, phone, email, is_active, established_year)
  SELECT 'Main Campus', 'Main Road, Campus Area', 'Main Campus', '+880 1700-000000', 'info@prottashacoaching.com', true, '2024'
  WHERE NOT EXISTS (SELECT 1 FROM public.branches LIMIT 1);

  SELECT id INTO v_branch_id FROM public.branches LIMIT 1;

  -- 10.2 Ensure any existing staff with role 'owner' has full permissions
  UPDATE public.staff 
  SET has_super_financial_access = TRUE,
      has_financial_access = TRUE,
      is_active = TRUE
  WHERE role = 'owner';

  -- 10.3 If no staff record has role 'owner', find the existing auth user and link them as owner
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE role = 'owner') THEN
    SELECT id, email INTO v_owner_auth_id, v_owner_email
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_owner_auth_id IS NOT NULL THEN
      INSERT INTO public.staff (
        auth_user_id,
        name,
        email,
        role,
        branch_id,
        has_financial_access,
        has_super_financial_access,
        is_active
      )
      VALUES (
        v_owner_auth_id,
        COALESCE(v_owner_email, 'Super Admin'),
        COALESCE(v_owner_email, 'owner@prottashacoaching.com'),
        'owner',
        v_branch_id,
        TRUE,
        TRUE,
        TRUE
      )
      ON CONFLICT (email) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        role = 'owner',
        has_financial_access = TRUE,
        has_super_financial_access = TRUE,
        is_active = TRUE;

      RAISE NOTICE 'SUCCESS: Existing Supabase Auth user % has been linked as the Owner staff member.', v_owner_email;
    ELSE
      RAISE NOTICE 'INFO: No user found in auth.users yet. Create an account in Supabase Auth and it will be linked or update staff manually.';
    END IF;
  ELSE
    RAISE NOTICE 'SUCCESS: Owner staff member verified with super admin permissions.';
  END IF;
END $$;

-- ==============================================================================
-- 11. RELOAD POSTGREST SCHEMA CACHE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

SELECT 'Database setup completed successfully! All tables, columns, indexes, policies, and permissions are up to date.' AS result;
