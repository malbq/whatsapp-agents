CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"waId" text,
	"type" text NOT NULL,
	"role" text NOT NULL,
	"messages" json NOT NULL,
	"resourceId" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "plan_entitlement" (
	"planId" text NOT NULL,
	"key" text NOT NULL,
	"value" text,
	CONSTRAINT "plan_entitlement_planId_key_pk" PRIMARY KEY("planId","key")
);
--> statement-breakpoint
CREATE TABLE "raw_incoming_message" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"payload" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"status" text NOT NULL,
	"dueAt" timestamp NOT NULL,
	"description" text NOT NULL,
	"message" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"sentAt" timestamp,
	"waMessageId" text,
	"error" text,
	"recurrenceCron" text
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"storageKey" text NOT NULL,
	"size" bigint,
	"mimeType" text,
	"hash" text NOT NULL,
	"originalFilename" text,
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	CONSTRAINT "resource_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "snippet" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"sequence" integer NOT NULL,
	"content" text NOT NULL,
	"vector" vector(768) NOT NULL,
	"fts" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "snippet"."content")) STORED NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"source" text NOT NULL,
	"modelMessageIndex" integer,
	"inputTokens" integer NOT NULL,
	"outputTokens" integer NOT NULL,
	"totalTokens" integer NOT NULL,
	"cachedInputTokens" integer,
	"reasoningTokens" integer
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"waId" text NOT NULL,
	"name" text NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_waId_unique" UNIQUE("waId")
);
--> statement-breakpoint
CREATE TABLE "user_entitlement_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"value" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "user_entitlement_override" (
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"notes" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_entitlement_override_userId_key_pk" PRIMARY KEY("userId","key")
);
--> statement-breakpoint
CREATE TABLE "user_profile_version" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"profile" text NOT NULL,
	"messageId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"planId" text NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_resourceId_resource_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_entitlement" ADD CONSTRAINT "plan_entitlement_planId_plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet" ADD CONSTRAINT "snippet_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlement_ledger" ADD CONSTRAINT "user_entitlement_ledger_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlement_override" ADD CONSTRAINT "user_entitlement_override_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscription" ADD CONSTRAINT "user_subscription_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscription" ADD CONSTRAINT "user_subscription_planId_plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_userId_index" ON "message" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "reminder_status_dueAt_index" ON "reminder" USING btree ("status","dueAt");--> statement-breakpoint
CREATE INDEX "reminder_userId_status_index" ON "reminder" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "resource_userId_index" ON "resource" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "snippet_messageId_index" ON "snippet" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "idx_snippet_fts" ON "snippet" USING gin ("fts");--> statement-breakpoint
CREATE INDEX "idx_snippet_vector" ON "snippet" USING hnsw ("vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "token_usage_messageId_index" ON "token_usage" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "idx_user_entitlement_ledger_user_key_ts" ON "user_entitlement_ledger" USING btree ("userId","key","timestamp");--> statement-breakpoint
CREATE INDEX "idx_user_entitlement_ledger_key_ts" ON "user_entitlement_ledger" USING btree ("key","timestamp");--> statement-breakpoint
CREATE INDEX "idx_user_profile_version_user_id" ON "user_profile_version" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_user_subscription_user_id" ON "user_subscription" USING btree ("userId");--> statement-breakpoint
CREATE VIEW "public"."v_user_quota" AS (
  WITH daily_usage AS (
    SELECT
      "userId",
      key,
      COALESCE(SUM(value), 0) AS used_24h
    FROM user_entitlement_ledger
    WHERE "timestamp" >= (NOW() - INTERVAL '24 hours')
    GROUP BY "userId", key
  ),
  storage_usage AS (
    SELECT
      "userId",
      COALESCE(SUM(size), 0) AS used_bytes
    FROM resource
    GROUP BY "userId"
  ),
  latest_subscription AS (
    SELECT DISTINCT ON ("userId") "userId", "planId"
    FROM user_subscription
    ORDER BY "userId", "startedAt" DESC
  ),
  resolved_entitlements AS (
    SELECT
      u.id AS "userId",
      pe.key,
      CAST(COALESCE(ueo.value, pe.value) AS INTEGER) AS limit_value
    FROM "user" u
    JOIN latest_subscription us ON us."userId" = u.id
    JOIN plan_entitlement pe ON pe."planId" = us."planId"
    LEFT JOIN user_entitlement_override ueo ON ueo."userId" = u.id AND ueo.key = pe.key
    WHERE pe.key IN (
      'n_messages_per_day',
      'n_web_search_calls_per_day',
      'n_google_places_calls_per_day',
      'n_storage_size'
    )
  )
  SELECT
    re."userId",
    re.key,
    re.limit_value AS "limit",
    CASE
      WHEN re.key = 'n_storage_size' THEN COALESCE(su.used_bytes, 0)
      ELSE COALESCE(du.used_24h, 0)
    END AS used,
    CASE
      WHEN re.limit_value IS NULL THEN NULL
      WHEN re.key = 'n_storage_size' THEN
        GREATEST(re.limit_value - COALESCE(su.used_bytes, 0), 0)
      ELSE
        GREATEST(re.limit_value - COALESCE(du.used_24h, 0), 0)
    END AS remaining
  FROM resolved_entitlements re
  LEFT JOIN daily_usage du ON du."userId" = re."userId" AND du.key = re.key
  LEFT JOIN storage_usage su ON su."userId" = re."userId"
);