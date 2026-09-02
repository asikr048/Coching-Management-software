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
