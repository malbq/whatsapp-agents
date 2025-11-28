-- Plan Catalogue Seed Script
-- Run this script to seed the plan catalogue in dev or prod databases.
-- Idempotent: does nothing if plans already exist.
-- Usage: psql $DATABASE_URL -f scripts/seedPlans.sql

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM plan WHERE key IN ('free', 'basic', 'pro')) THEN
    RAISE NOTICE 'Plans already exist, skipping seed.';
    RETURN;
  END IF;

  INSERT INTO plan (id, active, metadata, "createdAt")
  VALUES
    ('free', true, '{"displayName": "Free", "description": "Basic plan with limited features"}', NOW()),
    ('basic', true, '{"displayName": "Basic", "description": "Standard plan with essential features"}', NOW()),
    ('pro', true, '{"displayName": "Pro", "description": "Professional plan with all features"}', NOW());

  INSERT INTO plan_entitlement ("planId", key, value)
  SELECT 'free', entitlements.key, entitlements.value FROM plan, (VALUES
    ('b_enable_profile_tool', 'true'),
    ('b_enable_file_retrieval', 'false'),
    ('b_enable_web_fetch_tool', 'true'),
    ('b_enable_memory_tool', 'false'),
    ('b_enable_web_search_tool', 'false'),
    ('b_enable_google_places_tool', 'false'),
    ('n_messages_per_day', '20'),
    ('n_storage_size', '104857600'), -- 10MB
    ('n_web_search_calls_per_day', '0'),
    ('n_google_places_calls_per_day', '0')
  ) AS entitlements(key, value);

  INSERT INTO plan_entitlement ("planId", key, value)
  SELECT 'basic', entitlements.key, entitlements.value FROM plan, (VALUES
    ('b_enable_profile_tool', 'true'),
    ('b_enable_file_retrieval', 'true'),
    ('b_enable_web_fetch_tool', 'true'),
    ('b_enable_memory_tool', 'true'),
    ('b_enable_web_search_tool', 'true'),
    ('b_enable_google_places_tool', 'true'),
    ('n_messages_per_day', '2000'),
    ('n_storage_size', '104857600'), -- 100MB
    ('n_web_search_calls_per_day', '50'),
    ('n_google_places_calls_per_day', '50')
  ) AS entitlements(key, value);

  INSERT INTO plan_entitlement ("planId", key, value)
  SELECT 'pro', entitlements.key, entitlements.value FROM plan, (VALUES
    ('b_enable_profile_tool', 'true'),
    ('b_enable_file_retrieval', 'true'),
    ('b_enable_web_fetch_tool', 'true'),
    ('b_enable_memory_tool', 'true'),
    ('b_enable_web_search_tool', 'true'),
    ('b_enable_google_places_tool', 'true'),
    ('n_messages_per_day', NULL),
    ('n_storage_size', '1073741824'), -- 1GB
    ('n_web_search_calls_per_day', NULL),
    ('n_google_places_calls_per_day', NULL)
  ) AS entitlements(key, value);

  RAISE NOTICE 'Plan catalogue seeded successfully.';
END $$;
