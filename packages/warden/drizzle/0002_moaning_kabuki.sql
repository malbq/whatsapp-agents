CREATE TABLE "calendar_settings" (
	"calendarId" text PRIMARY KEY NOT NULL,
	"isAppointmentCalendar" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"displayOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
