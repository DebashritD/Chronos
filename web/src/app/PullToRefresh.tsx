import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { PULL_TRIGGER, pullDistance } from './useTabSwipe'

export const MIN_SPIN_MS = 400
export const OFFLINE_MS = 1200
export const RETURN_MS = 200

export interface PullToRefreshHandle {
  move(dy: number): void
  release(dy: number): void
}

type Phase = 'idle' | 'pulling' | 'refreshing' | 'offline'

const CHIP = 36
const ARC = 2 * Math.PI * 7

/** The pull chip at the top of the screen. Driven by SwipeTabs through the handle. */
export function PullToRefresh({ ref }: { ref: Ref<PullToRefreshHandle> }) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [pull, setPull] = useState(0)
  const busy = useRef(false)

  useImperativeHandle(ref, () => {
    function reset(): void {
      busy.current = false
      setPhase('idle')
      setPull(0)
    }
    return {
      move(dy) {
        if (busy.current) return
        setPhase('pulling')
        setPull(pullDistance(dy))
      },
      release(dy) {
        if (busy.current) return
        if (pullDistance(dy) < PULL_TRIGGER) {
          reset()
          return
        }
        busy.current = true
        setPull(PULL_TRIGGER)
        if (!onlineManager.isOnline()) {
          setPhase('offline')
          setTimeout(reset, OFFLINE_MS)
          return
        }
        setPhase('refreshing')
        const minimum = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS))
        void Promise.allSettled([queryClient.refetchQueries({ type: 'active' }), minimum]).then(reset)
      },
    }
  }, [queryClient])

  const progress = Math.min(pull / PULL_TRIGGER, 1)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-20 flex justify-center md:hidden"
      style={{
        transform: `translateY(${pull - CHIP - 8}px)`,
        transition: phase === 'pulling' ? 'none' : `transform ${RETURN_MS}ms ease-out`,
      }}>
      <div role="status"
        className="flex h-9 min-w-9 items-center justify-center rounded-full border border-line bg-surface px-2 text-[13px] text-muted shadow-[0_8px_24px_rgb(0_0_0/0.45)]">
        {phase === 'offline' ? 'Offline' : (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"
            className={phase === 'refreshing' ? 'animate-spin motion-reduce:animate-none' : ''}>
            <circle cx="9" cy="9" r="7" fill="none" stroke="var(--color-accent)" strokeWidth="2.2" strokeLinecap="round"
              strokeDasharray={`${ARC * (phase === 'refreshing' ? 0.75 : progress)} ${ARC}`} transform="rotate(-90 9 9)" />
          </svg>
        )}
        {phase === 'refreshing' && <span className="sr-only">Refreshing</span>}
      </div>
    </div>
  )
}

export default PullToRefresh
