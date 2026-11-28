-- Editing Moments and comments after publishing.
ALTER TABLE moments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE moment_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
