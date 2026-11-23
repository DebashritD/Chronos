import { QueryClient } from '@tanstack/react-query'
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client'
import { describe, expect, it, vi } from 'vitest'
import { CACHE_KEY, createPersister, persistOptions, type KeyValueStorage } from './persist'

function memoryStorage(): KeyValueStorage & { items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value)
    },
    removeItem: async (key) => {
      items.delete(key)
    },
  }
}

const STREAKS = [{ habitId: 1, name: 'Read', current: 3, best: 3, yellowRun: 0, yellowLimit: null }]

describe('persisted cache', () => {
  it('saves queries under chronos-cache and restores them', async () => {
    const storage = memoryStorage()
    const persister = createPersister(storage, 0)
    const source = new QueryClient()
    source.setQueryData(['stats', 'streaks'], STREAKS)

    await persistQueryClientSave({ queryClient: source, ...persistOptions(persister) })
    await vi.waitFor(() => expect(storage.items.has(CACHE_KEY)).toBe(true))

    const target = new QueryClient()
    await persistQueryClientRestore({ queryClient: target, ...persistOptions(persister) })
    expect(target.getQueryData(['stats', 'streaks'])).toEqual(STREAKS)
  })

  it('discards a cache saved under another CACHE_VERSION', async () => {
    const storage = memoryStorage()
    const persister = createPersister(storage, 0)
    const source = new QueryClient()
    source.setQueryData(['stats', 'streaks'], STREAKS)

    await persistQueryClientSave({ queryClient: source, persister, buster: '0' })
    await vi.waitFor(() => expect(storage.items.has(CACHE_KEY)).toBe(true))

    const target = new QueryClient()
    await persistQueryClientRestore({ queryClient: target, ...persistOptions(persister) })
    expect(target.getQueryData(['stats', 'streaks'])).toBeUndefined()
  })
})
