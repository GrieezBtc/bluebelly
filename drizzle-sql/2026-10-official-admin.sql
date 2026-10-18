-- 1) New columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_note text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by_id integer;

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS admin_note text;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- 2) After you have signed up the official account normally (username "bemblo") and verified its email,
--    run these two lines (change the username / your own email as needed):
-- UPDATE users SET is_official = true, verified = true WHERE username = 'bemblo';
-- UPDATE users SET is_admin = true WHERE email = 'muhammadjamiuyusuf876@gmail.com';
