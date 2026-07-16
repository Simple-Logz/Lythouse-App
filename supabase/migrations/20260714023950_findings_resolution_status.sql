ALTER TABLE findings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS resolution_note text;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
