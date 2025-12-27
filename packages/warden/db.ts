import type { DB } from '@batman/core/infra/db'
import { Postgres } from '@batman/core/infra/dbPostgres'
import { SQL } from 'bun'
import { eq } from 'drizzle-orm'
import { drizzle, type BunSQLDatabase } from 'drizzle-orm/bun-sql'
import * as schema from './dbSchema'
import type { BusinessInfo, CalendarSettingsEntry, CustomerAppointment, Service } from './types'

export interface Thread {
  userId: string
  userName: string
  externalId: string
  messages: Array<DB.Message>
}

export interface CalendarConnection {
  id: string
  refreshToken: string
  calendarId: string
  email: string | null
  connectedAt: Date
  connectedBy: string | null
}

export interface WardenDB extends DB.Repository {
  getBusinessInfo: () => Promise<BusinessInfo>
  updateBusinessInfo: (info: BusinessInfo) => Promise<void>
  listServices: () => Promise<Service[]>
  getService: (id: string) => Promise<Service | null>
  createAppointment: (appointment: Omit<CustomerAppointment, 'id'>) => Promise<CustomerAppointment>
  getAppointmentByCalendarEventId: (calendarEventId: string) => Promise<CustomerAppointment | null>
  getAppointmentsByUserId: (userId: string) => Promise<CustomerAppointment[]>
  updateAppointmentStatus: (id: string, status: CustomerAppointment['status']) => Promise<void>
  listThreads: () => Promise<Array<Thread>>
  getCalendarConnection: () => Promise<CalendarConnection | null>
  saveCalendarConnection: (
    connection: Omit<CalendarConnection, 'id' | 'connectedAt'>
  ) => Promise<CalendarConnection>
  deleteCalendarConnection: () => Promise<void>
  // Calendar settings
  getCalendarSettings: () => Promise<CalendarSettingsEntry[]>
  getAppointmentCalendarId: () => Promise<string | null>
  setAppointmentCalendarId: (calendarId: string) => Promise<void>
  getEnabledCalendarIds: () => Promise<string[]>
  setCalendarEnabled: (calendarId: string, enabled: boolean) => Promise<void>
  ensureCalendarSettings: (calendarIds: string[], defaultAppointmentCalendarId: string) => Promise<void>
}

const connectionKey = Symbol.for('warden.db.connection')
const cleanupKey = Symbol.for('warden.db.cleanup')

interface ConnectionState {
  dbClient: BunSQLDatabase<typeof schema>
  sqlClient: SQL
}

function getOrCreateClient(): BunSQLDatabase<typeof schema> {
  const existing = (globalThis as Record<symbol, ConnectionState>)[connectionKey]
  if (existing) {
    return existing.dbClient
  }

  const sqlClient = new SQL(import.meta.env.DATABASE_URL)
  const dbClient = drizzle(sqlClient, { schema })

  const state: ConnectionState = { dbClient, sqlClient }
  ;(globalThis as Record<symbol, ConnectionState>)[connectionKey] = state

  const cleanup = () => {
    const current = (globalThis as Record<symbol, ConnectionState>)[connectionKey]
    if (current?.sqlClient) {
      current.sqlClient.close().catch(() => {})
      delete (globalThis as Record<symbol, ConnectionState>)[connectionKey]
    }
  }

  if (!(globalThis as Record<symbol, boolean>)[cleanupKey]) {
    ;(globalThis as Record<symbol, boolean>)[cleanupKey] = true
    process.once('SIGINT', cleanup)
    process.once('SIGTERM', cleanup)
    process.once('exit', cleanup)
  }

  return dbClient
}

