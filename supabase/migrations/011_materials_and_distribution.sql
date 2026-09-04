-- Migration 011: Materials & Distribution Schema
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'sheet',
  batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  subject TEXT,
  total_stock INTEGER DEFAULT 0,
  available_stock INTEGER DEFAULT 0,
  price NUMERIC(8,2) DEFAULT 0,
  description TEXT,
  batch_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS batch_ids JSONB DEFAULT '[]'::jsonb;

-- Drop old check constraint if it exists to allow sheet, notes, book, etc.
DO $$$
BEGIN
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_type_check;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$$;

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

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access materials" ON public.materials;
CREATE POLICY "Public full access materials" ON public.materials FOR ALL USING (true);

ALTER TABLE public.material_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access material_issues" ON public.material_issues;
CREATE POLICY "Public full access material_issues" ON public.material_issues FOR ALL USING (true);
