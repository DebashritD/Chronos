import { useEffect, useRef, useState } from 'react'
import { subscribePending } from '../api/pending'

const WAKE_DELAY_MS = 3000

/**
 * Shows a "Waking the server…" notice once a request has been pending for
 * at least 3 s (the cold-start case), and hides it as soon as all requests
 * settle.
 */
export function WakingNotice() {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return subscribePending((count) => {
      if (count > 0) {
        if (timerRef.current === null) {
          timerRef.current = setTimeout(() => {
            setVisible(true)
          }, WAKE_DELAY_MS)
        }
      } else {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        setVisible(false)
      }
    })
  }, [])

  if (!visible) {
    return null
  }

  return (
    <div
      role="status"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded bg-surface px-4 py-2 text-sm text-muted shadow md:bottom-4"
    >
      Waking the server…
    </div>
  )
}

export default WakingNotice
