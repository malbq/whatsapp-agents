import type { CalendarEvent } from './types'

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
      <path d='M18 6L6 18M6 6l12 12' />
    </svg>
  )
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTimeRange(event: CalendarEvent): string {
  const isAllDay = event.start?.date && !event.start?.dateTime

  if (isAllDay) {
    return formatDate(event.start?.date)
  }

  const startStr = event.start?.dateTime
  const endStr = event.end?.dateTime
  if (!startStr) return '-'

  const start = new Date(startStr)
  const startTime = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (!endStr) {
    return `${formatDate(startStr)} at ${startTime}`
  }

  const end = new Date(endStr)
  const endTime = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

  // Check if same day
  if (start.toDateString() === end.toDateString()) {
    return `${formatDate(startStr)} • ${startTime} - ${endTime}`
  }

  return `${formatDateTime(startStr)} - ${formatDateTime(endStr)}`
}

function formatStatus(status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'): string {
  const statusMap: Record<typeof status, string> = {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
  }
  return statusMap[status]
}

interface DetailRowProps {
  label: string
  value: string | undefined | null
}

function DetailRow({ label, value }: DetailRowProps) {
  if (!value) return null
  return (
    <div className='py-3 border-b border-neutral-800'>
      <div className='text-xs text-neutral-500 uppercase tracking-wide mb-1'>{label}</div>
      <div className='text-sm text-neutral-200'>{value}</div>
    </div>
  )
}

interface AppointmentDetailsPanelProps {
  event: CalendarEvent
  onClose: () => void
  className?: string
}

export function AppointmentDetailsPanel({ event, onClose, className }: AppointmentDetailsPanelProps) {
  const bgColor = event.backgroundColor || '#4285f4'

  return (
    <div className={`bg-neutral-900 border-l border-neutral-800 h-full flex flex-col shadow-xl lg:shadow-none ${className ?? ''}`}>
      {/* Header */}
      <div className='flex items-start justify-between p-4 border-b border-neutral-800'>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-1'>
            <div
              className='w-3 h-3 rounded-sm flex-shrink-0'
              style={{ backgroundColor: bgColor }}
            />
            <span className='text-xs text-neutral-500 uppercase tracking-wide'>
              {event.isAppointmentCalendar ? 'Appointment' : 'Event'}
            </span>
          </div>
          <h3 className='text-lg font-semibold text-neutral-100 truncate'>
            {event.summary || 'Untitled'}
          </h3>
        </div>
        <button
          type='button'
          onClick={onClose}
          className='p-1 rounded text-neutral-400 hover:text-neutral-300 hover:bg-neutral-800 transition-colors flex-shrink-0'
          title='Close'
        >
          <CloseIcon />
        </button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-4'>
        {event.appointment && (
          <>
            <DetailRow
              label='Customer'
              value={event.appointment.customerName}
            />
            <DetailRow
              label='Phone'
              value={event.appointment.customerPhone}
            />
            <DetailRow
              label='Service'
              value={event.appointment.serviceName}
            />
            <DetailRow
              label='Status'
              value={formatStatus(event.appointment.status)}
            />
          </>
        )}
        <DetailRow
          label='Time'
          value={formatTimeRange(event)}
        />
        <DetailRow
          label='Description'
          value={event.description}
        />
      </div>
    </div>
  )
}
