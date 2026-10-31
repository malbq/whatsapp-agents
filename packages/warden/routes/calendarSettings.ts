import { google } from 'googleapis'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { z } from 'zod'
import type { WardenDB } from '../db'
import { getSession, SESSION_COOKIE } from './auth'

export interface CalendarListItem {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
}

export interface SidebarCalendar extends CalendarListItem {
  enabled: boolean
}

export interface CalendarEvent {
  id: string
  calendarId: string
  summary?: string
  description?: string
  start?: { dateTime?: string | null; date?: string | null }
  end?: { dateTime?: string | null; date?: string | null }
  backgroundColor?: string
  isAppointmentCalendar?: boolean
  // Appointment-specific data (only present for events from appointment calendar)
  appointment?: {
    customerName: string
    customerPhone: string
    serviceName?: string
    status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  }
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    import.meta.env.GOOGLE_CLIENT_ID,
    import.meta.env.GOOGLE_CLIENT_SECRET
  )
}

async function getAuthenticatedCalendarClient(db: WardenDB) {
  const connection = await db.getCalendarConnection()
  if (!connection) return null

  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: connection.refreshToken })

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

async function fetchMultiCalendarEvents(
  calendarClient: ReturnType<typeof google.calendar>,
  calendarIds: string[],
  calendarsMap: Map<string, CalendarListItem>,
  startOfMonth: Date,
  endOfMonth: Date,
  appointmentCalendarId: string | null,
  db: WardenDB
): Promise<CalendarEvent[]> {
  const eventPromises = calendarIds.map(async (calendarId) => {
    const calendar = calendarsMap.get(calendarId)
    const { data: eventsData } = await calendarClient.events.list({
      calendarId,
      timeMin: startOfMonth.toISOString(),
      timeMax: endOfMonth.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    return (
      eventsData.items?.map((e) => ({
        id: e.id!,
        calendarId,
        summary: e.summary ?? undefined,
        description: e.description ?? undefined,
        start: e.start ?? undefined,
        end: e.end ?? undefined,
        backgroundColor: calendar?.backgroundColor,
        isAppointmentCalendar: calendarId === appointmentCalendarId,
      })) ?? []
    )
  })

  const allEvents = await Promise.all(eventPromises)
  const flatEvents = allEvents.flat()

  // Fetch appointment data for events from appointment calendar
  const appointmentEventIds = flatEvents
    .filter((e) => e.isAppointmentCalendar)
    .map((e) => e.id)

  const appointmentsMap = await db.getAppointmentsWithCustomerByCalendarEventIds(appointmentEventIds)

  // Enrich events with appointment data
  return flatEvents.map((event) => {
    const appointment = appointmentsMap.get(event.id)
    if (appointment) {
      return {
        ...event,
        appointment: {
          customerName: appointment.customerName,
          customerPhone: appointment.customerPhone,
          serviceName: appointment.serviceName,
          status: appointment.status,
        },
      }
    }
    return event
  })
}

async function getCalendarData(db: WardenDB) {
  const calendarClient = await getAuthenticatedCalendarClient(db)
  if (!calendarClient) {
    return null
  }

  const { data: calendarList } = await calendarClient.calendarList.list()
  const googleCalendars: CalendarListItem[] =
    calendarList.items?.map((cal) => ({
      id: cal.id!,
      summary: cal.summary!,
      primary: cal.primary ?? false,
      backgroundColor: cal.backgroundColor ?? undefined,
    })) ?? []

  const settingsEntries = await db.getCalendarSettings()
  const appointmentCalendarId =
    settingsEntries.find((s) => s.isAppointmentCalendar)?.calendarId ?? null

  const sidebarCalendars: SidebarCalendar[] = googleCalendars.map((cal) => {
    const setting = settingsEntries.find((s) => s.calendarId === cal.id)
    return {
      ...cal,
      enabled: setting?.enabled ?? true,
    }
  })

  const calendarsMap = new Map(googleCalendars.map((c) => [c.id, c]))

  return {
    calendarClient,
    calendars: sidebarCalendars,
    appointmentCalendarId,
    calendarsMap,
    enabledCalendarIds: sidebarCalendars.filter((c) => c.enabled).map((c) => c.id),
  }
}

export function createCalendarSettingsRoute(db: WardenDB) {
  const app = new Hono()

  // Middleware to check session for all routes
  app.use('*', async (c, next) => {
    const sessionCookie = getCookie(c, SESSION_COOKIE)
    const session = await getSession(sessionCookie)
    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    return next()
  })

  // Get all calendar data (calendars list, events, settings)
  app.get('/data', async (c) => {
    const monthParam = c.req.query('month')
    const currentMonth = monthParam ? new Date(monthParam) : new Date()

    const calendarData = await getCalendarData(db)
    if (!calendarData) {
      return c.json({ connected: false })
    }

    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    const endOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
      23,
      59,
      59
    )

    const events =
      calendarData.enabledCalendarIds.length > 0
        ? await fetchMultiCalendarEvents(
            calendarData.calendarClient,
            calendarData.enabledCalendarIds,
            calendarData.calendarsMap,
            startOfMonth,
            endOfMonth,
            calendarData.appointmentCalendarId,
            db
          )
        : []

    const workingHours = await db.getWorkingHours()

    return c.json({
      connected: true,
      calendars: calendarData.calendars,
      appointmentCalendarId: calendarData.appointmentCalendarId,
      enabledCalendarIds: calendarData.enabledCalendarIds,
      events,
      currentMonth: currentMonth.toISOString(),
      workingHours: workingHours.map((wh) => ({
        dayOfWeek: wh.dayOfWeek,
        startTime: wh.startTime,
        endTime: wh.endTime,
      })),
    })
  })

  // Create a new calendar
  app.post('/create', async (c) => {
    const body = await c.req.json<{ name: string; description?: string; timezone?: string }>()

    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
      description: z.string().optional(),
      timezone: z.string().optional(),
    })

    const validation = schema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0]?.message }, 400)
    }

    const calendarClient = await getAuthenticatedCalendarClient(db)
    if (!calendarClient) {
      return c.json({ error: 'Calendar not connected' }, 400)
    }

    const { data: newCalendar } = await calendarClient.calendars.insert({
      requestBody: {
        summary: body.name,
        description: body.description || undefined,
        timeZone: body.timezone || undefined,
      },
    })

    await db.setCalendarEnabled(newCalendar.id!, true)

    return c.json({ success: true, calendarId: newCalendar.id })
  })

  // Toggle calendar visibility
  app.patch('/visibility/:calendarId', async (c) => {
    const calendarId = decodeURIComponent(c.req.param('calendarId'))
    const body = await c.req.json<{ enabled: boolean }>()

    const appointmentCalendarId = await db.getAppointmentCalendarId()

    // Prevent disabling the appointment calendar
    if (appointmentCalendarId === calendarId && !body.enabled) {
      return c.json({ error: 'The appointment calendar cannot be disabled.' }, 400)
    }

    await db.setCalendarEnabled(calendarId, body.enabled)

    return c.json({ success: true })
  })

  // Set appointment calendar
  app.patch('/settings/appointment', async (c) => {
    const body = await c.req.json<{ calendarId: string }>()

    await db.setAppointmentCalendarId(body.calendarId)

    return c.json({ success: true })
  })

  // Create an all-day event (for OOO/time off)
  app.post('/events/all-day', async (c) => {
    const body = await c.req.json<{
      calendarId: string
      summary: string
      startDate: string // YYYY-MM-DD
      endDate: string // YYYY-MM-DD (exclusive end date)
      description?: string
    }>()

    const schema = z.object({
      calendarId: z.string().min(1, 'Calendar ID is required'),
      summary: z.string().min(1, 'Summary is required'),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
      description: z.string().optional(),
    })

    const validation = schema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0]?.message }, 400)
    }

    const calendarClient = await getAuthenticatedCalendarClient(db)
    if (!calendarClient) {
      return c.json({ error: 'Calendar not connected' }, 400)
    }

    // Create all-day event
    const { data: event } = await calendarClient.events.insert({
      calendarId: body.calendarId,
      requestBody: {
        summary: body.summary,
        description: body.description || undefined,
        start: {
          date: body.startDate, // All-day events use date without time
        },
        end: {
          date: body.endDate, // Exclusive end date
        },
      },
    })

    return c.json({ success: true, eventId: event.id })
  })

  // Delete an event
  app.delete('/events/:calendarId/:eventId', async (c) => {
    const calendarId = decodeURIComponent(c.req.param('calendarId'))
    const eventId = decodeURIComponent(c.req.param('eventId'))

    const calendarClient = await getAuthenticatedCalendarClient(db)
    if (!calendarClient) {
      return c.json({ error: 'Calendar not connected' }, 400)
    }

    await calendarClient.events.delete({
      calendarId,
      eventId,
    })

    return c.json({ success: true })
  })

  return app
}
