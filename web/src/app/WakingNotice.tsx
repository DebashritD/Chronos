import { useEffect, useRef, useState } from 'react'
import { subscribePending } from '../api/pending'
import { useOnline } from '../lib/useOnline'

const WAKE_DELAY_MS = 3000

/**
 * Shows a "Waking the server…" notice once a request has been pending for
 * at least 3 s (the cold-start case), and hides it as soon as all requests
 * settle.
 */
export function WakingNotice() {
  const online = useOnline()
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

  // Offline nothing is waking; the SyncStatus line says "Offline" instead.
  if (!visible || !online) {
    return null
  }

  return (
    <div
      role="status"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded-[10px] bg-ink px-4 py-2 font-mono text-[12px] text-paper shadow-[0_8px_24px_rgb(29_27_24/0.3)] md:bottom-4"
    >
      Waking the server…
    </div>
  )
}

export default WakingNotice
