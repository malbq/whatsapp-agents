import { useRef, useState } from 'react'
import type { SidebarCalendar } from './types'

interface CalendarSidebarProps {
  calendars: SidebarCalendar[]
  appointmentCalendarId: string | null
  onSetAppointmentCalendar: (calendarId: string) => void
  onToggleCalendarEnabled: (calendarId: string, enabled: boolean) => void
  onCreateCalendar: () => void
  className?: string
  isOpen?: boolean
  onClose?: () => void
}

function PlusIcon() {
  return (
    <svg
      className='w-4 h-4'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
    >
      <path d='M12 5v14M5 12h14' />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      className='w-5 h-5'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line
        x1='18'
        y1='6'
        x2='6'
        y2='18'
      />
      <line
        x1='6'
        y1='6'
        x2='18'
        y2='18'
      />
    </svg>
  )
}

function CalendarIcon() {
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
        x1='16'
        y1='2'
        x2='16'
        y2='6'
      />
      <line
        x1='8'
        y1='2'
        x2='8'
        y2='6'
      />
      <line
        x1='3'
        y1='10'
        x2='21'
        y2='10'
      />
    </svg>
  )
}

interface CalendarItemProps {
  calendar: SidebarCalendar
  isAppointment: boolean
  onSetDefault: () => void
  onToggleEnabled: (enabled: boolean) => void
  style?: React.CSSProperties
}

function CalendarItem({ calendar, isAppointment, onSetDefault, onToggleEnabled, style }: CalendarItemProps) {
  const bgColor = calendar.backgroundColor || '#4285f4'
  // Appointment calendar is always enabled and cannot be toggled
  const isEnabled = isAppointment || calendar.enabled
  const canToggle = !isAppointment

  return (
    <div
      className={`group flex items-center gap-3 py-2 px-3 transition-colors ${
        isAppointment ? 'bg-amber-800/15' : 'hover:bg-neutral-800'
      }`}
      style={style}
    >
      <label className={`relative flex items-center ${canToggle ? 'cursor-pointer' : 'cursor-default'}`}>
        <input
          type='checkbox'
          checked={isEnabled}
          onChange={(e) => canToggle && onToggleEnabled(e.target.checked)}
          disabled={!canToggle}
          className='sr-only peer'
        />
        <div
          className='w-4 h-4 rounded-sm border-2 peer-checked:border-transparent peer-focus:ring-2 peer-focus:ring-offset-1 peer-focus:ring-offset-neutral-900 peer-focus:ring-neutral-500 transition-colors'
          style={{
            backgroundColor: isEnabled ? bgColor : 'transparent',
            borderColor: isEnabled ? 'transparent' : bgColor,
          }}
        >
          {isEnabled && (
            <svg
              className='w-full h-full text-white'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={3}
            >
              <path d='M5 13l4 4L19 7' />
            </svg>
          )}
        </div>
      </label>
      <span className={`flex-1 text-sm truncate ${isEnabled ? 'text-neutral-300' : 'text-neutral-500'}`}>
        {calendar.summary}
      </span>
      <button
        type='button'
        onClick={isAppointment ? undefined : onSetDefault}
        className={`p-1 rounded transition-all ${
          isAppointment
            ? 'text-neutral-300/40'
            : 'text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-amber-500'
        }`}
        title={
          isAppointment ? 'Calendário de agendamentos' : 'Definir como calendário de agendamentos'
        }
      >
        <CalendarIcon />
      </button>
    </div>
  )
}

interface AnimationState {
  newId: string
  itemHeight: number
  // Maps calendar ID to how many positions it should move (positive = down, negative = up)
  movements: Map<string, number>
}

const ANIMATION_DURATION = 150

