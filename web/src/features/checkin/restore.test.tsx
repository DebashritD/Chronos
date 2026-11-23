import { MutationObserver, onlineManager, useIsRestoring } from '@tanstack/react-query'
import { PersistQueryClientProvider, persistQueryClientSave } from '@tanstack/react-query-persist-client'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CACHE_KEY, createPersister, persistOptions } from '../../api/persist'
import { createQueryClient } from '../../api/queryClient'
import { stubApi } from '../../test/http'
import type { CheckInVars } from './patchWeek'
import { CHECK_IN_KEY, pendingCheckIns, resumeCheckInsOnRestore } from './queue'

function Restoring() {
  return <p>{useIsRestoring() ? 'restoring' : 'ready'}</p>
}

afterEach(() => {
  onlineManager.setOnline(true)
})

it('finishes restoring offline even with a queued mark that cannot sync yet', async () => {
  const items = new Map<string, string>()
  const persister = createPersister({
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value)
    },
    removeItem: async (key) => {
      items.delete(key)
    },
  }, 0)
  stubApi(() => new Response(null, { status: 204 }))
  onlineManager.setOnline(false)
  const before = createQueryClient({ retry: false })
  before.mount()
  const vars: CheckInVars = { op: 'save', habitId: 1, periodStart: '2026-11-18', color: 'GREEN', note: null }
  void new MutationObserver<void, Error, CheckInVars>(before, { mutationKey: CHECK_IN_KEY }).mutate(vars).catch(() => undefined)
  await persistQueryClientSave({ queryClient: before, ...persistOptions(persister) })
  await vi.waitFor(() => expect(items.get(CACHE_KEY)).toContain('"checkIn"'))
  before.getMutationCache().clear()
  before.unmount()

  const queryClient = createQueryClient({ retry: false })
  render(
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions(persister)}
      onSuccess={() => resumeCheckInsOnRestore(queryClient)}>
      <Restoring />
    </PersistQueryClientProvider>,
  )

  expect(await screen.findByText('ready')).toBeInTheDocument()
  expect(pendingCheckIns(queryClient)).toBe(1)
  onlineManager.setOnline(true)
  await waitFor(() => expect(pendingCheckIns(queryClient)).toBe(0))
})
