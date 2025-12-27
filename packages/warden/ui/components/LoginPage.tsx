import { useSearch } from '@tanstack/react-router'
import { GoogleIcon } from './GoogleIcon'

export function LoginPage() {
  const { error, next } = useSearch({ from: '/login' })

  return (
    <div className='min-h-dvh flex items-center justify-center bg-neutral-950 px-4'>
      <div className='max-w-[400px] w-full'>
        <div className='bg-neutral-900 rounded-2xl shadow-sm border border-neutral-800 p-8'>
          <h1 className='text-2xl font-bold text-center text-neutral-100'>Warden</h1>
          <p className='text-neutral-400 mt-2 text-center text-sm'>
            Faca login para acessar o dashboard
          </p>

          {error ? (
            <div className='bg-red-500/10 border border-red-500/20 text-red-400 py-3 px-4 rounded-xl mt-6 text-sm'>
              {error}
            </div>
          ) : null}

          <a
            href={next ? `/auth/google?next=${encodeURIComponent(next)}` : '/auth/google'}
            className='flex items-center justify-center gap-3 bg-white text-black rounded-xl py-3 px-5 text-sm font-semibold no-underline mt-6 w-full hover:bg-neutral-200 transition-colors'
          >
            <GoogleIcon className='w-5 h-5' />
            Entrar com Google
          </a>
        </div>
      </div>
    </div>
  )
}
