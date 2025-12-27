CREATE TABLE "calendar_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"refreshToken" text NOT NULL,
	"calendarId" text NOT NULL,
	"email" text,
	"connectedAt" timestamp DEFAULT now() NOT NULL,
	"connectedBy" text
);
