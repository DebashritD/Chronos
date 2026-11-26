import { useRef, useState, type TouchEvent } from 'react'

const LATER_RATIO = 0.25
const DELETE_RATIO = 0.6
const LOCK_PX = 8

export type SwipeOutcome = 'none' | 'later' | 'delete'

export function swipeOutcome(dx: number, width: number, inLater: boolean): SwipeOutcome {
  if (dx >= 0 || width <= 0) return 'none'
  const ratio = -dx / width
  if (ratio > DELETE_RATIO || (inLater && ratio > LATER_RATIO)) return 'delete'
  return ratio > LATER_RATIO ? 'later' : 'none'
}

/** Leftward drag on one row; vertical drags are left to the page scroll. */
export function useRowSwipe(inLater: boolean, onCommit: (outcome: Exclude<SwipeOutcome, 'none'>) => void) {
  const [drag, setDrag] = useState({ dx: 0, width: 0 })
  const start = useRef<{ x: number; y: number; width: number; dx: number; lock: 'x' | 'y' | null } | null>(null)

  return {
    dx: drag.dx,
    outcome: swipeOutcome(drag.dx, drag.width, inLater),
    handlers: {
      onTouchStart(e: TouchEvent<HTMLElement>) {
        const t = e.touches[0]
        start.current = { x: t.clientX, y: t.clientY, width: e.currentTarget.getBoundingClientRect().width, dx: 0, lock: null }
      },
      onTouchMove(e: TouchEvent<HTMLElement>) {
        const s = start.current
        if (!s) return
        const t = e.touches[0]
        const mx = t.clientX - s.x, my = t.clientY - s.y
        if (s.lock === null && Math.max(Math.abs(mx), Math.abs(my)) > LOCK_PX) s.lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
        if (s.lock === 'x') {
          s.dx = Math.min(0, mx)
          setDrag({ dx: s.dx, width: s.width })
        }
      },
      onTouchEnd() {
        const s = start.current
        const outcome = s ? swipeOutcome(s.dx, s.width, inLater) : 'none'
        start.current = null
        setDrag({ dx: 0, width: 0 })
        if (outcome !== 'none') onCommit(outcome)
      },
      onTouchCancel() {
        start.current = null
        setDrag({ dx: 0, width: 0 })
      },
    },
  }
}
