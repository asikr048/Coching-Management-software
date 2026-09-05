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
