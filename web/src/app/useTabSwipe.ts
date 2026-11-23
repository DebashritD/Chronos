import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

export const LOCK_PX = 10
export const EDGE_PX = 16
export const COMMIT_RATIO = 0.35
export const COMMIT_VELOCITY = 0.4
export const RUBBER = 1 / 3
export const PULL_RATIO = 0.5
export const PULL_MAX = 96
export const PULL_TRIGGER = 64

export type Lock = 'horizontal' | 'vertical'
export type Decision = 'next' | 'prev' | 'cancel'
export interface Sample { x: number; y: number; t: number }

/** Indirection so tests can control time. */
export const swipeClock = { now: (): number => performance.now() }

export function lockFor(dx: number, dy: number): Lock | null {
  if (Math.hypot(dx, dy) < LOCK_PX) return null
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
}

export function dragOffset(dx: number, index: number, count: number): number {
  const pastEnd = (dx > 0 && index === 0) || (dx < 0 && index === count - 1)
  return pastEnd ? dx * RUBBER : dx
}

export function releaseDecision(dx: number, velocity: number, width: number, index: number, count: number): Decision {
  if (dx === 0) return 'cancel'
  const target = index + (dx < 0 ? 1 : -1)
  if (target < 0 || target >= count) return 'cancel'
  const far = Math.abs(dx) > width * COMMIT_RATIO
  const fast = Math.sign(velocity) === Math.sign(dx) && Math.abs(velocity) > COMMIT_VELOCITY
  if (!far && !fast) return 'cancel'
  return dx < 0 ? 'next' : 'prev'
}

export function pullDistance(dy: number): number {
  return Math.min(Math.max(dy, 0) * PULL_RATIO, PULL_MAX)
}

const CONTROLS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

export function startsOnControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(CONTROLS) !== null
}

/** Edge zones are left to the browser's back gesture; dialogs own their touches. */
export function ignoreStart(target: EventTarget | null, x: number, width: number): boolean {
  if (x < EDGE_PX || x > width - EDGE_PX) return true
  if (document.querySelector('[aria-modal="true"]')) return true
  return startsOnControl(target)
}

export function velocityOf(prev: Sample, last: Sample, axis: 'x' | 'y', now: number): number {
  if (now - last.t > 100 || last.t === prev.t) return 0
  return (last[axis] - prev[axis]) / (last.t - prev.t)
}

export interface TabSwipeHandlers {
  /** Horizontal lock: raw finger distance on every move. */
  onDrag(dx: number): void
  onRelease(dx: number, velocity: number): void
  /** Set to enable pull to refresh: called on every move of a downward pull that started at scroll top. */
  onPull?(dy: number): void
  onPullEnd?(dy: number): void
}

/**
 * One touch stream for both gestures. After a 10px lock, sideways is a tab swipe and down-at-top is a pull;
 * anything else is left to native scrolling. `touchmove` is non-passive so a locked gesture can block scrolling.
 */
export function useTabSwipe(ref: RefObject<HTMLElement | null>, enabled: boolean, handlers: TabSwipeHandlers): void {
  const handlersRef = useRef(handlers)
  useLayoutEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    let start: Sample | null = null
    let prev: Sample = { x: 0, y: 0, t: 0 }
    let last: Sample = prev
    let lock: 'horizontal' | 'pull' | 'ignored' | null = null
    let atTop = false

    function onStart(event: TouchEvent): void {
      const touch = event.touches[0]
      if (event.touches.length !== 1 || ignoreStart(event.target, touch.clientX, window.innerWidth)) {
        start = null
        return
      }
      start = { x: touch.clientX, y: touch.clientY, t: swipeClock.now() }
      prev = start
      last = start
      lock = null
      atTop = window.scrollY <= 0
    }

    function onMove(event: TouchEvent): void {
      if (!start) return
      const touch = event.touches[0]
      prev = last
      last = { x: touch.clientX, y: touch.clientY, t: swipeClock.now() }
      const dx = last.x - start.x
      const dy = last.y - start.y
      const canPull = atTop && handlersRef.current.onPull !== undefined
      if (lock === null) {
        // At the top there is nothing to scroll up to, so block the native bounce before the lock decides.
        if (canPull && dy > 0 && event.cancelable) event.preventDefault()
        const next = lockFor(dx, dy)
        if (next === null) return
        lock = next === 'horizontal' ? 'horizontal' : canPull && dy > 0 ? 'pull' : 'ignored'
      }
      if (lock === 'horizontal') {
        if (event.cancelable) event.preventDefault()
        handlersRef.current.onDrag(dx)
      } else if (lock === 'pull') {
        if (event.cancelable) event.preventDefault()
        handlersRef.current.onPull?.(dy)
      }
    }

    function onEnd(event: TouchEvent): void {
      if (!start) return
      const touch = event.changedTouches[0]
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (lock === 'horizontal') handlersRef.current.onRelease(dx, velocityOf(prev, last, 'x', swipeClock.now()))
      else if (lock === 'pull') handlersRef.current.onPullEnd?.(dy)
      start = null
      lock = null
    }

    function onCancel(): void {
      if (lock === 'horizontal') handlersRef.current.onRelease(0, 0)
      else if (lock === 'pull') handlersRef.current.onPullEnd?.(0)
      start = null
      lock = null
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onCancel)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [ref, enabled])
}
