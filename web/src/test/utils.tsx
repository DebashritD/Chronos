/* oxlint-disable react/only-export-components -- test helpers, not part of the app bundle */
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { createQueryClient } from '../api/queryClient'
import type { Me } from '../api/types'
import { SessionProvider } from '../features/auth/session'

export const BOB: Me = { username: 'bob', timezone: 'Asia/Kolkata' }

/** Renders the current pathname + search so tests can assert on navigation. */
export function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname + location.search}</div>
}

interface Options {
  route?: string
  path?: string
  me?: Me | null | 'fetch'
}

export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { route = '/', me = BOB } = options
  const path = options.path ?? route.split('?')[0]
  const queryClient = createQueryClient({ retry: false })
  const user = userEvent.setup()

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <SessionProvider initialMe={me === 'fetch' ? undefined : me}>
          <Routes>
            <Route path={path} element={ui} />
            {path !== '*' && <Route path="*" element={<LocationDisplay />} />}
          </Routes>
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { ...utils, queryClient, user }
}
