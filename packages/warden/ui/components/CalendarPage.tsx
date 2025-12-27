import { useLoaderData, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ConnectPrompt } from './ConnectPrompt'
import { CalendarGrid } from './calendar/CalendarGrid'
import { CalendarSidebar } from './calendar/CalendarSidebar'
import { CreateCalendarModal } from './calendar/CreateCalendarModal'
import type { CalendarData, CalendarResponse } from './calendar/types'

export function CalendarPage() {
  const data = useLoaderData({ from: '/_app/calendar' }) as CalendarResponse
  const navigate = useNavigate()
  const router = useRouter()
  const isLoading = useRouterState({ select: (s) => s.status === 'pending' })

  const [isModalOpen, setIsModalOpen] = useState(false)

  const [optimisticAppointmentCalendarId, setOptimisticAppointmentCalendarId] = useState<
    string | null | undefined
  >(undefined)

  useEffect(() => {
    setOptimisticAppointmentCalendarId(undefined)
  }, [data])

  if (!data.connected) {
    return (
      <div className='max-w-[1200px] mx-auto p-8'>
        <ConnectPrompt />
      </div>
    )
  }

  const calendarData = data as CalendarData
  const currentMonth = new Date(calendarData.currentMonth)

  const calendars = calendarData.calendars
  const appointmentCalendarId =
    optimisticAppointmentCalendarId !== undefined
      ? optimisticAppointmentCalendarId
      : calendarData.appointmentCalendarId

  const handleMonthChange = (newMonth: Date) => {
    navigate({
      to: '/calendar',
      search: { month: newMonth.toISOString() },
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

  const handleCreateCalendar = async (formData: { name: string; description?: string }) => {
    const res = await fetch('/api/calendar/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Erro ao criar calendário')
    }
    await router.invalidate()
  }

  return (
    <div className='max-w-[1400px] mx-auto'>
      <div className='flex gap-2'>
        <CalendarSidebar
          calendars={calendars}
          appointmentCalendarId={appointmentCalendarId}
          onSetAppointmentCalendar={handleSetAppointmentCalendar}
          onCreateCalendar={() => setIsModalOpen(true)}
        />
        <div className='flex-1'>
          <CalendarGrid
            events={calendarData.events}
            currentMonth={currentMonth}
            onMonthChange={handleMonthChange}
            isLoading={isLoading}
          />
        </div>
      </div>

      <CreateCalendarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCalendar}
      />
    </div>
  )
}
