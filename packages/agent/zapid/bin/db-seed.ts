import { SQL } from 'bun'

const seedSQL = `DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM plan WHERE id IN ('free', 'basic', 'pro')) THEN
    RETURN;
  END IF;

  INSERT INTO plan (id, active, metadata, "createdAt")
  VALUES
    ('free', true, '{"displayName": "Free", "description": "Basic plan with limited features"}', NOW()),
    ('basic', true, '{"displayName": "Basic", "description": "Standard plan with essential features"}', NOW()),
    ('pro', true, '{"displayName": "Pro", "description": "Professional plan with all features"}', NOW());

  INSERT INTO plan_entitlement ("planId", key, value)
  SELECT 'free', entitlements.key, entitlements.value FROM (VALUES
    ('b_enable_profile_tool', 'true'),
    ('b_enable_file_retrieval', 'true'),
    ('b_enable_web_fetch_tool', 'true'),
    ('b_enable_memory_tool', 'true'),
    ('b_enable_web_search_tool', 'true'),
    ('b_enable_google_places_tool', 'true'),
    ('n_messages_per_day', '20'),
    ('n_storage_size', '10485760'),
    ('n_web_search_calls_per_day', '20'),
    ('n_google_places_calls_per_day', '20')
  ) AS entitlements(key, value);

  INSERT INTO plan_entitlement ("planId", key, value)
  SELECT 'basic', entitlements.key, entitlements.value FROM (VALUES
    ('b_enable_profile_tool', 'true'),
    ('b_enable_file_retrieval', 'true'),
    ('b_enable_web_fetch_tool', 'true'),
    ('b_enable_memory_tool', 'true'),
    ('b_enable_web_search_tool', 'true'),
    ('b_enable_google_places_tool', 'true'),
    ('n_messages_per_day', '1000'),
    ('n_storage_size', '104857600'),
    ('n_web_search_calls_per_day', '100'),
    ('n_google_places_calls_per_day', '100')
  ) AS entitlements(key, value);

  INSERT INTO plan_entitlement ("planId", key, value)
  SELECT 'pro', entitlements.key, entitlements.value FROM (VALUES
    ('b_enable_profile_tool', 'true'),
    ('b_enable_file_retrieval', 'true'),
    ('b_enable_web_fetch_tool', 'true'),
    ('b_enable_memory_tool', 'true'),
    ('b_enable_web_search_tool', 'true'),
    ('b_enable_google_places_tool', 'true'),
    ('n_messages_per_day', NULL),
    ('n_storage_size', NULL),
    ('n_web_search_calls_per_day', NULL),
    ('n_google_places_calls_per_day', NULL)
  ) AS entitlements(key, value);
END $$;`

const client = new SQL(process.env.DATABASE_URL!)

await client.unsafe(seedSQL)

console.log('Seed script executed successfully.')

await client.close()
