import {
  useLoaderData,
  useNavigate,
  useRouter,
  useRouterState,
  useSearch,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ConnectPrompt } from './ConnectPrompt'
import { AppointmentDetailsPanel } from './calendar/AppointmentDetailsPanel'
import { MonthGrid } from './calendar/CalendarGrid'
import { CalendarHeading } from './calendar/CalendarHeading'
import { CalendarSidebar } from './calendar/CalendarSidebar'
import { CreateCalendarModal } from './calendar/CreateCalendarModal'
import { CreateTimeOffModal } from './calendar/CreateTimeOffModal'
import { WeekGrid } from './calendar/WeekGrid'
import type {
  CalendarData,
  CalendarEvent,
  CalendarResponse,
  CalendarView,
  SidebarCalendar,
} from './calendar/types'

export function CalendarPage() {
  const data = useLoaderData({ from: '/_app/' }) as CalendarResponse
  const search = useSearch({ from: '/_app/' }) as { month?: string; view?: CalendarView }
  const navigate = useNavigate()
  const router = useRouter()
  const isLoading = useRouterState({ select: (s) => s.status === 'pending' })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [optimisticAppointmentCalendarId, setOptimisticAppointmentCalendarId] = useState<
    string | null | undefined
  >(undefined)

  // Track optimistic enabled state changes: Map<calendarId, enabled>
  const [optimisticEnabledState, setOptimisticEnabledState] = useState<Map<string, boolean>>(
    new Map()
  )

  const currentView: CalendarView = search.view || 'month'

  useEffect(() => {
    setOptimisticAppointmentCalendarId(undefined)
    setOptimisticEnabledState(new Map())
  }, [data])

  // Clear selected event when data changes (month navigation, etc.)
  useEffect(() => {
    setSelectedEvent(null)
  }, [data])

  if (!data.connected) {
    return (
      <div className="max-w-[1200px] mx-auto p-8">
        <ConnectPrompt />
      </div>
    )
  }

  const calendarData = data as CalendarData
  // Use today as default if no month param, otherwise use the param
  const referenceDate = search.month ? new Date(search.month) : new Date()
  const currentMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)

  // Apply optimistic enabled state to calendars
  const calendars: SidebarCalendar[] = calendarData.calendars.map((cal) => {
    const optimisticEnabled = optimisticEnabledState.get(cal.id)
    return optimisticEnabled !== undefined ? { ...cal, enabled: optimisticEnabled } : cal
  })
  const appointmentCalendarId =
    optimisticAppointmentCalendarId !== undefined
      ? optimisticAppointmentCalendarId
      : calendarData.appointmentCalendarId

  const handleNavigate = (newDate: Date) => {
    navigate({
      to: '/',
      search: { month: newDate.toISOString(), view: currentView },
    })
  }

  const handleViewChange = (view: CalendarView) => {
    // When switching views, keep the current reference date
    navigate({
      to: '/',
      search: { month: search.month, view },
    })
  }

  const handleSetAppointmentCalendar = (calendarId: string) => {
    // Optimistic update - update UI immediately
    setOptimisticAppointmentCalendarId(calendarId)

    // Fire and forget - let router.invalidate() sync in background
    fetch('/api/calendar/settings/appointment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId }),
    }).then(() => router.invalidate())
  }

  const handleToggleCalendarEnabled = (calendarId: string, enabled: boolean) => {
    // Optimistic update - update UI immediately
    setOptimisticEnabledState((prev) => new Map(prev).set(calendarId, enabled))

    // Fire and forget - let router.invalidate() sync in background
    fetch(`/api/calendar/visibility/${encodeURIComponent(calendarId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then(() => router.invalidate())
  }

  const handleCreateCalendar = async (formData: { name: string; description?: string }) => {
    const res = await fetch('/api/calendar/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error creating calendar')
    }
    await router.invalidate()
  }

  const handleCreateTimeOff = async (formData: {
    calendarId: string
    summary: string
    startDate: string
    endDate: string
    description?: string
  }) => {
    const res = await fetch('/api/calendar/events/all-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error creating time off')
    }
    await router.invalidate()
  }

  const handleSelectEvent = (event: CalendarEvent | null) => {
    setSelectedEvent(event)
  }

  const handleCloseDetails = () => {
    setSelectedEvent(null)
  }

  // Dynamic grid columns based on whether details panel is shown
  const gridCols = selectedEvent ? 'lg:grid-cols-[280px_1fr_320px]' : 'lg:grid-cols-[280px_1fr]'

  return (
    <>
      <div
        className={`grid grid-cols-1 ${gridCols} grid-rows-[auto_1fr] h-full transition-all ${
          isLoading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <CalendarSidebar
          calendars={calendars}
          appointmentCalendarId={appointmentCalendarId}
          onSetAppointmentCalendar={handleSetAppointmentCalendar}
          onToggleCalendarEnabled={handleToggleCalendarEnabled}
          onCreateCalendar={() => setIsModalOpen(true)}
          className="lg:block row-span-2"
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <CalendarHeading
          referenceDate={referenceDate}
          currentView={currentView}
          onNavigate={handleNavigate}
          onViewChange={handleViewChange}
          onCreateTimeOff={() => setIsTimeOffModalOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />
        {selectedEvent && (
          <AppointmentDetailsPanel
            event={selectedEvent}
            onClose={handleCloseDetails}
            className="fixed inset-0 z-50 lg:static lg:z-auto row-span-2"
          />
        )}
        {currentView === 'month' ? (
          <MonthGrid
            events={calendarData.events}
            currentMonth={currentMonth}
            selectedEventId={selectedEvent?.id ?? null}
            onSelectEvent={handleSelectEvent}
          />
        ) : (
          <WeekGrid
            events={calendarData.events}
            referenceDate={referenceDate}
            workingHours={calendarData.workingHours}
            selectedEventId={selectedEvent?.id ?? null}
            onSelectEvent={handleSelectEvent}
          />
        )}
      </div>

      <CreateCalendarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCalendar}
      />

      <CreateTimeOffModal
        isOpen={isTimeOffModalOpen}
        defaultCalendarId={appointmentCalendarId}
        onClose={() => setIsTimeOffModalOpen(false)}
        onSubmit={handleCreateTimeOff}
      />
    </>
  )
}
