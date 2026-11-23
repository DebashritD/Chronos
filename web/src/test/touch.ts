import { fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { swipeClock } from '../app/useTabSwipe'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY } from '../lib/useMediaQuery'

/**
 * Phone-sized window with the given media features. Returns `setMobile` to flip the mobile query live.
 * `setup.ts` unstubs globals after each test.
 */
export function stubMedia({ mobile = true, reduced = false }: { mobile?: boolean; reduced?: boolean } = {}) {
  const listeners = new Set<() => void>()
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === MOBILE_QUERY ? mobile : query === REDUCED_MOTION_QUERY ? reduced : false
    },
    media: query,
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener)
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener)
    },
  }))
  return {
    setMobile(value: boolean): void {
      mobile = value
      listeners.forEach((listener) => listener())
    },
  }
}

let time = 0

/** Drives `swipeClock` from `drag()` so velocities are exact. Restore with `vi.restoreAllMocks()`. */
export function useFakeSwipeClock(): void {
  time = 0
  vi.spyOn(swipeClock, 'now').mockImplementation(() => time)
}

/** A one-finger drag in `steps` moves spread over `ms`. */
export function drag(target: Element, from: [number, number], to: [number, number], ms = 300, steps = 5): void {
  time = 0
  fireEvent.touchStart(target, { touches: [{ clientX: from[0], clientY: from[1] }] })
  for (let i = 1; i <= steps; i++) {
    time = (ms * i) / steps
    fireEvent.touchMove(target, {
      touches: [{ clientX: from[0] + ((to[0] - from[0]) * i) / steps, clientY: from[1] + ((to[1] - from[1]) * i) / steps }],
    })
  }
  fireEvent.touchEnd(target, { changedTouches: [{ clientX: to[0], clientY: to[1] }] })
}

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
