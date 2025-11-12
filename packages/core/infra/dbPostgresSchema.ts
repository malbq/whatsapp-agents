import type { AssistantModelMessage, ToolModelMessage, UserModelMessage } from 'ai'
import { relations } from 'drizzle-orm'
import { bigint, index, integer, json, pgTable, text, timestamp, vector } from 'drizzle-orm/pg-core'
import type { DB } from './db'

export namespace PostgresSchema {
  export const uuidv7 = () =>
    text()
      .notNull()
      .$defaultFn(() => Bun.randomUUIDv7())

  export const user = pgTable('user', {
    id: uuidv7().primaryKey(),
    waId: text().notNull().unique(),
    name: text().notNull(),
    joinedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  })

  export const message = pgTable(
    'message',
    {
      id: uuidv7().primaryKey(),
      userId: text()
        .notNull()
        .references(() => user.id),
      waId: text(),
      type: text().notNull().$type<DB.MessageType>(),
      modelMessage: json()
        .notNull()
        .$type<AssistantModelMessage | ToolModelMessage | UserModelMessage>(),
      usageInputTokens: integer(),
      usageOutputTokens: integer(),
      usageTotalTokens: integer(),
      usageCachedInputTokens: integer(),
      usageReasoningTokens: integer(),
      resourceId: text().references(() => resource.id),
      timestamp: timestamp({ mode: 'date' }).notNull().defaultNow(),
    },
    (table) => [index().on(table.userId), index().on(table.waId)]
  )

  export const snippet = pgTable(
    'snippet',
    {
      id: uuidv7().primaryKey(),
      messageId: text()
        .notNull()
        .references(() => message.id, { onDelete: 'cascade' }),
      sequence: integer().notNull(),
      content: text().notNull(),
      vector: vector({ dimensions: 768 }).notNull(),
    },
    (table) => [index().on(table.messageId)]
  )

  export const resource = pgTable(
    'resource',
    {
      id: uuidv7().primaryKey(),
      userId: text()
        .notNull()
        .references(() => user.id),
      storageKey: text().notNull(),
      size: bigint({ mode: 'number' }),
      mimeType: text(),
      hash: text(),
      originalFilename: text(),
      uploadedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
    },
    (table) => [index().on(table.userId), index().on(table.hash)]
  )

  export const reminder = pgTable(
    'reminder',
    {
      id: uuidv7().primaryKey(),
      userId: text()
        .notNull()
        .references(() => user.id),
      status: text().notNull(),
      dueAt: timestamp({ mode: 'date' }).notNull(),
      description: text().notNull(),
      message: text().notNull(),
      createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
      updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
      sentAt: timestamp({ mode: 'date' }),
      waMessageId: text(),
      error: text(),
      recurrenceCron: text(),
    },
    (table) => [index().on(table.status, table.dueAt), index().on(table.userId, table.status)]
  )

  export const rawIncomingMessage = pgTable('raw_incoming_message', {
    waId: text().primaryKey(),
    timestamp: timestamp({ mode: 'date' }).notNull().defaultNow(),
    payload: text().notNull(),
  })

  export const userRelations = relations(user, ({ many }) => ({
    messages: many(message),
    resources: many(resource),
    reminders: many(reminder),
  }))

  export const messageRelations = relations(message, ({ one, many }) => ({
    user: one(user, {
      fields: [message.userId],
      references: [user.id],
    }),
    resource: one(resource, {
      fields: [message.resourceId],
      references: [resource.id],
    }),
    snippets: many(snippet),
  }))

  export const snippetRelations = relations(snippet, ({ one }) => ({
    message: one(message, {
      fields: [snippet.messageId],
      references: [message.id],
    }),
  }))

  export const resourceRelations = relations(resource, ({ one, many }) => ({
    user: one(user, {
      fields: [resource.userId],
      references: [user.id],
    }),
    messages: many(message),
  }))

  export const reminderRelations = relations(reminder, ({ one }) => ({
    user: one(user, {
      fields: [reminder.userId],
      references: [user.id],
    }),
  }))
}
