-- Run once in the Neon SQL editor. Adds short share codes for /moment/p/<code> links.
ALTER TABLE moments ADD COLUMN IF NOT EXISTS share_code text;
CREATE UNIQUE INDEX IF NOT EXISTS moments_share_code_unique ON moments (share_code);

-- Give every existing Moment a unique 6-character code.
DO $$
DECLARE
  r record;
  c text;
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
BEGIN
  FOR r IN SELECT id FROM moments WHERE share_code IS NULL LOOP
    LOOP
      c := (SELECT string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
            FROM generate_series(1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM moments WHERE share_code = c);
    END LOOP;
    UPDATE moments SET share_code = c WHERE id = r.id;
  END LOOP;
END $$;
