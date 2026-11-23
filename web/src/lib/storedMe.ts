import type { Me } from '../api/types'

const KEY = 'chronos.me'

/** The last signed-in user, so the app opens offline and can tell whether a returning user owns the queued marks. */
export function readStoredMe(): Me | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Me) : null
  } catch {
    return null
  }
}

export function storeMe(me: Me): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(me))
  } catch {
    // No storage (private mode, quota): the session just isn’t remembered.
  }
}

export function clearStoredMe(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // No storage (private mode, quota): the session just isn’t remembered.
  }
}
