CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"waId" text,
	"type" text NOT NULL,
	"modelMessage" json NOT NULL,
	"usageInputTokens" integer,
	"usageOutputTokens" integer,
	"usageTotalTokens" integer,
	"usageCachedInputTokens" integer,
	"usageReasoningTokens" integer,
	"resourceId" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_incoming_message" (
	"waId" text PRIMARY KEY NOT NULL,
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
	"hash" text,
	"originalFilename" text,
	"uploadedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snippet" (
	"id" text PRIMARY KEY NOT NULL,
	"messageId" text NOT NULL,
	"sequence" integer NOT NULL,
	"content" text NOT NULL,
	"vector" vector(768) NOT NULL
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
CREATE TABLE "user_profile_version" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile" text NOT NULL,
	"message_id" text
);
--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_resourceId_resource_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet" ADD CONSTRAINT "snippet_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_userId_index" ON "message" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "reminder_status_dueAt_index" ON "reminder" USING btree ("status","dueAt");--> statement-breakpoint
CREATE INDEX "reminder_userId_status_index" ON "reminder" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "resource_userId_index" ON "resource" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "resource_hash_index" ON "resource" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "snippet_messageId_index" ON "snippet" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "idx_user_profile_version_user_id" ON "user_profile_version" USING btree ("user_id");