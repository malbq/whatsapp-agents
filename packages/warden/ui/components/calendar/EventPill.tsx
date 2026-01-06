import type { CalendarEvent } from './types'

function formatEventTime(event: CalendarEvent): string {
  const startStr = event.start?.dateTime
  if (!startStr) return ''
  const date = new Date(startStr)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

interface EventPillProps {
  event: CalendarEvent
  isSelected: boolean
  onSelect: (event: CalendarEvent) => void
  className?: string
  style?: React.CSSProperties
}

export function EventPill({ event, isSelected, onSelect, className = '', style }: EventPillProps) {
  const bgColor = event.backgroundColor || '#4285f4'

  return (
    <button
      type='button'
      onClick={() => onSelect(event)}
      className={`block min-w-0 text-xs px-2 py-1 rounded truncate transition-all hover:brightness-110 text-left ${
        event.isAppointmentCalendar ? 'border-l-[3px]' : 'border-l-2'
      } ${
        isSelected ? 'ring-2 ring-primary ring-offset-1 ring-offset-neutral-900' : ''
      } ${className}`}
      style={{
        background: `color-mix(in srgb, ${bgColor} ${isSelected ? '35%' : '20%'}, transparent)`,
        color: `color-mix(in srgb, ${bgColor} 40%, white)`,
        borderLeftColor: bgColor,
        ...style,
      }}
      title={event.summary}
    >
      <div className='flex items-center gap-1 overflow-hidden'>
        <span className='opacity-60 font-normal whitespace-nowrap'>{formatEventTime(event)}</span>
        <span className='font-semibold truncate'>{event.summary}</span>
      </div>
    </button>
  )
}
