-- Base user seed for agent tests
-- Creates a user with consent, plan, and entitlements ready for agent interactions

-- Create the 'basic' plan (all features enabled)
INSERT INTO "plan" ("id", "active", "metadata", "createdAt") 
VALUES ('basic', true, '{"displayName": "Basic"}', NOW());

-- Create plan entitlements for basic plan
INSERT INTO "plan_entitlement" ("planId", "key", "value") VALUES
  ('basic', 'b_enable_profile_tool', 'true'),
  ('basic', 'b_enable_file_retrieval', 'true'),
  ('basic', 'b_enable_web_fetch_tool', 'true'),
  ('basic', 'b_enable_memory_tool', 'true'),
  ('basic', 'b_enable_web_search_tool', 'true'),
  ('basic', 'b_enable_google_places_tool', 'true'),
  ('basic', 'n_messages_per_day', '2000'),
  ('basic', 'n_storage_size', '104857600'),
  ('basic', 'n_web_search_calls_per_day', '50'),
  ('basic', 'n_google_places_calls_per_day', '50');

-- Create user
INSERT INTO "user" ("id", "waId", "name", "joinedAt") 
VALUES ('user_test_1', '1234567890', 'Test User', NOW());

-- Create user consent (using userId instead of waId)
INSERT INTO "user_consent" ("userId", "consentedAt")
VALUES ('user_test_1', NOW());

-- Assign user to plan
INSERT INTO "user_plan" ("userId", "planId")
VALUES ('user_test_1', 'basic');