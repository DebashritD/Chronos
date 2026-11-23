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
  localStorage.setItem(KEY, JSON.stringify(me))
}

export function clearStoredMe(): void {
  localStorage.removeItem(KEY)
}
