import { useLoaderData, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

export interface Service {
  id: string
  name: string
  description?: string
  durationMinutes: number
}

export interface ServicesData {
  services: Service[]
}

interface ServiceFormData {
  name: string
  description: string
  durationMinutes: number
}

const emptyForm: ServiceFormData = {
  name: '',
  description: '',
  durationMinutes: 30,
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}min`
}

function EditIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

export function ServicesPage() {
  const data = useLoaderData({ from: '/_app/services' }) as ServicesData
  const router = useRouter()
  const [services, setServices] = useState<Service[]>(data.services)
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState<ServiceFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const openCreateModal = () => {
    setEditingService(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || '',
      durationMinutes: service.durationMinutes,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingService(null)
    setFormData(emptyForm)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      durationMinutes: formData.durationMinutes,
    }

    const url = editingService ? `/api/services/${editingService.id}` : '/api/services'
    const method = editingService ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const responseData = (await res.json()) as { service: Service }
      if (editingService) {
        setServices((prev) =>
          prev.map((s) => (s.id === editingService.id ? responseData.service : s))
        )
      } else {
        setServices((prev) => [...prev, responseData.service])
      }
      closeModal()
      router.invalidate()
    } else {
      const errorData = (await res.json()) as { error?: string }
      setMessage({ type: 'error', text: errorData.error || 'Error saving' })
    }

    setSaving(false)
  }

  const handleDelete = async (service: Service) => {
    if (!confirm(`Are you sure you want to delete "${service.name}"?`)) {
      return
    }

    setDeleting(service.id)
    setMessage(null)

    const res = await fetch(`/api/services/${service.id}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setServices((prev) => prev.filter((s) => s.id !== service.id))
      router.invalidate()
    } else {
      const errorData = (await res.json()) as { error?: string }
      setMessage({ type: 'error', text: errorData.error || 'Error deleting' })
    }

    setDeleting(null)
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-neutral-100 mb-2">Services</h1>
          <p className="text-sm md:text-base text-neutral-400">
            Manage the services you offer and their durations.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <span className="hidden sm:inline">+ New Service</span>
          <span className="sm:hidden">+</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      {services.length === 0 ? (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-12 text-center">
          <p className="text-neutral-400">No services registered.</p>
        </div>
      ) : (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Name</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400 hidden md:table-cell">
                    Description
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">
                    Duration
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-neutral-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.id}
                    className="border-b border-neutral-800/50 last:border-b-0 hover:bg-neutral-800/30"
                  >
                    <td className="px-6 py-4 text-neutral-100 font-medium whitespace-nowrap">
                      {service.name}
                    </td>
                    <td className="px-6 py-4 text-neutral-400 text-sm hidden md:table-cell">
                      {service.description || <span className="italic">-</span>}
                    </td>
                    <td className="px-6 py-4 text-neutral-300 whitespace-nowrap">
                      {formatDuration(service.durationMinutes)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(service)}
                          className="p-2 text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <span className="sr-only">Edit</span>
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => handleDelete(service)}
                          disabled={deleting === service.id}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg disabled:opacity-50 transition-colors"
                          title="Delete"
                        >
                          <span className="sr-only">Delete</span>
                          {deleting === service.id ? (
                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <TrashIcon />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-xl font-semibold text-neutral-100 mb-6">
              {editingService ? 'Edit Service' : 'New Service'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Name *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-primary"
                  placeholder="E.g. Initial consultation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Description
                </label>
                <textarea
                  maxLength={500}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-primary resize-none"
                  rows={3}
                  placeholder="Optional service description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  required
                  min={5}
                  max={480}
                  value={formData.durationMinutes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      durationMinutes: parseInt(e.target.value) || 30,
                    }))
                  }
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Between 5 minutes and 8 hours (480 minutes)
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-neutral-800 text-neutral-300 rounded-lg font-medium hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : editingService ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
