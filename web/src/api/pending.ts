/**
 * Tracks the number of in-flight requests wrapped with `trackPending`, so
 * the UI can show a "Waking the server…" notice while requests are pending.
 */
let pendingCount = 0
const subscribers = new Set<(count: number) => void>()

function notify() {
  for (const cb of subscribers) {
    cb(pendingCount)
  }
}

/** Wraps a promise, incrementing the pending count until it settles. */
export function trackPending<T>(promise: Promise<T>): Promise<T> {
  pendingCount += 1
  notify()
  return promise.finally(() => {
    pendingCount -= 1
    notify()
  })
}

/** Subscribes to pending-count changes; returns an unsubscribe function. */
export function subscribePending(cb: (count: number) => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}
