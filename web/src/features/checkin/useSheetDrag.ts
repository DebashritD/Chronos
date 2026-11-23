import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { COMMIT_VELOCITY, lockFor, startsOnControl, swipeClock, velocityOf, type Sample } from '../../app/useTabSwipe'

export const SHEET_CLOSE_RATIO = 0.3
export const SHEET_SETTLE_MS = 200

export function shouldCloseSheet(dy: number, velocity: number, height: number): boolean {
  return dy > height * SHEET_CLOSE_RATIO || velocity > COMMIT_VELOCITY
}

interface Options { enabled: boolean; reduced: boolean; onClose(): void }

/** Drag a bottom sheet down to close it. Upward drags don't move it. */
export function useSheetDrag(ref: RefObject<HTMLElement | null>, { enabled, reduced, onClose }: Options): void {
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const sheet = el
    let start: Sample | null = null
    let prev: Sample = { x: 0, y: 0, t: 0 }
    let last: Sample = prev
    let lock: 'down' | 'ignored' | null = null
    let timer: number | undefined

    function place(y: number, ms = 0): void {
      sheet.style.transition = ms ? `transform ${ms}ms ease-out` : ''
      sheet.style.transform = y ? `translateY(${y}px)` : ''
    }

    function onStart(event: TouchEvent): void {
      if (event.touches.length !== 1 || startsOnControl(event.target)) {
        // A second finger ends any drag in progress; snap the sheet back so it doesn't stay half-open.
        onCancel()
        return
      }
      const touch = event.touches[0]
      start = { x: touch.clientX, y: touch.clientY, t: swipeClock.now() }
      prev = start
      last = start
      lock = null
    }

    function onMove(event: TouchEvent): void {
      if (!start) return
      const touch = event.touches[0]
      prev = last
      last = { x: touch.clientX, y: touch.clientY, t: swipeClock.now() }
      const dx = last.x - start.x
      const dy = last.y - start.y
      if (lock === null) {
        const next = lockFor(dx, dy)
        if (next === null) return
        lock = next === 'vertical' && dy > 0 ? 'down' : 'ignored'
      }
      if (lock !== 'down') return
      if (event.cancelable) event.preventDefault()
      if (!reduced) place(Math.max(dy, 0))
    }

    function onEnd(event: TouchEvent): void {
      if (!start || lock !== 'down') {
        start = null
        return
      }
      const dy = Math.max(event.changedTouches[0].clientY - start.y, 0)
      const velocity = velocityOf(prev, last, 'y', swipeClock.now())
      start = null
      lock = null
      if (!shouldCloseSheet(dy, velocity, sheet.offsetHeight)) {
        place(0, reduced ? 0 : SHEET_SETTLE_MS)
        return
      }
      if (reduced) {
        onCloseRef.current()
        return
      }
      place(sheet.offsetHeight, SHEET_SETTLE_MS)
      timer = window.setTimeout(() => onCloseRef.current(), SHEET_SETTLE_MS)
    }

    function onCancel(): void {
      if (lock === 'down') place(0)
      start = null
      lock = null
    }

    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onCancel)
    return () => {
      window.clearTimeout(timer)
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onCancel)
    }
  }, [ref, enabled, reduced])
}
