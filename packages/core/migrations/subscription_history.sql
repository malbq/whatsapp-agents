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

CREATE TRIGGER IF NOT EXISTS trg_subscription_history_insert
AFTER INSERT ON subscription_history
FOR EACH ROW
BEGIN
  DELETE FROM current_subscription WHERE user_id = NEW.user_id;
  INSERT INTO current_subscription (
    user_id, id, status, custom_limits, subscription_end_date, payment_id, reason, created_at
  ) VALUES (
    NEW.user_id, NEW.id, NEW.status, NEW.custom_limits, NEW.subscription_end_date, NEW.payment_id, NEW.reason, NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_subscription_history_delete
AFTER DELETE ON subscription_history
FOR EACH ROW
WHEN OLD.id = (SELECT id FROM current_subscription WHERE user_id = OLD.user_id)
BEGIN
  DELETE FROM current_subscription WHERE user_id = OLD.user_id;
  INSERT INTO current_subscription
  SELECT user_id, id, status, custom_limits, subscription_end_date, payment_id, reason, created_at
  FROM subscription_history
  WHERE user_id = OLD.user_id
  ORDER BY created_at DESC
  LIMIT 1;
END; 