export const dbFactory = (): WardenDB => {
  const client = getOrCreateClient()
  const coreDB = Postgres.dbFactory({ client })

  return {
    ...coreDB,

    async getBusinessInfo() {
      const result = await client
        .select()
        .from(schema.businessInfo)
        .where(eq(schema.businessInfo.id, 'business'))
        .limit(1)

      if (result.length === 0) {
        const defaultInfo: BusinessInfo = {
          name: 'Minha Empresa',
          address: 'Endereço não configurado',
          contact: 'contato@empresa.com',
        }
        await this.updateBusinessInfo(defaultInfo)
        return defaultInfo
      }

      const row = result[0]!
      return {
        name: row.name,
        address: row.address,
        contact: row.contact,
        description: row.description ?? undefined,
      }
    },

    async updateBusinessInfo(info: BusinessInfo) {
      await client
        .insert(schema.businessInfo)
        .values({
          id: 'business',
          name: info.name,
          address: info.address,
          contact: info.contact,
          description: info.description ?? null,
        })
        .onConflictDoUpdate({
          target: schema.businessInfo.id,
          set: {
            name: info.name,
            address: info.address,
            contact: info.contact,
            description: info.description ?? null,
            updatedAt: new Date(),
          },
        })
    },

    async listServices() {
      const result = await client.select().from(schema.service)
      return result.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        durationMinutes: row.durationMinutes,
      }))
    },

    async getService(id: string) {
      const result = await client
        .select()
        .from(schema.service)
        .where(eq(schema.service.id, id))
        .limit(1)

      if (result.length === 0) return null

      const row = result[0]!
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        durationMinutes: row.durationMinutes,
      }
    },

    async createAppointment(appointmentData: Omit<CustomerAppointment, 'id'>) {
      const id = Bun.randomUUIDv7()
      const result = await client
        .insert(schema.appointment)
        .values({
          id,
          calendarEventId: appointmentData.calendarEventId,
          userId: appointmentData.userId,
          serviceId: appointmentData.serviceId ?? null,
          scheduledAt: appointmentData.scheduledAt,
          status: appointmentData.status,
        })
        .returning()

      const row = result[0]!
      return {
        id: row.id,
        calendarEventId: row.calendarEventId,
        userId: row.userId,
        serviceId: row.serviceId ?? undefined,
        scheduledAt: row.scheduledAt,
        status: row.status,
      }
    },

    async getAppointmentByCalendarEventId(calendarEventId: string) {
      const result = await client
        .select()
        .from(schema.appointment)
        .where(eq(schema.appointment.calendarEventId, calendarEventId))
        .limit(1)

      if (result.length === 0) return null

      const row = result[0]!
      return {
        id: row.id,
        calendarEventId: row.calendarEventId,
        userId: row.userId,
        serviceId: row.serviceId ?? undefined,
        scheduledAt: row.scheduledAt,
        status: row.status,
      }
    },

    async getAppointmentsByUserId(userId: string) {
      const result = await client
        .select()
        .from(schema.appointment)
        .where(eq(schema.appointment.userId, userId))

      return result.map((row) => ({
        id: row.id,
        calendarEventId: row.calendarEventId,
        userId: row.userId,
        serviceId: row.serviceId ?? undefined,
        scheduledAt: row.scheduledAt,
        status: row.status,
      }))
    },

    async updateAppointmentStatus(id: string, status: CustomerAppointment['status']) {
      await client
        .update(schema.appointment)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(schema.appointment.id, id))
    },

    async listThreads() {
      const users = await client.query.user.findMany({
        columns: {
          id: true,
          name: true,
          waId: true,
        },
        orderBy: (user, { desc }) => [desc(user.joinedAt)],
      })

      const threads: Array<Thread> = []

      for (const user of users) {
        const userId = user.id
        if (!userId) continue

        const messages = await client.query.message.findMany({
          where: (message, { eq }) => eq(message.userId, userId),
          orderBy: (message, { asc }) => [asc(message.timestamp)],
        })

        threads.push({
          userId,
          userName: user.name,
          externalId: user.waId,
          messages,
        })
      }

      return threads
    },

    async getCalendarConnection() {
      const result = await client
        .select()
        .from(schema.calendarConnection)
        .where(eq(schema.calendarConnection.id, 'default'))
        .limit(1)

      if (result.length === 0) return null

      const row = result[0]!
      return {
        id: row.id,
        refreshToken: row.refreshToken,
        calendarId: row.calendarId,
        email: row.email,
        connectedAt: row.connectedAt,
        connectedBy: row.connectedBy,
      }
    },

    async saveCalendarConnection(connection: Omit<CalendarConnection, 'id' | 'connectedAt'>) {
      const result = await client
        .insert(schema.calendarConnection)
        .values({
          id: 'default',
          refreshToken: connection.refreshToken,
          calendarId: connection.calendarId,
          email: connection.email,
          connectedBy: connection.connectedBy,
        })
        .onConflictDoUpdate({
          target: schema.calendarConnection.id,
          set: {
            refreshToken: connection.refreshToken,
            calendarId: connection.calendarId,
            email: connection.email,
            connectedBy: connection.connectedBy,
            connectedAt: new Date(),
          },
        })
        .returning()

      const row = result[0]!
      return {
        id: row.id,
        refreshToken: row.refreshToken,
        calendarId: row.calendarId,
        email: row.email,
        connectedAt: row.connectedAt,
        connectedBy: row.connectedBy,
      }
    },

    async deleteCalendarConnection() {
      await client
        .delete(schema.calendarConnection)
        .where(eq(schema.calendarConnection.id, 'default'))
    },

    async getCalendarSettings(): Promise<CalendarSettingsEntry[]> {
      const rows = await client.select().from(schema.calendarSettings)

      return rows.map((r) => ({
        calendarId: r.calendarId,
        isAppointmentCalendar: r.isAppointmentCalendar,
        enabled: r.enabled,
        displayOrder: r.displayOrder,
      }))
    },

    async getAppointmentCalendarId(): Promise<string | null> {
      const result = await client
        .select({ calendarId: schema.calendarSettings.calendarId })
        .from(schema.calendarSettings)
        .where(eq(schema.calendarSettings.isAppointmentCalendar, true))
        .limit(1)

      return result[0]?.calendarId ?? null
    },

    async setAppointmentCalendarId(calendarId: string): Promise<void> {
      // First, unset any existing appointment calendar
      await client
        .update(schema.calendarSettings)
        .set({ isAppointmentCalendar: false, updatedAt: new Date() })
        .where(eq(schema.calendarSettings.isAppointmentCalendar, true))

      // Then set the new one
      await client
        .update(schema.calendarSettings)
        .set({ isAppointmentCalendar: true, updatedAt: new Date() })
        .where(eq(schema.calendarSettings.calendarId, calendarId))
    },

    async getEnabledCalendarIds(): Promise<string[]> {
      const result = await client
        .select({ calendarId: schema.calendarSettings.calendarId })
        .from(schema.calendarSettings)
        .where(eq(schema.calendarSettings.enabled, true))

      return result.map((r) => r.calendarId)
    },

    async setCalendarEnabled(calendarId: string, enabled: boolean): Promise<void> {
      await client
        .insert(schema.calendarSettings)
        .values({
          calendarId,
          enabled,
          isAppointmentCalendar: false,
          displayOrder: 0,
        })
        .onConflictDoUpdate({
          target: schema.calendarSettings.calendarId,
          set: {
            enabled,
            updatedAt: new Date(),
          },
        })
    },

    async ensureCalendarSettings(
      calendarIds: string[],
      defaultAppointmentCalendarId: string
    ): Promise<void> {
      // Check if we have any appointment calendar set
      const existingAppointment = await client
        .select()
        .from(schema.calendarSettings)
        .where(eq(schema.calendarSettings.isAppointmentCalendar, true))
        .limit(1)

      // Ensure each calendar has a settings row (default to enabled)
      for (const calId of calendarIds) {
        const isDefault = calId === defaultAppointmentCalendarId && existingAppointment.length === 0
        await client
          .insert(schema.calendarSettings)
          .values({
            calendarId: calId,
            enabled: true,
            isAppointmentCalendar: isDefault,
            displayOrder: 0,
          })
          .onConflictDoNothing()
      }
    },
  }
}
