import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, problemResponse, stubApi } from '../test/http'
import { renderWithProviders } from '../test/utils'
import { AppRouter } from './router'

describe('AppRouter', () => {
  it('sends signed-out visitors to the login page', async () => {
    stubApi(({ url }) => (url === '/api/auth/me' ? problemResponse(401, 'BAD_CREDENTIALS') : undefined))
    renderWithProviders(<AppRouter />, { route: '/', path: '/*', me: 'fetch' })

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })

  it('shows the shell to signed-in users', async () => {
    stubApi(({ url }) => (url === '/api/auth/me' ? jsonResponse({ username: 'bob', timezone: 'UTC' }) : undefined))
    renderWithProviders(<AppRouter />, { route: '/', path: '/*', me: 'fetch' })

    expect(await screen.findByRole('navigation', { name: 'Tabs' })).toBeInTheDocument()
    // Both navs are in the DOM (CSS hides one per breakpoint).
    for (const name of ['Today', 'Progress', 'Habits', 'Me']) {
      expect(screen.getAllByRole('link', { name })).toHaveLength(2)
    }
    expect(screen.getByRole('navigation', { name: 'Tabs' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Today' })[0]).toHaveAttribute('aria-current', 'page')
  })

  it('keeps signed-in users away from the login page', async () => {
    stubApi(() => undefined)
    renderWithProviders(<AppRouter />, { route: '/login', path: '/*' })

    expect(await screen.findByRole('navigation', { name: 'Tabs' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument()
  })
})
