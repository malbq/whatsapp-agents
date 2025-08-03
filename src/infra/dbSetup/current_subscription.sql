CREATE TABLE IF NOT EXISTS current_subscription (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('free', 'pro', 'banned')),
  custom_limits JSONB,
  subscription_end_date DATETIME,
  payment_id TEXT,
  reason TEXT,
  created_at DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_current_subscription_user_id ON current_subscription (user_id); 