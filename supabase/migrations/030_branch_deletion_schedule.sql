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
