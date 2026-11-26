import { MutationObserver, onlineManager, type QueryClient } from '@tanstack/react-query'
import { waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createQueryClient } from '../../api/queryClient'
import type { Task } from '../../api/types'
import { subscribeSyncToast } from '../../lib/syncToast'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { TASKS_KEY } from './api'
import { TASK_KEY, discardTasks, patchTasks, type TaskVars } from './queue'

const plumber: Task = { id: 'a', text: 'Call the plumber', scheduledOn: '2026-11-18', doneOn: null, createdAt: '2026-11-18T05:00:00Z' }
const milk: Task = { id: 'b', text: 'Buy milk', scheduledOn: null, doneOn: null, createdAt: '2026-11-18T05:01:00Z' }

let queryClient: QueryClient
function change(vars: TaskVars) {
  void new MutationObserver<void, Error, TaskVars>(queryClient, { mutationKey: TASK_KEY, retryDelay: 0 })
    .mutate(vars).catch(() => undefined)
}
const list = () => queryClient.getQueryData<Task[]>(TASKS_KEY)

describe('patchTasks', () => {
  it('adds, replaces and removes', () => {
    expect(patchTasks([plumber], { op: 'put', task: milk })).toEqual([plumber, milk])
    expect(patchTasks([plumber], { op: 'put', task: { ...plumber, doneOn: '2026-11-18' } })[0].doneOn).toBe('2026-11-18')
    expect(patchTasks([plumber, milk], { op: 'delete', id: 'a' })).toEqual([milk])
  })
})

describe('task queue', () => {
  beforeEach(() => {
    queryClient = createQueryClient({ retry: false })
    queryClient.mount()
    queryClient.setQueryData(TASKS_KEY, [plumber])
  })

  afterEach(() => {
    queryClient.unmount()
    onlineManager.setOnline(true)
  })

  it('shows a change at once offline and sends the queue in order when back online', async () => {
    const fetchMock = stubApi((r) => (r.method === 'GET' ? jsonResponse([plumber, milk]) : r.method === 'PUT' ? jsonResponse(milk) : new Response(null, { status: 204 })))
    onlineManager.setOnline(false)

    change({ op: 'put', task: milk })
    change({ op: 'delete', id: 'a' })
    await waitFor(() => expect(list()).toEqual([milk]))
    expect(requests(fetchMock).filter((r) => r.method !== 'GET')).toHaveLength(0)

    onlineManager.setOnline(true)
    await waitFor(() => expect(requests(fetchMock).filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.url}`))
      .toEqual(['PUT /api/tasks/b', 'DELETE /api/tasks/a']))
    expect(requests(fetchMock).find((r) => r.method === 'PUT')?.body).toEqual({ text: 'Buy milk', scheduledOn: null, doneOn: null })
  })

  it('refreshes and says so when the server rejects a change', async () => {
    const toasts: string[] = []
    const unsubscribe = subscribeSyncToast((m) => toasts.push(m))
    stubApi((r) => (r.method === 'PUT' ? problemResponse(400, 'VALIDATION', 'bad') : jsonResponse([plumber])))

    change({ op: 'put', task: milk })
    await waitFor(() => expect(toasts).toEqual(['Couldn’t sync a task. Refreshed.']))
    expect(queryClient.getQueryState(TASKS_KEY)?.isInvalidated).toBe(true)
    unsubscribe()
  })

  it('discards queued changes on sign-out', () => {
    onlineManager.setOnline(false)
    stubApi(() => new Response(null, { status: 204 }))
    change({ op: 'delete', id: 'a' })
    discardTasks(queryClient)
    expect(queryClient.getMutationCache().findAll({ mutationKey: TASK_KEY })).toHaveLength(0)
  })
})
