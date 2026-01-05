import type { CalendarView } from './types'
import { ViewSwitcher } from './ViewSwitcher'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
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

function TimeOffIcon() {
  return (
    <svg
      className='w-4 h-4'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect
        x='3'
        y='4'
        width='18'
        height='18'
        rx='2'
        ry='2'
      />
      <line
        x1='3'
        y1='10'
        x2='21'
        y2='10'
      />
      <path d='M8 14h.01M12 14h.01M16 14h.01' />
    </svg>
  )
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const dayOfWeek = date.getDay()
  const start = new Date(date)
  start.setDate(date.getDate() - dayOfWeek)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

function formatWeekRange(date: Date): string {
  const { start, end } = getWeekRange(date)
  const startDay = start.getDate()
  const endDay = end.getDate()

  if (start.getMonth() === end.getMonth()) {
    // Same month: "15 - 21 Dezembro 2024"
    return `${startDay} - ${endDay} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`
  }

  if (start.getFullYear() === end.getFullYear()) {
    // Different months, same year: "28 Dez - 3 Jan 2025"
    const startMonth = MONTH_NAMES[start.getMonth()]?.slice(0, 3)
    const endMonth = MONTH_NAMES[end.getMonth()]?.slice(0, 3)
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${start.getFullYear()}`
  }

  // Different years: "28 Dez 2024 - 3 Jan 2025"
  const startMonth = MONTH_NAMES[start.getMonth()]?.slice(0, 3)
  const endMonth = MONTH_NAMES[end.getMonth()]?.slice(0, 3)
  return `${startDay} ${startMonth} ${start.getFullYear()} - ${endDay} ${endMonth} ${end.getFullYear()}`
}

interface CalendarHeadingProps {
  referenceDate: Date
  currentView: CalendarView
  onNavigate: (date: Date) => void
  onViewChange: (view: CalendarView) => void
  onCreateTimeOff: () => void
}

export function CalendarHeading({
  referenceDate,
  currentView,
  onNavigate,
  onViewChange,
  onCreateTimeOff,
}: CalendarHeadingProps) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()

  const handlePrev = () => {
    if (currentView === 'week') {
      const prevWeek = new Date(referenceDate)
      prevWeek.setDate(referenceDate.getDate() - 7)
      onNavigate(prevWeek)
    } else {
      onNavigate(new Date(year, month - 1, 1))
    }
  }

  const handleNext = () => {
    if (currentView === 'week') {
      const nextWeek = new Date(referenceDate)
      nextWeek.setDate(referenceDate.getDate() + 7)
      onNavigate(nextWeek)
    } else {
      onNavigate(new Date(year, month + 1, 1))
    }
  }

  const handleToday = () => {
    onNavigate(new Date())
  }

  const displayText =
    currentView === 'week' ? formatWeekRange(referenceDate) : `${MONTH_NAMES[month]} ${year}`

  return (
    <div className='flex items-center p-6 justify-between'>
      <div className='flex items-center gap-4'>
        <button
          type='button'
          onClick={handleToday}
          className='px-3 py-1.5 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium text-neutral-300 transition-colors'
        >
          Hoje
        </button>
        <div className='flex gap-1'>
          <button
            type='button'
            className='w-8 h-8 rounded-full flex items-center justify-center transition-all hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400'
            onClick={handlePrev}
          >
            <svg
              className='w-6 h-6'
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
            className='w-8 h-8 rounded-full flex items-center justify-center transition-all hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400'
            onClick={handleNext}
          >
            <svg
              className='w-6 h-6'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2}
            >
              <path d='M9 18l6-6-6-6' />
            </svg>
          </button>
        </div>
        <h2 className='text-xl text-neutral-100 font-bold'>{displayText}</h2>
      </div>
      <div className='flex items-center gap-2'>
        <ViewSwitcher
          currentView={currentView}
          onViewChange={onViewChange}
        />
        <button
          type='button'
          onClick={onCreateTimeOff}
          className='flex items-center justify-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm font-medium transition-colors'
        >
          <TimeOffIcon />
          Adicionar Folga
        </button>
      </div>
    </div>
  )
}
