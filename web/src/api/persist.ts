import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { PersistQueryClientOptions, Persister } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import { isCheckIn } from '../features/checkin/queue'

/**
 * Bump by hand only when the shape of cached data changes; ordinary deploys keep saved data and queued marks.
 * Bumping it (like the 7-day maxAge running out) drops any unsynced marks along with the cache.
 */
export const CACHE_VERSION = '1'
export const CACHE_KEY = 'chronos-cache'
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null | undefined>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export const idbStorage: KeyValueStorage = {
  getItem: (key) => get<string>(key),
  setItem: (key, value) => set(key, value),
  removeItem: (key) => del(key),
}

export function createPersister(storage: KeyValueStorage = idbStorage, throttleTime = 1000): Persister {
  return createAsyncStoragePersister({ storage, key: CACHE_KEY, throttleTime })
}

export function persistOptions(persister: Persister): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister,
    maxAge: PERSIST_MAX_AGE,
    buster: CACHE_VERSION,
    // TanStack's default keeps only paused mutations; a mark waiting for sign-in after a 401 must survive a reload too.
    dehydrateOptions: { shouldDehydrateMutation: (m) => isCheckIn(m) && m.state.status === 'pending' },
  }
}

/** Forgets the saved cache (logout). Never throws: there may be no IndexedDB (tests, private modes). */
export async function clearPersistedCache(): Promise<void> {
  try {
    await del(CACHE_KEY)
  } catch {
    // Nothing saved to clear.
  }
}
