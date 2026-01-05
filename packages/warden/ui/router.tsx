import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { AppLayout } from './components/AppLayout'
import { CalendarPage } from './components/CalendarPage'
import { ChatPage, type ChatThread } from './components/ChatPage'
import { LoginPage } from './components/LoginPage'
import { ServicesPage, type ServicesData } from './components/ServicesPage'
import { SettingsPage, type SettingsData } from './components/SettingsPage'
import { ThreadsPage, type Thread } from './components/ThreadsPage'
import type { CalendarResponse } from './components/calendar/types'

type Session = { email: string }

async function fetchSession(): Promise<Session> {
  const res = await fetch('/api/session')
  if (res.status === 401) {
    throw redirect({
      to: '/login',
      search: { error: undefined, next: window.location.pathname + window.location.search },
    })
  }
  if (!res.ok) {
    throw new Error('Failed to fetch session')
  }
  const data = (await res.json()) as { session: Session }
  return data.session
}

// Root layout - just renders children
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Login route - public, no auth required
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>) => ({
    error: (search.error as string) || undefined,
    next: (search.next as string) || undefined,
  }),
  component: LoginPage,
})

// Layout route for authenticated pages - checks auth before loading
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  beforeLoad: async () => {
    const session = await fetchSession()
    return { session }
  },
  component: AppLayout,
})

// Calendar page (index) - loads full calendar data
const calendarRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  loaderDeps: ({ search }: { search: { month?: string; view?: 'month' | 'week' } }) => ({
    month: search.month,
    view: search.view,
  }),
  validateSearch: (search: Record<string, unknown>): { month?: string; view?: 'month' | 'week' } => ({
    month: (search.month as string) || undefined,
    view: (search.view as 'month' | 'week') || undefined,
  }),
  loader: async ({ deps }): Promise<CalendarResponse> => {
    const url = deps.month ? `/api/calendar/data?month=${deps.month}` : '/api/calendar/data'
    const res = await fetch(url)
    if (!res.ok) {
      return { connected: false }
    }
    return res.json() as Promise<CalendarResponse>
  },
  component: CalendarPage,
})

// Threads page - loads threads data
const threadsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/threads',
  loader: async (): Promise<{ threads: Thread[] }> => {
    const res = await fetch('/api/threads')
    if (!res.ok) {
      throw new Error(await res.text())
    }
    const data = (await res.json()) as { threads: Thread[] }
    return { threads: data.threads }
  },
  component: ThreadsPage,
})

// Chat page - loads thread messages for a specific user
const chatRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/chat/$userId',
  loader: async ({ params }): Promise<{ thread: ChatThread }> => {
    const res = await fetch(`/api/threads/${params.userId}`)
    if (!res.ok) {
      throw new Error(await res.text())
    }
    const data = (await res.json()) as { thread: ChatThread }
    return { thread: data.thread }
  },
  component: ChatPage,
})

// Settings page - loads availability settings and working hours
const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  loader: async (): Promise<SettingsData> => {
    const res = await fetch('/api/availability')
    if (!res.ok) {
      throw new Error(await res.text())
    }
    return res.json() as Promise<SettingsData>
  },
  component: SettingsPage,
})

// Services page - loads services data
const servicesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/services',
  loader: async (): Promise<ServicesData> => {
    const res = await fetch('/api/services')
    if (!res.ok) {
      throw new Error(await res.text())
    }
    return res.json() as Promise<ServicesData>
  },
  component: ServicesPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appLayoutRoute.addChildren([calendarRoute, threadsRoute, chatRoute, settingsRoute, servicesRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
