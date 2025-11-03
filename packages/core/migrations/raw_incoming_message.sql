CREATE TABLE IF NOT EXISTS raw_incoming_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload JSONB NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_incoming_external_id ON raw_incoming_message(external_id); 