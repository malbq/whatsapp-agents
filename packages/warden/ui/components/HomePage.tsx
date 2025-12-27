import { useRouteContext } from '@tanstack/react-router'

export function HomePage() {
  const { session } = useRouteContext({ from: '/_app/' })

  return (
    <div>
      <h1 className='text-2xl font-bold text-neutral-100'>Warden</h1>
      <p className='text-neutral-400 mt-2'>Signed in as {session.email}.</p>
    </div>
  )
}
