CREATE TABLE "availability_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"bufferMinutes" integer DEFAULT 0 NOT NULL,
	"minNoticeMinutes" integer DEFAULT 60 NOT NULL,
	"minRescheduleNoticeMinutes" integer DEFAULT 60 NOT NULL,
	"granularityMinutes" integer DEFAULT 60 NOT NULL,
	"maxDaysAhead" integer DEFAULT 14 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"dayOfWeek" integer NOT NULL,
	"startTime" text NOT NULL,
	"endTime" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_settings" ADD COLUMN "forceBusy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "working_hours_dayOfWeek_index" ON "working_hours" USING btree ("dayOfWeek");