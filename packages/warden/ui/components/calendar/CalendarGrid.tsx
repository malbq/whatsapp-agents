import type { CalendarEvent } from './types'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

function formatEventTime(event: CalendarEvent): string {
  const startStr = event.start?.dateTime
  if (!startStr) return ''
  const date = new Date(startStr)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent))
  const g = Math.min(
    255,
    Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * percent)
  )
  const b = Math.min(255, Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * percent))
  return `rgb(${r}, ${g}, ${b})`
}

function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

function getRelativeLuminance(hex: string): number {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) / 255
  const g = ((num >> 8) & 0x00ff) / 255
  const b = (num & 0x0000ff) / 255

  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

interface EventPillProps {
  event: CalendarEvent
}

function EventPill({ event }: EventPillProps) {
  const bgColor = event.backgroundColor || '#4285f4'
  const isAppointment = event.isAppointmentCalendar

  // For dark mode, use the color with 20% opacity for background
  // and ensure the text color is bright enough
  const pillBg = hexToRgba(bgColor, 0.15)
  const luminance = getRelativeLuminance(bgColor)
  const textColor = luminance < 0.4 ? lightenColor(bgColor, 0.6) : bgColor

  return (
    <div
      className={`text-[10px] px-2 py-1 rounded font-semibold whitespace-nowrap overflow-hidden text-ellipsis transition-all hover:bg-opacity-30 ${
        isAppointment ? 'border-l-[3px]' : 'border-l-2'
      }`}
      style={{ background: pillBg, color: textColor, borderLeftColor: bgColor }}
      title={event.summary}
    >
      <span className='opacity-60 mr-1 font-normal'>{formatEventTime(event)}</span>
      {event.summary}
    </div>
  )
}

interface CalendarGridProps {
  events: CalendarEvent[]
  currentMonth: Date
  onMonthChange: (month: Date) => void
  isLoading?: boolean
}

export function CalendarGrid({
  events,
  currentMonth,
  onMonthChange,
  isLoading = false,
}: CalendarGridProps) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const prevMonth = new Date(year, month - 1, 1)
  const nextMonth = new Date(year, month + 1, 1)

  // Group events by day
  const eventsByDay = new Map<number, CalendarEvent[]>()
  for (const event of events) {
    const startStr = event.start?.dateTime || event.start?.date
    if (startStr) {
      const date = new Date(startStr)
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
    <div>
      <div className='bg-neutral-900 rounded p-8 border border-neutral-800 shadow-sm'>
        <div className='flex items-center justify-between mb-8'>
          <h2 className='text-2xl text-neutral-100 font-bold flex items-center gap-3'>
            <div className='flex items-baseline gap-2'>
              {MONTH_NAMES[month]}
              <span className='text-neutral-500 font-normal'>{year}</span>
            </div>
            {isLoading && (
              <svg
                className='animate-spin h-5 w-5 text-primary'
                viewBox='0 0 24 24'
                fill='none'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                />
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                />
              </svg>
            )}
          </h2>
          <div className='flex gap-2'>
            <button
              type='button'
              className='w-9 h-9 border border-neutral-800 rounded-lg bg-neutral-900 cursor-pointer flex items-center justify-center transition-all hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400'
              onClick={() => onMonthChange(prevMonth)}
            >
              <svg
                className='w-5 h-5'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path d='M15 18l-6-6 6-6' />
              </svg>
            </button>
            <button
              type='button'
              className='w-9 h-9 border border-neutral-800 rounded-lg bg-neutral-900 cursor-pointer flex items-center justify-center transition-all hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400'
              onClick={() => onMonthChange(nextMonth)}
            >
              <svg
                className='w-5 h-5'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth={2}
              >
                <path d='M9 18l6-6-6-6' />
              </svg>
            </button>
          </div>
        </div>

        <div
          className={`grid grid-cols-7 gap-px bg-neutral-800 rounded-xl overflow-hidden border border-neutral-800 transition-opacity ${
            isLoading ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className='bg-neutral-900/80 py-4 px-2 text-center text-[11px] font-bold text-neutral-500 uppercase tracking-wider'
            >
              {name}
            </div>
          ))}
          {days.map((day, idx) =>
            day === null ? (
              <div
                key={`empty-${idx}`}
                className='bg-neutral-900/30 min-h-[120px] p-2'
              />
            ) : (
              <div
                key={day}
                className={`bg-neutral-900 min-h-[120px] p-3 relative group hover:bg-neutral-800 transition-colors ${
                  isToday(day) ? 'bg-primary/5' : ''
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-7 h-7 text-sm font-semibold rounded-full mb-2 ${
                    isToday(day)
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-neutral-300 group-hover:bg-neutral-700'
                  }`}
                >
                  {day}
                </span>
                <div className='flex flex-col gap-1.5'>
                  {eventsByDay
                    .get(day)
                    ?.slice(0, 4)
                    .map((event) => (
                      <EventPill
                        key={event.id}
                        event={event}
                      />
                    ))}
                  {(eventsByDay.get(day)?.length ?? 0) > 4 && (
                    <div className='text-[10px] text-neutral-500 font-medium px-2 py-0.5'>
                      +{eventsByDay.get(day)!.length - 4} mais
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
