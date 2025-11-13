import { PostgresSchema } from '@batman/core/infra/dbPostgresSchema'
import { boolean, index, pgTable as table, text, timestamp } from 'drizzle-orm/pg-core'

export const {
  rawIncomingMessage,
  user,
  message,
  resource,
  snippet,
  reminder,
  userRelations,
  messageRelations,
  resourceRelations,
  snippetRelations,
  reminderRelations,
} = PostgresSchema

export const companyInfo = table('company_info', {
  id: text().primaryKey(),
  name: text().notNull(),
  location: text().notNull(),
  contact: text().notNull(),
  updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
})

export const candidate = table(
  'candidate',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    name: text().notNull(),
    phone: text().notNull(),
    position: text().notNull(),
    currentFlow: text().$type<'initial' | 'scheduling' | 'rescheduling' | 'completed'>(),
    createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index().on(table.phone)]
)

export const interviewSlot = table(
  'interview_slot',
  {
    id: text().primaryKey(),
    date: text().notNull(),
    time: text().notNull(),
    available: boolean().notNull().default(true),
    candidateId: text().references(() => candidate.id),
    createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index().on(table.date, table.time), index().on(table.candidateId)]
)

export const interview = table(
  'interview',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    candidateId: text()
      .notNull()
      .references(() => candidate.id),
    candidateName: text().notNull(),
    slotId: text()
      .notNull()
      .references(() => interviewSlot.id),
    status: text().notNull().$type<'scheduled' | 'confirmed' | 'cancelled' | 'completed'>(),
    scheduledAt: timestamp({ mode: 'date' }).notNull(),
    result: text().$type<'approved' | 'rejected'>(),
    resultProcessedAt: timestamp({ mode: 'date' }),
    createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index().on(table.candidateId), index().on(table.slotId), index().on(table.status)]
)
