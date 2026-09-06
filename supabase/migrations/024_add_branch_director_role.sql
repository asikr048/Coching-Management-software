-- Migration 024: Add branch_director role to staff table check constraint
-- A Branch Director acts like a branch owner within their assigned/permitted branches.

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check 
  CHECK (role IN ('owner', 'branch_director', 'super_manager', 'manager', 'receptionist', 'teacher', 'accountant', 'course_teacher'));
