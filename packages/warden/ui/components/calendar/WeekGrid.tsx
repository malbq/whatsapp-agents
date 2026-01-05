import { Fragment } from 'react'
import { parseEventDate } from './dateUtils'
import { EventPill } from './EventPill'
import type { CalendarEvent, WorkingHoursEntry } from './types'

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const MINUTES_PER_ROW = 60

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':')
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  return hours * 60 + minutes
}

function getWeekBounds(
  workingHours: WorkingHoursEntry[],
  weekDates: Date[]
): { minHour: number; maxHour: number } {
  const weekDays = new Set(weekDates.map((d) => d.getDay()))
  const relevantHours = workingHours.filter((entry) => weekDays.has(entry.dayOfWeek))

  if (relevantHours.length === 0) {
    return { minHour: 8, maxHour: 18 }
  }

  let minMinutes = 24 * 60
  let maxMinutes = 0

  for (const entry of relevantHours) {
    const start = parseTime(entry.startTime)
    const end = parseTime(entry.endTime)
    if (start < minMinutes) minMinutes = start
    if (end > maxMinutes) maxMinutes = end
  }

  return {
    minHour: Math.floor(minMinutes / 60),
    maxHour: Math.ceil(maxMinutes / 60),
  }
}

function getWeekDates(referenceDate: Date): Date[] {
  const dayOfWeek = referenceDate.getDay()
  const weekStart = new Date(referenceDate)
  weekStart.setDate(referenceDate.getDate() - dayOfWeek)

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    dates.push(date)
  }
  return dates
}

function isAllDayEvent(event: CalendarEvent): boolean {
  return !!(event.start?.date && !event.start?.dateTime)
}

function getEventGridPosition(
  event: CalendarEvent,
  minHour: number,
  maxHour: number,
  firstHourRowIndex: number
): { rowStart: number; rowEnd: number } | null {
  const startStr = event.start?.dateTime
  const endStr = event.end?.dateTime
  if (!startStr || !endStr) return null

  const startDate = new Date(startStr)
  const endDate = new Date(endStr)

  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()

  const dayStartMinutes = minHour * 60
  const dayEndMinutes = maxHour * 60

  // Clamp to visible range
  const visibleStart = Math.max(startMinutes, dayStartMinutes)
  const visibleEnd = Math.min(endMinutes, dayEndMinutes)

  if (visibleStart >= visibleEnd) return null

  // Convert minutes to grid rows (each row = 60 minutes)
  const rowStart =
    firstHourRowIndex + Math.floor((visibleStart - dayStartMinutes) / MINUTES_PER_ROW)
  const rowEnd = firstHourRowIndex + Math.ceil((visibleEnd - dayStartMinutes) / MINUTES_PER_ROW)

  return { rowStart, rowEnd: Math.max(rowEnd, rowStart + 1) }
}

interface WeekGridProps {
  events: CalendarEvent[]
  referenceDate: Date
  workingHours: WorkingHoursEntry[]
  selectedEventId: string | null
  onSelectEvent: (event: CalendarEvent | null) => void
}

export function WeekGrid({
  events,
  referenceDate,
  workingHours,
  selectedEventId,
  onSelectEvent,
}: WeekGridProps) {
  const weekDates = getWeekDates(referenceDate)
  const { minHour, maxHour } = getWeekBounds(workingHours, weekDates)
  const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i)

  const today = new Date()
  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()

  // Group events by date
  const eventsByDate = new Map<string, CalendarEvent[]>()
  const allDayEventsByDate = new Map<string, CalendarEvent[]>()

  for (const event of events) {
    const date = parseEventDate(event.start?.dateTime ?? event.start?.date)
    if (!date) continue

    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

    if (isAllDayEvent(event)) {
      if (!allDayEventsByDate.has(dateKey)) {
        allDayEventsByDate.set(dateKey, [])
      }
      allDayEventsByDate.get(dateKey)!.push(event)
    } else {
      if (!eventsByDate.has(dateKey)) {
        eventsByDate.set(dateKey, [])
      }
      eventsByDate.get(dateKey)!.push(event)
    }
  }

  const hasAllDayEvents = weekDates.some((date) => {
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return (allDayEventsByDate.get(dateKey)?.length ?? 0) > 0
  })

  const firstHourRowIndex = hasAllDayEvents ? 3 : 2

  return (
    <div
      className={`grid mx-6 mb-6 rounded bg-neutral-800 border border-neutral-800 overflow-hidden
        grid-cols-[auto_repeat(7,minmax(0,1fr))]
        ${hasAllDayEvents ? 'grid-rows-[auto_auto]' : 'grid-rows-[auto]'}
        auto-rows-fr`}
    >
      {/* Header row */}
      <div className='row-start-1 col-start-1 p-2 bg-neutral-900/80 border-b border-neutral-800' />
      {weekDates.map((date, idx) => (
        <div
          key={`header-${idx}`}
          className={`row-start-1 col-start-${
            idx + 2
          } p-2 text-center border-l border-b border-neutral-800 bg-neutral-900/80`}
        >
          <div className='text-xs font-bold text-neutral-500 uppercase'>{DAY_NAMES[idx]}</div>
          <div
            className={`text-lg font-semibold mt-1 ${
              isToday(date)
                ? 'bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto'
                : 'text-neutral-300'
            }`}
          >
            {date.getDate()}
          </div>
        </div>
      ))}

      {/* All-day events row */}
      {hasAllDayEvents && (
        <>
          <div className='row-start-2 col-start-1 bg-neutral-900/50 border-b border-neutral-800' />
          {weekDates.map((date, idx) => {
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            const dayAllDayEvents = allDayEventsByDate.get(dateKey) || []
            return (
              <div
                key={`allday-${idx}`}
                className={`row-start-2 col-start-${
                  idx + 2
                } p-1 border-l border-b border-neutral-800 min-h-8 flex flex-col gap-0.5 bg-neutral-900/50`}
              >
                {dayAllDayEvents.map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    isSelected={event.id === selectedEventId}
                    onSelect={onSelectEvent}
                    className='w-full'
                  />
                ))}
              </div>
            )
          })}
        </>
      )}

      {/* Time grid - hour cells */}
      {hours.map((hour, hourIdx) => {
        const rowStart = firstHourRowIndex + hourIdx
        return (
          <Fragment key={`row-${hour}`}>
            <div
              className={`row-start-${rowStart} col-start-1 border-b border-neutral-800 p-1 text-right text-xs text-neutral-500`}
            >
              {hour.toString().padStart(2, '0')}:00
            </div>
            {weekDates.map((_, dayIdx) => (
              <div
                key={`cell-${hour}-${dayIdx}`}
                className={`row-start-${rowStart} col-start-${
                  dayIdx + 2
                } border-b border-l border-neutral-800 bg-neutral-900 hover:bg-neutral-800/50 transition-colors`}
              />
            ))}
          </Fragment>
        )
      })}

      {/* Events - rendered on top of cells using grid positioning */}
      {weekDates.map((date, dayIdx) => {
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        const dayEvents = eventsByDate.get(dateKey) || []

        return dayEvents.map((event) => {
          const position = getEventGridPosition(event, minHour, maxHour, firstHourRowIndex)
          if (!position) return null

          return (
            <div
              key={event.id}
              className={`col-start-${dayIdx + 2} row-start-${position.rowStart} row-end-${
                position.rowEnd
              } px-1 py-0.5 min-w-0`}
            >
              <EventPill
                event={event}
                isSelected={event.id === selectedEventId}
                onSelect={onSelectEvent}
                className='w-full h-full'
              />
            </div>
          )
        })
      })}
    </div>
  )
}
