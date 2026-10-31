import type { DB } from '@wa/core/infra/db'
import { Postgres } from '@wa/core/infra/dbPostgres'
import { SQL } from 'bun'
import { eq } from 'drizzle-orm'
import { drizzle, type BunSQLDatabase } from 'drizzle-orm/bun-sql'
import * as schema from './dbSchema'
import type {
  AppointmentWithCustomer,
  AvailabilitySettings,
  BusinessInfo,
  CalendarSettingsEntry,
  CustomerAppointment,
  Service,
  WorkingHoursEntry,
} from './types'

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
  createService: (data: Omit<Service, 'id' | 'deletedAt'>) => Promise<Service>
  updateService: (id: string, data: Partial<Omit<Service, 'id' | 'deletedAt'>>) => Promise<Service>
  deleteService: (id: string) => Promise<void>
  createAppointment: (appointment: Omit<CustomerAppointment, 'id'>) => Promise<CustomerAppointment>
  getAppointmentByCalendarEventId: (calendarEventId: string) => Promise<CustomerAppointment | null>
  getAppointmentWithCustomerByCalendarEventId: (calendarEventId: string) => Promise<AppointmentWithCustomer | null>
  getAppointmentsWithCustomerByCalendarEventIds: (calendarEventIds: string[]) => Promise<Map<string, AppointmentWithCustomer>>
  getAppointmentsByUserId: (userId: string) => Promise<CustomerAppointment[]>
  updateAppointmentStatus: (id: string, status: CustomerAppointment['status']) => Promise<void>
  listThreads: () => Promise<Array<Thread>>
  getThread: (userId: string) => Promise<Thread | null>
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
  getForceBusyCalendarIds: () => Promise<string[]>
  setCalendarEnabled: (calendarId: string, enabled: boolean) => Promise<void>
  setCalendarForceBusy: (calendarId: string, forceBusy: boolean) => Promise<void>
  ensureCalendarSettings: (calendarIds: string[], defaultAppointmentCalendarId: string) => Promise<void>
  // Availability settings
  getAvailabilitySettings: () => Promise<AvailabilitySettings>
  updateAvailabilitySettings: (settings: Partial<AvailabilitySettings>) => Promise<void>
  // Working hours
  getWorkingHours: () => Promise<WorkingHoursEntry[]>
  setWorkingHours: (entries: Omit<WorkingHoursEntry, 'id'>[]) => Promise<void>
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
          name: 'My Business',
          address: 'Address not configured',
          contact: 'contact@business.com',
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
      const { isNull } = await import('drizzle-orm')
      const result = await client
        .select()
        .from(schema.service)
        .where(isNull(schema.service.deletedAt))
      return result.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        durationMinutes: row.durationMinutes,
        deletedAt: row.deletedAt ?? undefined,
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
        deletedAt: row.deletedAt ?? undefined,
      }
    },

    async createService(data: Omit<Service, 'id' | 'deletedAt'>) {
      const id = Bun.randomUUIDv7()
      const result = await client
        .insert(schema.service)
        .values({
          id,
          name: data.name,
          description: data.description ?? null,
          durationMinutes: data.durationMinutes,
        })
        .returning()

      const row = result[0]!
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        durationMinutes: row.durationMinutes,
        deletedAt: row.deletedAt ?? undefined,
      }
    },

    async updateService(id: string, data: Partial<Omit<Service, 'id' | 'deletedAt'>>) {
      const result = await client
        .update(schema.service)
        .set({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description ?? null }),
          ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
          updatedAt: new Date(),
        })
        .where(eq(schema.service.id, id))
        .returning()

      const row = result[0]!
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        durationMinutes: row.durationMinutes,
        deletedAt: row.deletedAt ?? undefined,
      }
    },

    async deleteService(id: string) {
      await client
        .update(schema.service)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.service.id, id))
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

    async getAppointmentWithCustomerByCalendarEventId(calendarEventId: string): Promise<AppointmentWithCustomer | null> {
      const result = await client
        .select({
          id: schema.appointment.id,
          calendarEventId: schema.appointment.calendarEventId,
          userId: schema.appointment.userId,
          serviceId: schema.appointment.serviceId,
          scheduledAt: schema.appointment.scheduledAt,
          status: schema.appointment.status,
          customerName: schema.user.name,
          customerPhone: schema.user.waId,
          serviceName: schema.service.name,
        })
        .from(schema.appointment)
        .innerJoin(schema.user, eq(schema.appointment.userId, schema.user.id))
        .leftJoin(schema.service, eq(schema.appointment.serviceId, schema.service.id))
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
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        serviceName: row.serviceName ?? undefined,
      }
    },

    async getAppointmentsWithCustomerByCalendarEventIds(calendarEventIds: string[]): Promise<Map<string, AppointmentWithCustomer>> {
      if (calendarEventIds.length === 0) return new Map()

      const { inArray } = await import('drizzle-orm')
      const result = await client
        .select({
          id: schema.appointment.id,
          calendarEventId: schema.appointment.calendarEventId,
          userId: schema.appointment.userId,
          serviceId: schema.appointment.serviceId,
          scheduledAt: schema.appointment.scheduledAt,
          status: schema.appointment.status,
          customerName: schema.user.name,
          customerPhone: schema.user.waId,
          serviceName: schema.service.name,
        })
        .from(schema.appointment)
        .innerJoin(schema.user, eq(schema.appointment.userId, schema.user.id))
        .leftJoin(schema.service, eq(schema.appointment.serviceId, schema.service.id))
        .where(inArray(schema.appointment.calendarEventId, calendarEventIds))

      const map = new Map<string, AppointmentWithCustomer>()
      for (const row of result) {
        map.set(row.calendarEventId, {
          id: row.id,
          calendarEventId: row.calendarEventId,
          userId: row.userId,
          serviceId: row.serviceId ?? undefined,
          scheduledAt: row.scheduledAt,
          status: row.status,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          serviceName: row.serviceName ?? undefined,
        })
      }
      return map
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

    async getThread(userId: string): Promise<Thread | null> {
      const user = await client.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
        columns: {
          id: true,
          name: true,
          waId: true,
        },
      })

      if (!user) return null

      const messages = await client.query.message.findMany({
        where: (message, { eq }) => eq(message.userId, userId),
        orderBy: (message, { asc }) => [asc(message.timestamp)],
      })

      return {
        userId: user.id,
        userName: user.name,
        externalId: user.waId,
        messages,
      }
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
        forceBusy: r.forceBusy,
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

      // Then set the new one AND ensure it is enabled
      await client
        .insert(schema.calendarSettings)
        .values({
          calendarId,
          isAppointmentCalendar: true,
          enabled: true,
          displayOrder: 0,
          forceBusy: false,
        })
        .onConflictDoUpdate({
          target: schema.calendarSettings.calendarId,
          set: {
            isAppointmentCalendar: true,
            enabled: true,
            updatedAt: new Date(),
          },
        })
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
          forceBusy: false,
        })
        .onConflictDoUpdate({
          target: schema.calendarSettings.calendarId,
          set: {
            enabled,
            updatedAt: new Date(),
          },
        })
    },

    async getForceBusyCalendarIds(): Promise<string[]> {
      const result = await client
        .select({ calendarId: schema.calendarSettings.calendarId })
        .from(schema.calendarSettings)
        .where(eq(schema.calendarSettings.forceBusy, true))

      return result.map((r) => r.calendarId)
    },

    async setCalendarForceBusy(calendarId: string, forceBusy: boolean): Promise<void> {
      await client
        .insert(schema.calendarSettings)
        .values({
          calendarId,
          enabled: true,
          isAppointmentCalendar: false,
          displayOrder: 0,
          forceBusy,
        })
        .onConflictDoUpdate({
          target: schema.calendarSettings.calendarId,
          set: {
            forceBusy,
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
            forceBusy: false,
          })
          .onConflictDoNothing()
      }
    },

    async getAvailabilitySettings(): Promise<AvailabilitySettings> {
      const result = await client
        .select()
        .from(schema.availabilitySettings)
        .where(eq(schema.availabilitySettings.id, 'default'))
        .limit(1)

      if (result.length === 0) {
        // Return defaults: buffer 0, min notice 60, granularity 60
        const defaults: AvailabilitySettings = {
          bufferMinutes: 0,
          minNoticeMinutes: 60,
          minRescheduleNoticeMinutes: 60,
          granularityMinutes: 60,
          maxDaysAhead: 14,
        }
        await this.updateAvailabilitySettings(defaults)
        return defaults
      }

      const row = result[0]!
      return {
        bufferMinutes: row.bufferMinutes,
        minNoticeMinutes: row.minNoticeMinutes,
        minRescheduleNoticeMinutes: row.minRescheduleNoticeMinutes,
        granularityMinutes: row.granularityMinutes,
        maxDaysAhead: row.maxDaysAhead,
      }
    },

    async updateAvailabilitySettings(settings: Partial<AvailabilitySettings>): Promise<void> {
      await client
        .insert(schema.availabilitySettings)
        .values({
          id: 'default',
          bufferMinutes: settings.bufferMinutes ?? 0,
          minNoticeMinutes: settings.minNoticeMinutes ?? 60,
          minRescheduleNoticeMinutes: settings.minRescheduleNoticeMinutes ?? 60,
          granularityMinutes: settings.granularityMinutes ?? 60,
          maxDaysAhead: settings.maxDaysAhead ?? 14,
        })
        .onConflictDoUpdate({
          target: schema.availabilitySettings.id,
          set: {
            ...(settings.bufferMinutes !== undefined && { bufferMinutes: settings.bufferMinutes }),
            ...(settings.minNoticeMinutes !== undefined && {
              minNoticeMinutes: settings.minNoticeMinutes,
            }),
            ...(settings.minRescheduleNoticeMinutes !== undefined && {
              minRescheduleNoticeMinutes: settings.minRescheduleNoticeMinutes,
            }),
            ...(settings.granularityMinutes !== undefined && {
              granularityMinutes: settings.granularityMinutes,
            }),
            ...(settings.maxDaysAhead !== undefined && { maxDaysAhead: settings.maxDaysAhead }),
            updatedAt: new Date(),
          },
        })
    },

    async getWorkingHours(): Promise<WorkingHoursEntry[]> {
      const result = await client
        .select()
        .from(schema.workingHours)
        .orderBy(schema.workingHours.dayOfWeek, schema.workingHours.startTime)

      if (result.length === 0) {
        // Return defaults: 8-12 + 13-17 for weekdays (Mon-Fri)
        const defaults: Omit<WorkingHoursEntry, 'id'>[] = []
        for (let day = 1; day <= 5; day++) {
          defaults.push({ dayOfWeek: day, startTime: '08:00', endTime: '12:00' })
          defaults.push({ dayOfWeek: day, startTime: '13:00', endTime: '17:00' })
        }
        await this.setWorkingHours(defaults)
        return this.getWorkingHours()
      }

      return result.map((row) => ({
        id: row.id,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
      }))
    },

    async setWorkingHours(entries: Omit<WorkingHoursEntry, 'id'>[]): Promise<void> {
      // Delete existing working hours and insert new ones
      await client.delete(schema.workingHours)

      if (entries.length === 0) return

      await client.insert(schema.workingHours).values(
        entries.map((entry) => ({
          id: Bun.randomUUIDv7(),
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
        }))
      )
    },
  }
}
