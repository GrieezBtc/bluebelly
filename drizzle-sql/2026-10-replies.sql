ALTER TABLE moment_comments ADD COLUMN IF NOT EXISTS parent_comment_id integer;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id integer;
