import { Link, Outlet, useRouterState } from '@tanstack/react-router'

export function AppLayout() {
  const isLoading = useRouterState({ select: (s) => s.status === 'pending' })

  return (
    <div className='min-h-dvh'>
      {isLoading && (
        <div className='fixed top-0 left-0 right-0 h-1 z-60 bg-primary/20 overflow-hidden'>
          <div className='h-full bg-primary animate-[loading_1.5s_ease-in-out_infinite]' />
        </div>
      )}
      <nav className='bg-neutral-900/50 border-b border-neutral-800 sticky top-0 z-50 backdrop-blur-lg'>
        <div className='max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between'>
          <div className='flex items-center gap-8'>
            <div className='flex items-center gap-2 font-bold text-xl tracking-tight text-neutral-100'>
              Warden
            </div>

            <div className='flex gap-1'>
              <Link
                to='/'
                className='text-sm font-medium px-4 py-2 rounded-full transition-all no-underline text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'
                activeProps={{
                  className:
                    'text-sm font-medium px-4 py-2 rounded-full transition-all no-underline bg-primary/20 text-primary',
                }}
              >
                Home
              </Link>
              <Link
                to='/threads'
                className='text-sm font-medium px-4 py-2 rounded-full transition-all no-underline text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'
                activeProps={{
                  className:
                    'text-sm font-medium px-4 py-2 rounded-full transition-all no-underline bg-primary/20 text-primary',
                }}
              >
                Conversas
              </Link>
              <Link
                to='/calendar'
                search={{ month: undefined }}
                className='text-sm font-medium px-4 py-2 rounded-full transition-all no-underline text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'
                activeProps={{
                  className:
                    'text-sm font-medium px-4 py-2 rounded-full transition-all no-underline bg-primary/20 text-primary',
                }}
              >
                Calendario
              </Link>
            </div>
          </div>

          <div className='flex gap-4'>
            <a
              href='/auth/logout'
              className='text-neutral-400 hover:text-red-400 hover:bg-red-500/10 no-underline text-sm font-medium py-2 px-4 rounded-full transition-all'
            >
              Sair
            </a>
          </div>
        </div>
      </nav>

      <main className='max-w-[1200px] mx-auto p-2'>
        <Outlet />
      </main>
    </div>
  )
}
