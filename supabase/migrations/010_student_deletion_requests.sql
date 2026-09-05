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
