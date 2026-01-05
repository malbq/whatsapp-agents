import type { CalendarView } from './types'

interface ViewSwitcherProps {
  currentView: CalendarView
  onViewChange: (view: CalendarView) => void
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  return (
    <div className='flex rounded-lg bg-neutral-800 p-0.5'>
      <button
        type='button'
        onClick={() => onViewChange('week')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          currentView === 'week'
            ? 'bg-neutral-700 text-neutral-100'
            : 'text-neutral-400 hover:text-neutral-300'
        }`}
      >
        Semana
      </button>
      <button
        type='button'
        onClick={() => onViewChange('month')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          currentView === 'month'
            ? 'bg-neutral-700 text-neutral-100'
            : 'text-neutral-400 hover:text-neutral-300'
        }`}
      >
        Mês
      </button>
    </div>
  )
}
