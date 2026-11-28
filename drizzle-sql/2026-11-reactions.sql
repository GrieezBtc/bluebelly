-- Reactions on messages (any emoji) and on Moment comments (six fixed reactions). One reaction per person per item.
CREATE TABLE IF NOT EXISTS message_reactions (
  id serial PRIMARY KEY,
  message_id integer NOT NULL,
  user_id integer NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON message_reactions (message_id);

CREATE TABLE IF NOT EXISTS comment_reactions (
  id serial PRIMARY KEY,
  comment_id integer NOT NULL,
  user_id integer NOT NULL,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_reactions_unique UNIQUE (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS comment_reactions_comment_idx ON comment_reactions (comment_id);
