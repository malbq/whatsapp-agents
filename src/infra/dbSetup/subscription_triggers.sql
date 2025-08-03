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