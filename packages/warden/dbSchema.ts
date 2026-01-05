import { PostgresSchema } from '@batman/core/infra/dbSchema'
import { boolean, index, integer, pgTable as table, text, timestamp } from 'drizzle-orm/pg-core'

export const {
  rawIncomingMessage,
  user,
  message,
  tokenUsage,
  resource,
  snippet,
  reminder,
  userRelations,
  messageRelations,
  tokenUsageRelations,
  resourceRelations,
  snippetRelations,
  reminderRelations,
} = PostgresSchema

export const businessInfo = table('business_info', {
  id: text().primaryKey(),
  name: text().notNull(),
  address: text().notNull(),
  contact: text().notNull(),
  description: text(),
  updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
})

export const service = table('service', {
  id: PostgresSchema.uuidv7().primaryKey(),
  name: text().notNull(),
  description: text(),
  durationMinutes: integer().notNull().default(30),
  createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  deletedAt: timestamp({ mode: 'date' }),
})

/**
 * Stores OAuth connection to Google Calendar.
 * Single-tenant: only one row expected (id = 'default').
 * The refresh token is used to make Calendar API calls on behalf of the business owner.
 */
export const calendarConnection = table('calendar_connection', {
  id: text().primaryKey(),
  /** Google OAuth refresh token - used to obtain access tokens */
  refreshToken: text().notNull(),
  /** Google Calendar ID to use for appointments */
  calendarId: text().notNull(),
  /** Email of the Google account that connected */
  email: text(),
  /** When the connection was established */
  connectedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  /** Email of the dashboard user who connected it */
  connectedBy: text(),
})

/**
 * Calendar settings for the dashboard.
 * Each row represents a Google Calendar with its visibility and order settings.
 * One calendar can be marked as the appointment calendar (isAppointmentCalendar=true).
 */
export const calendarSettings = table('calendar_settings', {
  /** Google Calendar ID */
  calendarId: text().primaryKey(),
  /** Whether this calendar receives agent appointments */
  isAppointmentCalendar: boolean().notNull().default(false),
  /** Whether this calendar is visible in the grid */
  enabled: boolean().notNull().default(true),
  /** Display order in the sidebar */
  displayOrder: integer().notNull().default(0),
  /**
   * Force busy: treat all events from this calendar as busy regardless of transparency.
   * Useful for holiday calendars where events may be marked as "free" but should block availability.
   */
  forceBusy: boolean().notNull().default(false),
  createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
})

/**
 * Working hours configuration for availability.
 * Each row represents a time interval for a specific day of the week.
 * A single day can have multiple intervals (e.g., morning and afternoon).
 */
export const workingHours = table(
  'working_hours',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    /** Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday */
    dayOfWeek: integer().notNull(),
    /** Start time in HH:MM format (24h) */
    startTime: text().notNull(),
    /** End time in HH:MM format (24h) */
    endTime: text().notNull(),
    createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index().on(t.dayOfWeek)]
)

/**
 * Availability settings for scheduling.
 * Single-tenant: only one row expected (id = 'default').
 */
export const availabilitySettings = table('availability_settings', {
  id: text().primaryKey(),
  /** Buffer time in minutes before and after appointments (symmetric) */
  bufferMinutes: integer().notNull().default(0),
  /** Minimum notice in minutes required for creating new appointments */
  minNoticeMinutes: integer().notNull().default(60),
  /** Minimum notice in minutes required for rescheduling appointments */
  minRescheduleNoticeMinutes: integer().notNull().default(60),
  /** Slot granularity in minutes (step size for available slots) */
  granularityMinutes: integer().notNull().default(60),
  /** Maximum days ahead to show availability */
  maxDaysAhead: integer().notNull().default(14),
  createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
})

/**
 * Local reference to appointments stored in Google Calendar.
 * The calendar is the source of truth - this table links appointments to users
 * and stores status for reminders.
 */
export const appointment = table(
  'appointment',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    /** Google Calendar event ID */
    calendarEventId: text().notNull().unique(),
    userId: text()
      .notNull()
      .references(() => user.id),
    serviceId: text().references(() => service.id),
    scheduledAt: timestamp({ mode: 'date' }).notNull(),
    status: text().notNull().$type<'scheduled' | 'confirmed' | 'cancelled' | 'completed'>(),
    reminderSentAt: timestamp({ mode: 'date' }),
    createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.userId),
    index().on(t.calendarEventId),
    index().on(t.status),
    index().on(t.scheduledAt),
  ]
)
