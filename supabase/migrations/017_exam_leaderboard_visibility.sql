-- MIGRATION 017: Exam Marks Visibility Control
-- Default is TRUE: All enrolled students can view everyone's marks & batch merit list
-- When FALSE: Each student can only view their own marks privately

ALTER TABLE exams ADD COLUMN IF NOT EXISTS show_all_results BOOLEAN DEFAULT TRUE;

-- Ensure any existing exams default to true
UPDATE exams SET show_all_results = TRUE WHERE show_all_results IS NULL;
