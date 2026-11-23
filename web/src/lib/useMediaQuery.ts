import { useSyncExternalStore } from 'react'

export const MOBILE_QUERY = '(max-width: 767.98px)'
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** False where `matchMedia` doesn't exist (jsdom). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
}
