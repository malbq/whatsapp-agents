CREATE TABLE IF NOT EXISTS user_profile_version (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile TEXT NOT NULL,
  message_id TEXT,
  FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES message (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profile_version_user_id ON user_profile_version (user_id);