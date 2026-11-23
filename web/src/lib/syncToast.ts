/** Sync failures raised outside React (mutation defaults) reach the toast through this bus. */
const subscribers = new Set<(message: string) => void>()

export function showSyncToast(message: string): void {
  for (const cb of subscribers) cb(message)
}

export function subscribeSyncToast(cb: (message: string) => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}
