import type { KeyValueStorage } from '../api/persist'

/** An in-memory stand-in for IndexedDB, exposing what was saved. */
export function memoryStorage(): { items: Map<string, string>; storage: KeyValueStorage } {
  const items = new Map<string, string>()
  const storage: KeyValueStorage = {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value)
    },
    removeItem: async (key) => {
      items.delete(key)
    },
  }
  return { items, storage }
}
