-- MIGRATION 021: Harmonize columns across feedback, achievements, and blogs
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

-- Ensure achievements columns are compatible with both naming conventions
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS exam_year TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS result_details TEXT;

-- Ensure blogs columns are compatible with both naming conventions
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS tags TEXT[];
