-- Migration: Add super_manager and manager roles
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check 
  CHECK (role IN ('owner','super_manager','manager','receptionist','teacher','accountant','course_teacher'));
