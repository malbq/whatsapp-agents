CREATE TABLE IF NOT EXISTS reminder (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('scheduled', 'sending', 'sent', 'cancelled', 'failed')),
  due_at DATETIME NOT NULL,
  description TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  wa_message_id TEXT,
  error TEXT,
  recurrence_cron TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS idx_reminder_due_status ON reminder (status, due_at);
CREATE INDEX IF NOT EXISTS idx_reminder_user ON reminder (user_id, status);
