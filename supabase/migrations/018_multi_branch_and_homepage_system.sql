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
