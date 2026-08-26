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
