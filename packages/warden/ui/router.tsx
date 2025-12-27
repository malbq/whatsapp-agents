import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { AppLayout } from './components/AppLayout'
import { CalendarPage } from './components/CalendarPage'
import { HomePage } from './components/HomePage'
import { LoginPage } from './components/LoginPage'
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

// Home page - uses session from context
const indexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  component: HomePage,
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

// Calendar page - loads full calendar data
const calendarRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/calendar',
  loaderDeps: ({ search }: { search: { month?: string } }) => ({ month: search.month }),
  validateSearch: (search: Record<string, unknown>) => ({
    month: (search.month as string) || undefined,
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

const routeTree = rootRoute.addChildren([
  loginRoute,
  appLayoutRoute.addChildren([indexRoute, threadsRoute, calendarRoute]),
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
