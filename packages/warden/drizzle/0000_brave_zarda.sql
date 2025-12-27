CREATE TABLE "appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"calendarEventId" text NOT NULL,
	"userId" text NOT NULL,
	"serviceId" text,
	"scheduledAt" timestamp NOT NULL,
	"status" text NOT NULL,
	"reminderSentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_calendarEventId_unique" UNIQUE("calendarEventId")
);
--> statement-breakpoint
CREATE TABLE "business_info" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"contact" text NOT NULL,
	"description" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "service" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"durationMinutes" integer DEFAULT 30 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
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
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_serviceId_service_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."service"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_resourceId_resource_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet" ADD CONSTRAINT "snippet_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_userId_index" ON "appointment" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "appointment_calendarEventId_index" ON "appointment" USING btree ("calendarEventId");--> statement-breakpoint
CREATE INDEX "appointment_status_index" ON "appointment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "appointment_scheduledAt_index" ON "appointment" USING btree ("scheduledAt");--> statement-breakpoint
CREATE INDEX "message_userId_index" ON "message" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "reminder_status_dueAt_index" ON "reminder" USING btree ("status","dueAt");--> statement-breakpoint
CREATE INDEX "reminder_userId_status_index" ON "reminder" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "resource_userId_index" ON "resource" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "snippet_messageId_index" ON "snippet" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "idx_snippet_fts" ON "snippet" USING gin ("fts");--> statement-breakpoint
CREATE INDEX "idx_snippet_vector" ON "snippet" USING hnsw ("vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "token_usage_messageId_index" ON "token_usage" USING btree ("messageId");