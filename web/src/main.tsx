import { onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App.tsx'
import { createPersister, persistOptions } from './api/persist'
import { createQueryClient } from './api/queryClient'
import { YellowLimitProvider } from './app/YellowLimitProvider'
import { SessionProvider } from './features/auth/session'
import { resumeCheckInsOnRestore } from './features/checkin/queue'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'

// TanStack assumes online until an `offline` event; a cold offline launch must pause instead of retrying.
onlineManager.setOnline(navigator.onLine)

const queryClient = createQueryClient()
const persister = createPersister()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions(persister)}
      onSuccess={() => resumeCheckInsOnRestore(queryClient)}>
      <BrowserRouter>
        <SessionProvider>
          <YellowLimitProvider>
            <App />
          </YellowLimitProvider>
        </SessionProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
