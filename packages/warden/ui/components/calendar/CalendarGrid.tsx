import { parseEventDate } from './dateUtils'
import { EventPill } from './EventPill'
import type { CalendarEvent } from './types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface MonthGridProps {
  events: CalendarEvent[]
  currentMonth: Date
  selectedEventId: string | null
  onSelectEvent: (event: CalendarEvent | null) => void
}

export function MonthGrid({
  events,
  currentMonth,
  selectedEventId,
  onSelectEvent,
}: MonthGridProps) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  // Group events by day (using browser's local timezone)
  const eventsByDay = new Map<number, CalendarEvent[]>()
  for (const event of events) {
    const date = parseEventDate(event.start?.dateTime ?? event.start?.date)
    if (date) {
      if (date.getMonth() === month && date.getFullYear() === year) {
        const day = date.getDate()
        if (!eventsByDay.has(day)) {
          eventsByDay.set(day, [])
        }
        eventsByDay.get(day)!.push(event)
      }
    }
  }

  // Sort events within each day by start time
  for (const [day, dayEvents] of eventsByDay) {
    dayEvents.sort((a, b) => {
      const aTime = a.start?.dateTime || a.start?.date || ''
      const bTime = b.start?.dateTime || b.start?.date || ''
      return aTime.localeCompare(bTime)
    })
    eventsByDay.set(day, dayEvents)
  }

  const days: (number | null)[] = []
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const today = new Date()
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div
      className={
        'grid grid-cols-7 grid-rows-[auto] auto-rows-fr mx-2 md:mx-6 mb-2 md:mb-6 gap-px rounded bg-neutral-800 border border-neutral-800'
      }
    >
      {DAY_NAMES.map((name) => (
        <div
          key={name}
          className='bg-neutral-900/80 p-1 md:p-2 text-center text-[10px] md:text-xs font-bold text-neutral-500 uppercase'
        >
          {name}
        </div>
      ))}
      {days.map((day, idx) =>
        day === null ? (
          <div
            key={`empty-${idx}`}
            className='bg-neutral-950'
          />
        ) : (
          <div
            key={day}
            className={`bg-neutral-900 p-1 md:p-2 relative group hover:bg-neutral-800 transition-colors min-h-[80px] md:min-h-[120px] ${
              isToday(day) ? 'bg-primary/5' : ''
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-5 h-5 md:w-7 md:h-7 text-xs md:text-sm font-semibold rounded-full mb-1 md:mb-2 ${
                isToday(day)
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-neutral-300 group-hover:bg-neutral-700'
              }`}
            >
              {day}
            </span>
              <div className='flex flex-col gap-1'>
                {eventsByDay
                  .get(day)
                  ?.slice(0, 4)
                  .map((event) => (
                    <EventPill
                      key={event.id}
                      event={event}
                      isSelected={event.id === selectedEventId}
                      onSelect={onSelectEvent}
                      className='w-full text-[10px] md:text-xs truncate'
                    />
                  ))}
                {(eventsByDay.get(day)?.length ?? 0) > 4 && (
                <div className='text-[10px] text-neutral-500 font-medium px-1 md:px-2 py-0.5'>
                  <span className='md:hidden'>+{(eventsByDay.get(day)!.length - 4)}</span>
                  <span className='hidden md:inline'>+{eventsByDay.get(day)!.length - 4} more</span>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}

/** @deprecated Use MonthGrid instead */
export const CalendarGrid = MonthGrid