export function CalendarSidebar({
  calendars,
  appointmentCalendarId,
  onSetAppointmentCalendar,
  onToggleCalendarEnabled,
  onCreateCalendar,
  className = '',
  isOpen,
  onClose,
}: CalendarSidebarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [animation, setAnimation] = useState<AnimationState | null>(null)

  // Sort calendars - appointment calendar goes first, rest keeps Google's order
  const sortedCalendars = [...calendars].toSorted((a, b) => {
    if (a.id === appointmentCalendarId) return -1
    if (b.id === appointmentCalendarId) return 1
    return 0
  })

  const handleSelect = (newCalendarId: string) => {
    if (appointmentCalendarId === newCalendarId) {
      return
    }

    // Measure item height from the container
    const firstItem = containerRef.current?.firstElementChild as HTMLElement | null
    const itemHeight = firstItem?.offsetHeight ?? 40

    // Compute final sorted order (what it will look like after state update)
    const finalSorted = [...calendars].toSorted((a, b) => {
      if (a.id === newCalendarId) return -1
      if (b.id === newCalendarId) return 1
      return 0
    })

    // Build a map of current index for each calendar
    const currentIndexMap = new Map(sortedCalendars.map((c, i) => [c.id, i]))
    const finalIndexMap = new Map(finalSorted.map((c, i) => [c.id, i]))

    // Calculate movements: finalIndex - currentIndex
    const movements = new Map<string, number>()
    for (const calendar of calendars) {
      const currentIdx = currentIndexMap.get(calendar.id) ?? 0
      const finalIdx = finalIndexMap.get(calendar.id) ?? 0
      const movement = finalIdx - currentIdx
      if (movement !== 0) {
        movements.set(calendar.id, movement)
      }
    }

    if (movements.size === 0) {
      onSetAppointmentCalendar(newCalendarId)
      return
    }

    setAnimation({
      newId: newCalendarId,
      itemHeight,
      movements,
    })

    // After animation, update the actual state
    setTimeout(() => {
      setAnimation(null)
      onSetAppointmentCalendar(newCalendarId)
    }, ANIMATION_DURATION)
  }

  const getItemStyle = (calendarId: string): React.CSSProperties => {
    if (!animation) return {}

    const { newId, itemHeight, movements } = animation
    const movement = movements.get(calendarId)

    if (movement === undefined) return {}

    return {
      transform: `translateY(${movement * itemHeight}px)`,
      transition: `transform ${ANIMATION_DURATION}ms ease-out`,
      zIndex: calendarId === newId ? 10 : 1,
      position: 'relative',
    }
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`bg-neutral-900 border-r border-neutral-800 transition-transform duration-300 ease-in-out z-40
          lg:translate-x-0 lg:static lg:h-auto
          fixed inset-y-0 left-0 w-80 h-full
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${className}`}
      >
        <div className='flex items-center justify-between px-4 py-3'>
          <span className='text-sm font-medium text-neutral-400 tracking-wide'>Calendários</span>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onCreateCalendar}
              className='p-1 rounded text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800 transition-colors'
              title='Criar novo calendario'
            >
              <PlusIcon />
            </button>
            {onClose && (
              <button
                type='button'
                onClick={onClose}
                className='p-1 rounded text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800 transition-colors lg:hidden'
                title='Fechar menu'
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
        <div className='text-xs text-amber-100/70 bg-amber-800/15 px-4 pt-2 uppercase font-medium tracking-wide'>
          Calendário de agendamentos
        </div>

        <div ref={containerRef}>
          {sortedCalendars.map((calendar) => (
            <CalendarItem
              key={calendar.id}
              calendar={calendar}
              isAppointment={calendar.id === (animation?.newId ?? appointmentCalendarId)}
              onSetDefault={() => handleSelect(calendar.id)}
              onToggleEnabled={(enabled) => onToggleCalendarEnabled(calendar.id, enabled)}
              style={getItemStyle(calendar.id)}
            />
          ))}
        </div>

        {calendars.length === 0 && (
          <p className='text-sm text-neutral-500 text-center py-4'>Nenhum calendario encontrado</p>
        )}
      </div>
    </>
  )
}
