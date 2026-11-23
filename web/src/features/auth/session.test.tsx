import { MutationObserver, onlineManager, type QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import { notifyQueryError } from '../../api/queryErrorBridge'
import type { Me } from '../../api/types'
import { jsonResponse, problemResponse, stubApi } from '../../test/http'
import { BOB, renderWithProviders } from '../../test/utils'
import type { CheckInVars } from '../checkin/patchWeek'
import { CHECK_IN_KEY, pendingCheckIns } from '../checkin/queue'
import { useSession } from './session'

function Probe() {
  const { me, checking, login, logout } = useSession()
  return (
    <div>
      <p data-testid="who">{checking ? 'checking' : (me?.username ?? 'visitor')}</p>
      <button type="button" onClick={() => void login('bob', 'pw')}>login bob</button>
      <button type="button" onClick={() => void login('alice', 'pw')}>login alice</button>
      <button type="button" onClick={() => void logout()}>logout</button>
    </div>
  )
}

const who = () => screen.getByTestId('who')
const save = (me: Me) => localStorage.setItem('chronos.me', JSON.stringify(me))

function queueMark(queryClient: QueryClient) {
  onlineManager.setOnline(false)
  void new MutationObserver<void, Error, CheckInVars>(queryClient, { mutationKey: CHECK_IN_KEY })
    .mutate({ op: 'save', habitId: 1, periodStart: '2026-11-18', color: 'GREEN', note: null })
    .catch(() => undefined)
}

function stubAuth() {
  return stubApi((r) => {
    if (r.url === '/api/auth/login') return jsonResponse({ ...BOB, username: (r.body as { username: string }).username })
    if (r.url === '/api/auth/logout') return new Response(null, { status: 200 })
    return undefined
  })
}

describe('session', () => {
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('saves me after the startup check', async () => {
    stubApi((r) => (r.url === '/api/auth/me' ? jsonResponse(BOB) : undefined))
    renderWithProviders(<Probe />, { me: 'fetch' })
    await waitFor(() => expect(who()).toHaveTextContent('bob'))
    expect(JSON.parse(localStorage.getItem('chronos.me') ?? 'null')).toEqual(BOB)
  })

  it('uses the saved me when the server can’t be reached', async () => {
    save(BOB)
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    renderWithProviders(<Probe />, { me: 'fetch' })
    await waitFor(() => expect(who()).toHaveTextContent('bob'))
  })

  it('signs out on a 401 even with a saved me', async () => {
    save(BOB)
    stubApi((r) => (r.url === '/api/auth/me' ? problemResponse(401, 'UNAUTHENTICATED') : undefined))
    renderWithProviders(<Probe />, { me: 'fetch' })
    await waitFor(() => expect(who()).toHaveTextContent('visitor'))
  })

  it('keeps queued marks through a 401 and after the same user logs back in', async () => {
    save(BOB)
    stubAuth()
    const { queryClient, user } = renderWithProviders(<Probe />)
    queryClient.setQueryData(['stats', 'streaks'], [])
    queueMark(queryClient)

    notifyQueryError(new ApiError(401, 'UNAUTHENTICATED', null))
    await waitFor(() => expect(who()).toHaveTextContent('visitor'))
    expect(pendingCheckIns(queryClient)).toBe(1)
    expect(queryClient.getQueryData(['stats', 'streaks'])).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'login bob' }))
    await waitFor(() => expect(who()).toHaveTextContent('bob'))
    expect(pendingCheckIns(queryClient)).toBe(1)
    queryClient.getMutationCache().clear()
  })

  it('discards queued marks when someone else logs in', async () => {
    save(BOB)
    stubAuth()
    const { queryClient, user } = renderWithProviders(<Probe />, { me: null })
    queueMark(queryClient)

    await user.click(screen.getByRole('button', { name: 'login alice' }))
    await waitFor(() => expect(who()).toHaveTextContent('alice'))
    expect(pendingCheckIns(queryClient)).toBe(0)
    expect(JSON.parse(localStorage.getItem('chronos.me') ?? 'null')).toMatchObject({ username: 'alice' })
  })

  it('forgets everything on logout', async () => {
    save(BOB)
    stubAuth()
    const { queryClient, user } = renderWithProviders(<Probe />)
    queueMark(queryClient)

    await user.click(screen.getByRole('button', { name: 'logout' }))
    await waitFor(() => expect(screen.getByTestId('location-display')).toHaveTextContent('/login'))
    expect(pendingCheckIns(queryClient)).toBe(0)
    expect(localStorage.getItem('chronos.me')).toBeNull()
  })
})
