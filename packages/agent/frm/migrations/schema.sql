CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  type TEXT NOT NULL,
  media_storage_key TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_user_id ON message (user_id);

CREATE TABLE IF NOT EXISTS embedding (
  message_id TEXT NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  content TEXT NOT NULL,
  vector FLOAT32(384) NOT NULL,
  PRIMARY KEY (message_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_embedding_message_id ON embedding (message_id);
