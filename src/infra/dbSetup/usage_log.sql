CREATE TABLE IF NOT EXISTS usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES message(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'text_generation',
    'audio_transcription',
    'image_analysis',
    'document_transcription',
    'media_storage'
  )),
  amount INTEGER NOT NULL,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_usage_log_user_id ON usage_log (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_message_id ON usage_log (message_id);