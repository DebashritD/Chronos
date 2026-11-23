import { MutationObserver, onlineManager, type QueryClient } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../api/queryClient'
import type { WeekView } from '../../api/types'
import { subscribeSyncToast } from '../../lib/syncToast'
import { problemResponse, requests, stubApi } from '../../test/http'
import { authRestored } from './authGate'
import type { CheckInVars } from './patchWeek'
import { CHECK_IN_KEY, pendingCheckIns } from './queue'

const WEEK_KEY = ['stats', 'week', 'current']
const week: WeekView = {
  start: '2026-11-16', today: '2026-11-18', distribution: { green: 0, yellow: 0, red: 0, grey: 0, total: 0 },
  habits: [{ id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY', intervalDays: null,
    status: 'ACTIVE', cells: [],
    current: { periodStart: '2026-11-18', state: 'PENDING', editable: true, note: null, closesAt: '2026-11-18T18:30:00Z' } }],
}
const GREEN: CheckInVars = { op: 'save', habitId: 1, periodStart: '2026-11-18', color: 'GREEN', note: null }
const noContent = () => new Response(null, { status: 204 })

let queryClient: QueryClient
function mark(vars: CheckInVars) {
  void new MutationObserver<void, Error, CheckInVars>(queryClient, { mutationKey: CHECK_IN_KEY }).mutate(vars).catch(() => undefined)
}
const stateOf = () => queryClient.getQueryData<WeekView>(WEEK_KEY)?.habits[0].current?.state
const writes = (fetchMock: ReturnType<typeof stubApi>) => requests(fetchMock).filter((r) => r.method !== 'GET')

describe('check-in queue', () => {
  beforeEach(() => {
    queryClient = createQueryClient({ retry: false })
    queryClient.mount()
    queryClient.setQueryData(WEEK_KEY, week)
  })

  afterEach(() => {
    queryClient.unmount()
    onlineManager.setOnline(true)
  })

  it('pauses offline, shows the mark at once and replays when back online', async () => {
    const fetchMock = stubApi(() => noContent())
    onlineManager.setOnline(false)
    mark(GREEN)

    await waitFor(() => expect(stateOf()).toBe('GREEN'))
    expect(writes(fetchMock)).toEqual([])
    expect(pendingCheckIns(queryClient)).toBe(1)

    onlineManager.setOnline(true)
    await waitFor(() => expect(pendingCheckIns(queryClient)).toBe(0))
    expect(writes(fetchMock)).toEqual([
      { method: 'PUT', url: '/api/habits/1/check-ins/2026-11-18', body: { color: 'GREEN', note: null } }])
    expect(queryClient.getQueryState(WEEK_KEY)?.isInvalidated).toBe(true)
  })

  it('replays queued marks in order and refreshes once the queue drains', async () => {
    const fetchMock = stubApi(() => noContent())
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    onlineManager.setOnline(false)
    mark(GREEN)
    mark({ op: 'clear', habitId: 1, periodStart: '2026-11-18' })
    await waitFor(() => expect(stateOf()).toBe('PENDING'))

    onlineManager.setOnline(true)
    await waitFor(() => expect(pendingCheckIns(queryClient)).toBe(0))
    expect(writes(fetchMock).map((r) => r.method)).toEqual(['PUT', 'DELETE'])
    expect(invalidate.mock.calls.filter(([filters]) => filters?.queryKey?.[0] === 'stats')).toHaveLength(1)
  })

  it('drops a mark the server rejects, with a toast and a refresh', async () => {
    stubApi(() => problemResponse(409, 'CHECK_IN_NOT_ALLOWED'))
    const toast = vi.fn()
    const unsubscribe = subscribeSyncToast(toast)
    mark(GREEN)

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Couldn’t sync Read. Refreshed.'))
    expect(pendingCheckIns(queryClient)).toBe(0)
    expect(queryClient.getQueryState(WEEK_KEY)?.isInvalidated).toBe(true)
    unsubscribe()
  })

  it('keeps a mark through a 401 and resends it once signed back in', async () => {
    let signedIn = false
    const fetchMock = stubApi(() => (signedIn ? noContent() : problemResponse(401, 'UNAUTHENTICATED')))
    mark(GREEN)

    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1))
    expect(pendingCheckIns(queryClient)).toBe(1)

    signedIn = true
    authRestored()
    await waitFor(() => expect(pendingCheckIns(queryClient)).toBe(0))
    expect(writes(fetchMock)).toHaveLength(2)
  })
})
