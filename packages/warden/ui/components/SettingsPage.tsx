import { useLoaderData, useRouter } from '@tanstack/react-router'
import { useCallback, useState } from 'react'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface AvailabilitySettings {
  bufferMinutes: number
  minNoticeMinutes: number
  minRescheduleNoticeMinutes: number
  granularityMinutes: number
  maxDaysAhead: number
}

export interface WorkingHoursEntry {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface SettingsData {
  settings: AvailabilitySettings
  workingHours: WorkingHoursEntry[]
}

type ButtonState = 'idle' | 'saving' | 'success' | 'error'

function TrashIcon() {
  return (
    <svg
      className='w-4 h-4'
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
    >
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth={2}
        d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
      />
    </svg>
  )
}

export function SettingsPage() {
  const data = useLoaderData({ from: '/_app/settings' }) as SettingsData
  const router = useRouter()
  const [settings, setSettings] = useState<AvailabilitySettings>(data.settings)
  const [workingHours, setWorkingHours] = useState<WorkingHoursEntry[]>(data.workingHours)
  const [settingsButtonState, setSettingsButtonState] = useState<ButtonState>('idle')
  const [hoursButtonState, setHoursButtonState] = useState<ButtonState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSettingChange = <K extends keyof AvailabilitySettings>(
    key: K,
    value: AvailabilitySettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const showTemporaryState = useCallback(
    (
      setState: React.Dispatch<React.SetStateAction<ButtonState>>,
      state: 'success' | 'error',
      duration = 2000
    ) => {
      setState(state)
      setTimeout(() => setState('idle'), duration)
    },
    []
  )

  const handleSaveSettings = async () => {
    if (settingsButtonState !== 'idle') return

    setSettingsButtonState('saving')
    setErrorMessage(null)

    const res = await fetch('/api/availability/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })

    if (res.ok) {
      showTemporaryState(setSettingsButtonState, 'success')
    } else {
      const data = await res.json()
      setErrorMessage(data.error || 'Error saving settings')
      showTemporaryState(setSettingsButtonState, 'error')
    }
  }

  const handleAddWorkingHours = (dayOfWeek: number) => {
    setWorkingHours((prev) => [...prev, { dayOfWeek, startTime: '09:00', endTime: '17:00' }])
  }

  const handleRemoveWorkingHours = (index: number) => {
    setWorkingHours((prev) => prev.filter((_, i) => i !== index))
  }

  const handleWorkingHoursChange = (
    index: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setWorkingHours((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    )
  }

  const handleSaveWorkingHours = async () => {
    if (hoursButtonState !== 'idle') return

    setHoursButtonState('saving')
    setErrorMessage(null)

    const res = await fetch('/api/availability/working-hours', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        workingHours.map(({ dayOfWeek, startTime, endTime }) => ({
          dayOfWeek,
          startTime,
          endTime,
        }))
      ),
    })

    if (res.ok) {
      showTemporaryState(setHoursButtonState, 'success')
      router.invalidate()
    } else {
      const data = await res.json()
      setErrorMessage(data.error || 'Error saving working hours')
      showTemporaryState(setHoursButtonState, 'error')
    }
  }

  // Group working hours by day
  const workingHoursByDay = DAY_NAMES.map((name, dayOfWeek) => ({
    name,
    dayOfWeek,
    entries: workingHours
      .map((entry, index) => ({ ...entry, index }))
      .filter((entry) => entry.dayOfWeek === dayOfWeek),
  }))

  return (
    <div className='p-4 md:p-6 space-y-6'>
      {errorMessage && (
        <div className='p-4 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20'>
          {errorMessage}
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div>
          <h2 className='text-lg font-semibold text-neutral-100'>Working Hours</h2>
          <p className='text-sm text-neutral-400 mb-6'>
            Set availability intervals for each day of the week. You can add
            multiple intervals per day (e.g. morning and afternoon).
          </p>

          <div className='border border-neutral-800 rounded-lg divide-y divide-neutral-800 bg-neutral-900/30'>
            {workingHoursByDay.map(({ name, dayOfWeek, entries }) => (
              <div
                key={dayOfWeek}
                className='p-3 md:p-4'
              >
                <div className='flex items-center justify-between'>
                  <h3 className='font-medium text-neutral-200'>{name}</h3>
                  <button
                    onClick={() => handleAddWorkingHours(dayOfWeek)}
                    className='text-xs px-3 py-1 bg-neutral-800 text-neutral-300 rounded-full hover:bg-neutral-700 transition-colors'
                  >
                    <span className="hidden sm:inline">+ Add interval</span>
                    <span className="sm:hidden">+ Add</span>
                  </button>
                </div>

                {entries.length > 0 && (
                  <div className='space-y-2 mt-3'>
                    {entries.map((entry) => (
                      <div
                        key={entry.index}
                        className='flex flex-wrap sm:flex-nowrap items-center gap-2'
                      >
                        <input
                          type='time'
                          value={entry.startTime}
                          onChange={(e) =>
                            handleWorkingHoursChange(entry.index, 'startTime', e.target.value)
                          }
                          className='time-input flex-1 sm:flex-none w-auto sm:w-32 px-2 md:px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-100 text-sm focus:outline-none focus:border-primary'
                        />
                        <span className='text-neutral-500 text-xs sm:text-base'>to</span>
                        <input
                          type='time'
                          value={entry.endTime}
                          onChange={(e) =>
                            handleWorkingHoursChange(entry.index, 'endTime', e.target.value)
                          }
                          className='time-input flex-1 sm:flex-none w-auto sm:w-32 px-2 md:px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-100 text-sm focus:outline-none focus:border-primary'
                        />
                        <button
                          onClick={() => handleRemoveWorkingHours(entry.index)}
                          className='p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors shrink-0'
                          title='Remove'
                        >
                          <span className='sr-only'>Remove</span>
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className='mt-6'>
            <button
              onClick={handleSaveWorkingHours}
              disabled={hoursButtonState !== 'idle'}
              className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${
                hoursButtonState === 'success'
                  ? 'bg-green-600 text-white'
                  : hoursButtonState === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50'
              }`}
            >
              {hoursButtonState === 'saving'
                ? 'Saving...'
                : hoursButtonState === 'success'
                ? 'Saved!'
                : hoursButtonState === 'error'
                ? 'Error'
                : 'Save Working Hours'}
            </button>
          </div>
        </div>
        <div>
          <h2 className='text-lg font-semibold text-neutral-100 mb-4'>General Settings</h2>

          <div className='space-y-5'>
            <div>
              <label className='block text-sm font-medium text-neutral-300 mb-2'>
                How many days ahead to show
              </label>
              <input
                type='number'
                min={1}
                max={90}
                value={settings.maxDaysAhead}
                onChange={(e) =>
                  handleSettingChange('maxDaysAhead', parseInt(e.target.value) || 14)
                }
                className='w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-primary'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-neutral-300 mb-2'>
                Minimum notice for new appointments (minutes)
              </label>
              <input
                type='number'
                min={0}
                max={10080}
                value={settings.minNoticeMinutes}
                onChange={(e) =>
                  handleSettingChange('minNoticeMinutes', parseInt(e.target.value) || 0)
                }
                className='w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-primary'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-neutral-300 mb-2'>
                Minimum notice for rescheduling (minutes)
              </label>
              <input
                type='number'
                min={0}
                max={10080}
                value={settings.minRescheduleNoticeMinutes}
                onChange={(e) =>
                  handleSettingChange('minRescheduleNoticeMinutes', parseInt(e.target.value) || 0)
                }
                className='w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-primary'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-neutral-300 mb-2'>
                Interval between available times (minutes)
              </label>
              <select
                value={settings.granularityMinutes}
                onChange={(e) =>
                  handleSettingChange('granularityMinutes', parseInt(e.target.value) || 60)
                }
                className='w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-primary'
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={120}>120 minutes</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-neutral-300 mb-2'>
                Buffer before and after each appointment (minutes)
              </label>
              <input
                type='number'
                min={0}
                max={120}
                value={settings.bufferMinutes}
                onChange={(e) =>
                  handleSettingChange('bufferMinutes', parseInt(e.target.value) || 0)
                }
                className='w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-primary'
              />
            </div>
          </div>

          <div className='mt-6'>
            <button
              onClick={handleSaveSettings}
              disabled={settingsButtonState !== 'idle'}
              className={`px-6 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${
                settingsButtonState === 'success'
                  ? 'bg-green-600 text-white'
                  : settingsButtonState === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-primary text-white hover:bg-primary/90 disabled:opacity-50'
              }`}
            >
              {settingsButtonState === 'saving'
                ? 'Saving...'
                : settingsButtonState === 'success'
                ? 'Saved!'
                : settingsButtonState === 'error'
                ? 'Error'
                : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
