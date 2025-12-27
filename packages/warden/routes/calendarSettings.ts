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
  start?: { dateTime?: string | null; date?: string | null }
  end?: { dateTime?: string | null; date?: string | null }
  backgroundColor?: string
  isAppointmentCalendar?: boolean
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
  appointmentCalendarId: string | null
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
        start: e.start ?? undefined,
        end: e.end ?? undefined,
        backgroundColor: calendar?.backgroundColor,
        isAppointmentCalendar: calendarId === appointmentCalendarId,
      })) ?? []
    )
  })

  const allEvents = await Promise.all(eventPromises)
  return allEvents.flat()
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
            calendarData.appointmentCalendarId
          )
        : []

    return c.json({
      connected: true,
      calendars: calendarData.calendars,
      appointmentCalendarId: calendarData.appointmentCalendarId,
      enabledCalendarIds: calendarData.enabledCalendarIds,
      events,
      currentMonth: currentMonth.toISOString(),
    })
  })

  // Create a new calendar
  app.post('/create', async (c) => {
    const body = await c.req.json<{ name: string; description?: string; timezone?: string }>()

    const schema = z.object({
      name: z.string().min(1, 'Nome e obrigatorio'),
      description: z.string().optional(),
      timezone: z.string().optional(),
    })

    const validation = schema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0]?.message }, 400)
    }

    const calendarClient = await getAuthenticatedCalendarClient(db)
    if (!calendarClient) {
      return c.json({ error: 'Calendario nao conectado' }, 400)
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

    await db.setCalendarEnabled(calendarId, body.enabled)

    return c.json({ success: true })
  })

  // Set appointment calendar
  app.patch('/settings/appointment', async (c) => {
    const body = await c.req.json<{ calendarId: string }>()

    await db.setAppointmentCalendarId(body.calendarId)

    return c.json({ success: true })
  })

  return app
}
