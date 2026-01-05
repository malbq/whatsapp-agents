import { useState } from 'react'

interface CreateTimeOffModalProps {
  isOpen: boolean
  defaultCalendarId: string | null
  onClose: () => void
  onSubmit: (data: {
    calendarId: string
    summary: string
    startDate: string
    endDate: string
    description?: string
  }) => Promise<void>
}

function XIcon() {
  return (
    <svg
      className='w-5 h-5'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
    >
      <path d='M18 6L6 18M6 6l12 12' />
    </svg>
  )
}

export function CreateTimeOffModal({
  isOpen,
  defaultCalendarId,
  onClose,
  onSubmit,
}: CreateTimeOffModalProps) {
  const [summary, setSummary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!defaultCalendarId) {
      setError('Nenhum calendário padrão configurado')
      return
    }

    if (!summary.trim()) {
      setError('Título é obrigatório')
      return
    }

    if (!startDate) {
      setError('Data de início é obrigatória')
      return
    }

    if (!endDate) {
      setError('Data de fim é obrigatória')
      return
    }

    // End date should be after start date
    if (endDate < startDate) {
      setError('Data de fim deve ser após a data de início')
      return
    }

    // Convert to exclusive end date (add one day)
    const exclusiveEndDate = new Date(endDate)
    exclusiveEndDate.setDate(exclusiveEndDate.getDate() + 1)
    const exclusiveEndDateStr = exclusiveEndDate.toISOString().split('T')[0]!

    setIsSubmitting(true)
    try {
      await onSubmit({
        calendarId: defaultCalendarId,
        summary: summary.trim(),
        startDate,
        endDate: exclusiveEndDateStr,
        description: description.trim() || undefined,
      })
      // Reset form
      setSummary('')
      setStartDate('')
      setEndDate('')
      setDescription('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar evento')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0]

  return (
    <div
      className='fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'
      onClick={handleBackdropClick}
    >
      <div className='bg-neutral-900 rounded-2xl shadow-xl w-full max-w-md border border-neutral-800'>
        <div className='flex items-center justify-between p-6 border-b border-neutral-800'>
          <h2 className='text-lg font-semibold text-neutral-100'>Folga / Ausência</h2>
          <button
            type='button'
            onClick={onClose}
            className='p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors'
          >
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          {error && (
            <div className='p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm'>
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor='timeoff-summary'
              className='block text-sm font-medium text-neutral-400 mb-1.5'
            >
              Título *
            </label>
            <input
              id='timeoff-summary'
              type='text'
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className='w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all'
              placeholder='Ex: Férias, Feriado, Consulta médica...'
              autoFocus
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='timeoff-start'
                className='block text-sm font-medium text-neutral-400 mb-1.5'
              >
                Data início *
              </label>
              <input
                id='timeoff-start'
                type='date'
                value={startDate}
                min={today}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  // Auto-set end date if not set or if it's before new start
                  if (!endDate || endDate < e.target.value) {
                    setEndDate(e.target.value)
                  }
                }}
                className='w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all'
              />
            </div>

            <div>
              <label
                htmlFor='timeoff-end'
                className='block text-sm font-medium text-neutral-400 mb-1.5'
              >
                Data fim *
              </label>
              <input
                id='timeoff-end'
                type='date'
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                className='w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all'
              />
            </div>
          </div>

          <div>
            <label
              htmlFor='timeoff-description'
              className='block text-sm font-medium text-neutral-400 mb-1.5'
            >
              Observações
            </label>
            <textarea
              id='timeoff-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none'
              placeholder='Observações opcionais'
              rows={2}
            />
          </div>

          <div className='flex gap-3 pt-2'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-4 py-2.5 border border-neutral-700 rounded-xl text-neutral-300 font-medium hover:bg-neutral-800 transition-colors'
            >
              Cancelar
            </button>
            <button
              type='submit'
              disabled={isSubmitting}
              className='flex-1 px-4 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
