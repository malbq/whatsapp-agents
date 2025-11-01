DROP VIEW IF EXISTS usage_summary;
CREATE VIEW usage_summary AS
SELECT 
  user_id,
  DATE(message.timestamp) as date,
  type,
  COUNT(1) as usage_count,
  SUM(amount) as total_amount,
  CASE type
    WHEN 'text_generation' THEN 'tokens'
    WHEN 'audio_transcription' THEN 'tokens'
    WHEN 'image_analysis' THEN 'tokens'
    WHEN 'document_transcription' THEN 'tokens'
    WHEN 'media_storage' THEN 'bytes'
    ELSE NULL
  END as unit
FROM usage_log
JOIN message ON usage_log.message_id = message.id
GROUP BY user_id, DATE(timestamp), type; 