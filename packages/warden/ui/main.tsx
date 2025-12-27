import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { router } from './router'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Missing #root container')
}

createRoot(container).render(<RouterProvider router={router} />)
