import { google } from 'googleapis'
import type { WardenDB } from '../db'
import { CalendarNotConnectedError, type CalendarAdapter, type TimeSlot, type Appointment } from './types'

function getAppointmentDurationMinutes(): number {
  return parseInt(import.meta.env.APPOINTMENT_DURATION_MINUTES || '30')
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    import.meta.env.GOOGLE_CLIENT_ID,
    import.meta.env.GOOGLE_CLIENT_SECRET
  )
}

/**
 * Creates a calendar adapter that loads credentials from the database.
 * Each call to a method will fetch the current connection from DB.
 * This ensures we always use the latest credentials and handles disconnection gracefully.
 * 
 * The calendar ID for appointments is now read from calendar_settings table,
 * falling back to the connection table for backwards compatibility.
 */
export function createCalendarAdapter(db: WardenDB): CalendarAdapter {
  async function getCalendarClient() {
    const connection = await db.getCalendarConnection()
    if (!connection) {
      throw new CalendarNotConnectedError()
    }

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: connection.refreshToken })

    // Get appointment calendar from settings, fallback to connection table
    const appointmentCalendarId = await db.getAppointmentCalendarId()
    const calendarId = appointmentCalendarId ?? connection.calendarId

    return {
      calendar: google.calendar({ version: 'v3', auth: oauth2Client }),
      calendarId,
    }
  }

  return createCalendarAdapterFromGetter(getCalendarClient)
}

type CalendarClient = {
  calendar: ReturnType<typeof google.calendar>
  calendarId: string
}

function createCalendarAdapterFromGetter(
  getCalendarClient: () => Promise<CalendarClient>
): CalendarAdapter {
  return {
    async checkAvailability(startDate: Date, endDate: Date): Promise<TimeSlot[]> {
      const { calendar, calendarId } = await getCalendarClient()
      const appointmentDurationMinutes = getAppointmentDurationMinutes()

      const freeBusyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          items: [{ id: calendarId }],
        },
      })

      const busySlots = freeBusyResponse.data.calendars?.[calendarId]?.busy ?? []

      // Generate available slots by finding gaps in busy periods
      // For PoC: generate slots every appointmentDurationMinutes during business hours (9-17)
      const availableSlots: TimeSlot[] = []
      const current = new Date(startDate)

      while (current < endDate) {
        const hour = current.getHours()

        // Only consider business hours (9 AM - 5 PM)
        if (hour >= 9 && hour < 17) {
          const slotEnd = new Date(current.getTime() + appointmentDurationMinutes * 60 * 1000)

          // Check if this slot overlaps with any busy period
          const isAvailable = !busySlots.some((busy) => {
            const busyStart = new Date(busy.start!)
            const busyEnd = new Date(busy.end!)
            return current < busyEnd && slotEnd > busyStart
          })

          if (isAvailable) {
            availableSlots.push({
              start: new Date(current),
              end: slotEnd,
            })
          }
        }

        // Move to next slot
        current.setMinutes(current.getMinutes() + appointmentDurationMinutes)

        // If we've passed business hours, jump to next day 9 AM
        if (current.getHours() >= 17 || current.getHours() < 9) {
          current.setDate(current.getDate() + (current.getHours() >= 17 ? 1 : 0))
          current.setHours(9, 0, 0, 0)
        }
      }

      return availableSlots
    },

    async bookAppointment(
      slot: TimeSlot,
      customerName: string,
      customerPhone: string,
      serviceName?: string
    ): Promise<Appointment> {
      const { calendar, calendarId } = await getCalendarClient()

      const summary = serviceName
        ? `${serviceName} - ${customerName}`
        : `Agendamento - ${customerName}`

      const event = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description: `Cliente: ${customerName}\nTelefone: ${customerPhone}`,
          start: {
            dateTime: slot.start.toISOString(),
          },
          end: {
            dateTime: slot.end.toISOString(),
          },
        },
      })

      return {
        id: event.data.id!,
        start: new Date(event.data.start!.dateTime!),
        end: new Date(event.data.end!.dateTime!),
        customerName,
        customerPhone,
        serviceName,
      }
    },

    async cancelAppointment(appointmentId: string): Promise<void> {
      const { calendar, calendarId } = await getCalendarClient()

      await calendar.events.delete({
        calendarId,
        eventId: appointmentId,
      })
    },

    async getAppointment(appointmentId: string): Promise<Appointment | null> {
      const { calendar, calendarId } = await getCalendarClient()

      const event = await calendar.events
        .get({
          calendarId,
          eventId: appointmentId,
        })
        .catch(() => null)

      if (!event) return null

      // Parse customer info from description
      const descriptionLines = event.data.description?.split('\n') ?? []
      const customerName =
        descriptionLines.find((l) => l.startsWith('Cliente:'))?.replace('Cliente:', '').trim() ??
        event.data.summary ??
        'Unknown'
      const customerPhone =
        descriptionLines.find((l) => l.startsWith('Telefone:'))?.replace('Telefone:', '').trim() ??
        ''

      return {
        id: event.data.id!,
        start: new Date(event.data.start!.dateTime!),
        end: new Date(event.data.end!.dateTime!),
        customerName,
        customerPhone,
      }
    },

    async updateAppointment(appointmentId: string, newSlot: TimeSlot): Promise<Appointment> {
      const { calendar, calendarId } = await getCalendarClient()

      const event = await calendar.events.patch({
        calendarId,
        eventId: appointmentId,
        requestBody: {
          start: { dateTime: newSlot.start.toISOString() },
          end: { dateTime: newSlot.end.toISOString() },
        },
      })

      const descriptionLines = event.data.description?.split('\n') ?? []
      const customerName =
        descriptionLines.find((l) => l.startsWith('Cliente:'))?.replace('Cliente:', '').trim() ??
        event.data.summary ??
        'Unknown'
      const customerPhone =
        descriptionLines.find((l) => l.startsWith('Telefone:'))?.replace('Telefone:', '').trim() ??
        ''

      return {
        id: event.data.id!,
        start: new Date(event.data.start!.dateTime!),
        end: new Date(event.data.end!.dateTime!),
        customerName,
        customerPhone,
      }
    },
  }
}
