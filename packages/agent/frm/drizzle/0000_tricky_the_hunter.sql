CREATE TABLE "candidate" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"position" text NOT NULL,
	"currentFlow" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_info" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"contact" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview" (
	"id" text PRIMARY KEY NOT NULL,
	"candidateId" text NOT NULL,
	"candidateName" text NOT NULL,
	"slotId" text NOT NULL,
	"status" text NOT NULL,
	"scheduledAt" timestamp NOT NULL,
	"result" text,
	"resultProcessedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_slot" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"candidateId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "interview" ADD CONSTRAINT "interview_candidateId_candidate_id_fk" FOREIGN KEY ("candidateId") REFERENCES "public"."candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_slotId_interview_slot_id_fk" FOREIGN KEY ("slotId") REFERENCES "public"."interview_slot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_slot" ADD CONSTRAINT "interview_slot_candidateId_candidate_id_fk" FOREIGN KEY ("candidateId") REFERENCES "public"."candidate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_resourceId_resource_id_fk" FOREIGN KEY ("resourceId") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippet" ADD CONSTRAINT "snippet_messageId_message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_phone_index" ON "candidate" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "interview_candidateId_index" ON "interview" USING btree ("candidateId");--> statement-breakpoint
CREATE INDEX "interview_slotId_index" ON "interview" USING btree ("slotId");--> statement-breakpoint
CREATE INDEX "interview_status_index" ON "interview" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interview_slot_date_time_index" ON "interview_slot" USING btree ("date","time");--> statement-breakpoint
CREATE INDEX "interview_slot_candidateId_index" ON "interview_slot" USING btree ("candidateId");--> statement-breakpoint
CREATE INDEX "message_userId_index" ON "message" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "reminder_status_dueAt_index" ON "reminder" USING btree ("status","dueAt");--> statement-breakpoint
CREATE INDEX "reminder_userId_status_index" ON "reminder" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "resource_userId_index" ON "resource" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "resource_hash_index" ON "resource" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "snippet_messageId_index" ON "snippet" USING btree ("messageId");