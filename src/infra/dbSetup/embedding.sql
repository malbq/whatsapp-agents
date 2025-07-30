CREATE TABLE IF NOT EXISTS embedding (
  message_id TEXT NOT NULL REFERENCES message(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding FLOAT32(384) NOT NULL,
  PRIMARY KEY (message_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_embedding_message_id ON embedding (message_id); 