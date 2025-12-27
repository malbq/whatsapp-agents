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
