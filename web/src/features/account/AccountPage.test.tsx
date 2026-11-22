import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { browserTimezone } from '../auth/session'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { AccountPage } from './AccountPage'

describe('AccountPage', () => {
  it('shows the account', () => {
    stubApi(() => undefined)
    renderWithProviders(<AccountPage />, { route: '/settings' })

    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
    expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Kolkata')
  })

  it('saves the timezone, defaulting to this device', async () => {
    const fetchMock = stubApi(({ method, body }) =>
      method === 'PUT' ? jsonResponse({ username: 'bob', ...(body as object) }) : undefined,
    )
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.click(screen.getByRole('button', { name: 'Use this device' }))
    expect(screen.getByLabelText('Timezone')).toHaveValue(browserTimezone())
    await user.click(screen.getByRole('button', { name: 'Save timezone' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Timezone saved')
    expect(requests(fetchMock)).toEqual([
      { method: 'PUT', url: '/api/auth/me', body: { timezone: browserTimezone() } },
    ])
  })

  it('changes the password', async () => {
    const fetchMock = stubApi(({ method }) =>
      method === 'PUT' ? jsonResponse({ username: 'bob', timezone: 'Asia/Kolkata' }) : undefined,
    )
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.type(screen.getByLabelText('Current password'), 'old-password')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Password changed')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(requests(fetchMock)[0].body).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' })
  })

  it('shows a wrong current password', async () => {
    stubApi(() => problemResponse(400, 'VALIDATION', 'currentPassword: is incorrect'))
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.type(screen.getByLabelText('Current password'), 'nope-nope')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('currentPassword: is incorrect')
  })

  it('logs out', async () => {
    const fetchMock = stubApi(({ url }) => (url === '/api/auth/logout' ? new Response(null, { status: 200 }) : undefined))
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/login')
    expect(requests(fetchMock)).toContainEqual({ method: 'POST', url: '/api/auth/logout', body: undefined })
  })
})
