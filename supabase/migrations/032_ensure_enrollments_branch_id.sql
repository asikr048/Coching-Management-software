-- Migration 032: Ensure enrollments and slider_images have branch_id column
-- Safe and idempotent script for Supabase

-- 1. Enrollments branch_id
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_branch ON public.enrollments(branch_id);

-- 2. Slider Images branch_id
ALTER TABLE public.slider_images ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_slider_images_branch ON public.slider_images(branch_id);

