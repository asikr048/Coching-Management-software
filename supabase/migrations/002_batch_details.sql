-- Add schedule and description fields to batches
ALTER TABLE batches ADD COLUMN IF NOT EXISTS schedule_days TEXT DEFAULT '';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS schedule_time TEXT DEFAULT '';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
