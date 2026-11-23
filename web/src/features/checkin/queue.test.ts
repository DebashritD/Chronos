import { MutationObserver, onlineManager, type QueryClient } from '@tanstack/react-query'
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client'
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/errors'
import { CACHE_KEY, createPersister, persistOptions } from '../../api/persist'
import { setQueryErrorHandler } from '../../api/queryErrorBridge'
import { createQueryClient } from '../../api/queryClient'
import type { WeekView } from '../../api/types'
import { subscribeSyncToast } from '../../lib/syncToast'
import { problemResponse, requests, stubApi } from '../../test/http'
import { memoryStorage } from '../../test/storage'
import { authRestored } from './authGate'
import type { CheckInVars } from './patchWeek'
import { CHECK_IN_KEY, discardCheckIns, pendingCheckIns, resumeCheckIns } from './queue'

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
  // No backoff in tests; the retry rules themselves come from the queue's defaults.
  void new MutationObserver<void, Error, CheckInVars>(queryClient, { mutationKey: CHECK_IN_KEY, retryDelay: 0 })
    .mutate(vars).catch(() => undefined)
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

  it('gives up on a mark after eight retries on server errors, like a rejected one, and carries on with the queue', async () => {
    let down = true
    const fetchMock = stubApi(() => (down ? problemResponse(503, 'UNAVAILABLE') : noContent()))
    const toast = vi.fn()
    const unsubscribe = subscribeSyncToast(toast)
    mark(GREEN)

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Couldn’t sync Read. Refreshed.'))
    expect(writes(fetchMock)).toHaveLength(9)
    expect(pendingCheckIns(queryClient)).toBe(0)
    expect(queryClient.getQueryState(WEEK_KEY)?.isInvalidated).toBe(true)

    down = false
    mark(GREEN)
    await waitFor(() => expect(pendingCheckIns(queryClient)).toBe(0))
    expect(writes(fetchMock)).toHaveLength(10)
    unsubscribe()
  })

  it('keeps retrying a mark through network errors', async () => {
    let failures = 0
    const fetchMock = stubApi(() => {
      if (failures++ < 10) throw new TypeError('Failed to fetch')
      return noContent()
    })
    mark(GREEN)

    await waitFor(() => expect(pendingCheckIns(queryClient)).toBe(0))
    expect(writes(fetchMock)).toHaveLength(11)
  })

  it('keeps a mark through a 401, signs out, and resends it once signed back in', async () => {
    let signedIn = false
    const fetchMock = stubApi(() => (signedIn ? noContent() : problemResponse(401, 'UNAUTHENTICATED')))
    const onQueryError = vi.fn()
    setQueryErrorHandler(onQueryError)
    mark(GREEN)

    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1))
    expect(onQueryError).toHaveBeenCalledTimes(1)
    expect(onQueryError).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }))
    expect(onQueryError.mock.calls[0][0]).toBeInstanceOf(ApiError)
    expect(pendingCheckIns(queryClient)).toBe(1)
    setQueryErrorHandler(null)

    signedIn = true
    authRestored()
    await waitFor(() => expect(pendingCheckIns(queryClient)).toBe(0))
    expect(writes(fetchMock)).toHaveLength(2)
  })
  it('saves a queued mark with the cache and syncs it after a reload', async () => {
    const { items, storage } = memoryStorage()
    const persister = createPersister(storage, 0)
    const fetchMock = stubApi(() => noContent())
    onlineManager.setOnline(false)
    mark(GREEN)
    await waitFor(() => expect(stateOf()).toBe('GREEN'))
    await persistQueryClientSave({ queryClient, ...persistOptions(persister) })
    await vi.waitFor(() => expect(items.get(CACHE_KEY)).toContain('"checkIn"'))

    const reloaded = createQueryClient({ retry: false })
    reloaded.mount()
    await persistQueryClientRestore({ queryClient: reloaded, ...persistOptions(persister) })
    expect(reloaded.getQueryData<WeekView>(WEEK_KEY)?.habits[0].current?.state).toBe('GREEN')
    onlineManager.setOnline(true)
    await resumeCheckIns(reloaded)

    await waitFor(() => expect(pendingCheckIns(reloaded)).toBe(0))
    expect(writes(fetchMock).filter((r) => r.method === 'PUT')).not.toHaveLength(0)
    reloaded.unmount()
  })

  it('saves a mark waiting for sign-in with the cache and resends it after a reload', async () => {
    const { items, storage } = memoryStorage()
    const persister = createPersister(storage, 0)
    let signedIn = false
    const fetchMock = stubApi(() => (signedIn ? noContent() : problemResponse(401, 'UNAUTHENTICATED')))
    mark(GREEN)
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1))
    expect(queryClient.getMutationCache().getAll()[0].state.isPaused).toBe(false)
    await persistQueryClientSave({ queryClient, ...persistOptions(persister) })
    await vi.waitFor(() => expect(items.get(CACHE_KEY)).toContain('"checkIn"'))

    // The old page goes away; this also releases the shared auth gate.
    discardCheckIns(queryClient)
    signedIn = true
    const reloaded = createQueryClient({ retry: false })
    reloaded.mount()
    await persistQueryClientRestore({ queryClient: reloaded, ...persistOptions(persister) })
    expect(pendingCheckIns(reloaded)).toBe(1)
    await resumeCheckIns(reloaded)

    await waitFor(() => expect(pendingCheckIns(reloaded)).toBe(0))
    expect(writes(fetchMock)).toHaveLength(2)
    reloaded.unmount()
  })
})
