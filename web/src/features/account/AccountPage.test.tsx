import { MutationObserver, onlineManager } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { browserTimezone } from '../auth/session'
import type { CheckInVars } from '../checkin/patchWeek'
import { CHECK_IN_KEY } from '../checkin/queue'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { AccountPage, unsyncedMarksCopy } from './AccountPage'

describe('AccountPage', () => {
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('words the unsynced-marks question', () => {
    expect(unsyncedMarksCopy(1)).toBe('1 change hasn’t synced. Log out anyway?')
    expect(unsyncedMarksCopy(3)).toBe('3 changes haven’t synced. Log out anyway?')
  })

  it('asks before logging out with marks still waiting to sync', async () => {
    // The marks' writes hang, so they stay unsynced while online.
    const fetchMock = stubApi(() => undefined).mockImplementation(async (input: RequestInfo | URL) =>
      String(input) === '/api/auth/logout' ? new Response(null, { status: 200 }) : new Promise<Response>(() => {}))
    const { queryClient, user } = renderWithProviders(<AccountPage />, { route: '/settings' })
    for (const periodStart of ['2026-11-17', '2026-11-18']) {
      void new MutationObserver<void, Error, CheckInVars>(queryClient, { mutationKey: CHECK_IN_KEY })
        .mutate({ op: 'save', habitId: 1, periodStart, color: 'GREEN', note: null }).catch(() => undefined)
    }

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('2 changes haven’t synced. Log out anyway?')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(requests(fetchMock)).not.toContainEqual(expect.objectContaining({ url: '/api/auth/logout' }))

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Log out' }))
    expect(await screen.findByTestId('location-display')).toHaveTextContent('/login')
  })

  it('can’t log out offline', async () => {
    stubApi(() => undefined)
    renderWithProviders(<AccountPage />, { route: '/settings' })

    act(() => onlineManager.setOnline(false))
    expect(screen.getByRole('button', { name: 'Log out' })).toBeDisabled()
    expect(screen.getByText('Connect to log out.')).toBeInTheDocument()

    act(() => onlineManager.setOnline(true))
    expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
    expect(screen.queryByText('Connect to log out.')).not.toBeInTheDocument()
  })

  it('won’t confirm a logout after going offline with the question open', async () => {
    stubApi(() => undefined).mockImplementation(() => new Promise<Response>(() => {}))
    const { queryClient, user } = renderWithProviders(<AccountPage />, { route: '/settings' })
    void new MutationObserver<void, Error, CheckInVars>(queryClient, { mutationKey: CHECK_IN_KEY })
      .mutate({ op: 'save', habitId: 1, periodStart: '2026-11-18', color: 'GREEN', note: null }).catch(() => undefined)

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    const dialog = await screen.findByRole('alertdialog')
    act(() => onlineManager.setOnline(false))

    const confirm = within(dialog).getByRole('button', { name: 'Log out' })
    expect(confirm).toBeDisabled()
    await user.click(confirm)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

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

    expect(await screen.findByText('Timezone saved')).toHaveAttribute('role', 'status')
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

    expect(await screen.findByText('Password changed')).toHaveAttribute('role', 'status')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(requests(fetchMock)[0].body).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' })
  })

  it('shows a wrong current password', async () => {
    stubApi(() => problemResponse(400, 'VALIDATION', 'currentPassword: is incorrect'))
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.type(screen.getByLabelText('Current password'), 'nope-nope')
    await user.type(screen.getByLabelText('New password'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.')
  })

  it('saves how many minimums in a row keep a streak', async () => {
    const fetchMock = stubApi(({ method }) =>
      method === 'PUT' ? jsonResponse({ username: 'bob', timezone: 'Asia/Kolkata', maxYellows: 3 }) : undefined,
    )
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    expect(screen.getByText('Minimums allowed in a row')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Minimums allowed in a row' })).toHaveTextContent('2')
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Save streak rule' }))

    expect(await screen.findByText('Streak rule saved')).toHaveAttribute('role', 'status')
    expect(requests(fetchMock)).toContainEqual({ method: 'PUT', url: '/api/auth/me', body: { maxYellows: 3 } })
  })

  it('stops the stepper at 1 and 7', async () => {
    stubApi(() => undefined)
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.click(screen.getByRole('button', { name: 'Fewer' }))
    expect(screen.getByRole('button', { name: 'Fewer' })).toHaveAttribute('aria-disabled', 'true')
    for (let i = 0; i < 6; i++) await user.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('status', { name: 'Minimums allowed in a row' })).toHaveTextContent('7')
  })

  it('keeps keyboard focus on the stepper button at a limit', async () => {
    stubApi(() => undefined)
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    const fewer = screen.getByRole('button', { name: 'Fewer' })
    fewer.focus()
    await user.keyboard('{Enter}')
    expect(fewer).toHaveAttribute('aria-disabled', 'true')
    expect(fewer).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status', { name: 'Minimums allowed in a row' })).toHaveTextContent('1')
  })

  it('logs out', async () => {
    const fetchMock = stubApi(({ url }) => (url === '/api/auth/logout' ? new Response(null, { status: 200 }) : undefined))
    const { user } = renderWithProviders(<AccountPage />, { route: '/settings' })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByTestId('location-display')).toHaveTextContent('/login')
    expect(requests(fetchMock)).toContainEqual({ method: 'POST', url: '/api/auth/logout', body: undefined })
  })
})
