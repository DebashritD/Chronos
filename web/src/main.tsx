import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { createQueryClient } from './api/queryClient'
import { YellowLimitProvider } from './app/YellowLimitProvider'
import { SessionProvider } from './features/auth/session'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/geist/600.css'
import './index.css'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <YellowLimitProvider>
            <App />
          </YellowLimitProvider>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
