CREATE TABLE IF NOT EXISTS subscription_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'pro', 'banned')),
  custom_limits JSONB,
  subscription_end_date DATETIME,
  payment_id TEXT,
  reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_created_at ON subscription_history (created_at); 