import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'

export function AppLayout() {
  const isLoading = useRouterState({ select: (s) => s.status === 'pending' })
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className='h-dvh grid grid-rows-[auto_1fr] overflow-hidden'>
      {isLoading && (
        <div className='fixed top-0 left-0 right-0 h-1 z-60 bg-primary/20 overflow-hidden'>
          <div className='h-full bg-primary animate-[loading_1.5s_ease-in-out_infinite]' />
        </div>
      )}
      <nav className='bg-neutral-900/50 border-b border-neutral-800 sticky top-0 z-50 backdrop-blur-lg'>
        <div className='px-4 md:px-6 py-2 flex items-center justify-between relative'>
          <div className='flex items-center gap-8'>
            <div className='flex items-center gap-2 font-bold text-xl tracking-tight text-neutral-100'>
              Warden
            </div>

            {/* Desktop Navigation */}
            <div className='hidden md:flex gap-1'>
              <Link
                to='/'
                search={{ month: undefined, view: undefined }}
                className='text-sm font-medium px-4 py-2 rounded-full transition-all no-underline'
                activeProps={{ className: 'bg-primary/20 text-indigo-300' }}
                inactiveProps={{
                  className: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
                }}
              >
                Calendário
              </Link>
              <Link
                to='/threads'
                className='text-sm font-medium px-4 py-2 rounded-full transition-all no-underline'
                activeProps={{ className: 'bg-primary/20 text-indigo-300' }}
                inactiveProps={{
                  className: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
                }}
              >
                Conversas
              </Link>
              <Link
                to='/settings'
                className='text-sm font-medium px-4 py-2 rounded-full transition-all no-underline'
                activeProps={{ className: 'bg-primary/20 text-indigo-300' }}
                inactiveProps={{
                  className: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
                }}
              >
                Configurações
              </Link>
              <Link
                to='/services'
                className='text-sm font-medium px-4 py-2 rounded-full transition-all no-underline'
                activeProps={{ className: 'bg-primary/20 text-indigo-300' }}
                inactiveProps={{
                  className: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
                }}
              >
                Serviços
              </Link>
            </div>
          </div>

          <div className='hidden md:block'>
            <a
              href='/auth/logout'
              className='text-neutral-400 hover:text-red-400 hover:bg-red-500/10 no-underline text-sm font-medium py-2 px-4 rounded-full transition-all'
            >
              Sair
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className='md:hidden p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-md transition-colors'
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label='Toggle menu'
          >
            {isMenuOpen ? (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M18 6 6 18' />
                <path d='m6 6 12 12' />
              </svg>
            ) : (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <line
                  x1='4'
                  x2='20'
                  y1='12'
                  y2='12'
                />
                <line
                  x1='4'
                  x2='20'
                  y1='6'
                  y2='6'
                />
                <line
                  x1='4'
                  x2='20'
                  y1='18'
                  y2='18'
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {/* Overlay */}
        {isMenuOpen && (
          <div
            className='fixed inset-0 bg-black/60 z-40 md:hidden'
            onClick={() => setIsMenuOpen(false)}
            aria-hidden='true'
          />
        )}
        
        {/* Menu Drawer */}
        <div 
          className={`md:hidden fixed top-[53px] left-0 right-0 bg-neutral-900 border-b border-neutral-800 shadow-2xl shadow-black z-50 transition-all duration-300 ease-in-out origin-top ${
            isMenuOpen 
              ? 'opacity-100 translate-y-0 scale-y-100' 
              : 'opacity-0 -translate-y-4 scale-y-95 pointer-events-none'
          }`}
        >
          <div className='p-4 flex flex-col gap-2'>
            <Link
              to='/'
              search={{ month: undefined, view: undefined }}
              className='text-sm font-medium px-4 py-3 rounded-lg transition-all no-underline'
              activeProps={{ className: 'bg-primary/20 text-indigo-300' }}
              inactiveProps={{
                className: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
              }}
              onClick={() => setIsMenuOpen(false)}
            >
              Calendário
            </Link>
            <Link
              to='/threads'
              className='text-sm font-medium px-4 py-3 rounded-lg transition-all no-underline'
              activeProps={{ className: 'bg-primary/20 text-indigo-300' }}
              inactiveProps={{
                className: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
              }}
              onClick={() => setIsMenuOpen(false)}
            >
              Conversas
            </Link>
            <Link
              to='/settings'
              className='text-sm font-medium px-4 py-3 rounded-lg transition-all no-underline'
              activeProps={{ className: 'bg-primary/20 text-indigo-300' }}
              inactiveProps={{
                className: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
              }}
              onClick={() => setIsMenuOpen(false)}
            >
              Configurações
            </Link>
            <Link
              to='/services'
              className='text-sm font-medium px-4 py-3 rounded-lg transition-all no-underline'
              activeProps={{ className: 'bg-primary/20 text-indigo-300' }}
              inactiveProps={{
                className: 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
              }}
              onClick={() => setIsMenuOpen(false)}
            >
              Serviços
            </Link>
            <div className='h-px bg-neutral-800 my-1' />
            <a
              href='/auth/logout'
              className='text-neutral-400 hover:text-red-400 hover:bg-red-500/10 no-underline text-sm font-medium px-4 py-3 rounded-lg transition-all'
            >
              Sair
            </a>
          </div>
        </div>
      </nav>

      <main className='overflow-y-auto'>
        <Outlet />
      </main>
    </div>
  )
}
