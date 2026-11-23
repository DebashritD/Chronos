import { useEffect, useState } from 'react'
import { subscribeSyncToast } from '../lib/syncToast'

export const SYNC_TOAST_MS = 4000

/** Quiet one-line notice for a mark that couldn't sync; dismisses itself. */
export function SyncToast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => subscribeSyncToast(setMessage), [])

  useEffect(() => {
    if (message === null) return
    const timer = setTimeout(() => setMessage(null), SYNC_TOAST_MS)
    return () => clearTimeout(timer)
  }, [message])

  if (message === null) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-5 md:bottom-8">
      <p role="status" className="max-w-sm truncate rounded-2xl border border-line bg-surface px-4 py-3 text-[14px] text-fg shadow-[0_8px_24px_rgb(0_0_0/0.45)]">
        {message}
      </p>
    </div>
  )
}

export default SyncToast
