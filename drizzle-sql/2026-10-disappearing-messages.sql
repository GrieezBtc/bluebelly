-- Disappearing messages become a per-conversation setting.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS disappear_after_sec integer;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ttl_sec integer;

-- Keep today's behaviour for everything that already exists:
-- 1:1 chats = 24h after viewing, groups = 7 days after sending.
UPDATE conversations
SET disappear_after_sec = CASE WHEN kind = 'group' THEN 604800 ELSE 86400 END
WHERE disappear_after_sec IS NULL;

UPDATE messages m
SET ttl_sec = CASE WHEN c.kind = 'group' THEN 604800 ELSE 86400 END
FROM conversations c
WHERE c.id = m.conversation_id AND m.is_system = false AND m.ttl_sec IS NULL;
