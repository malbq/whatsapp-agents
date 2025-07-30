CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY,
  external_id TEXT UNIQUE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  type TEXT NOT NULL,
  media_storage_key TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_user_id ON message (user_id);