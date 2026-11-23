import { useEffect, useState, type ReactNode } from 'react'
import { YellowLimitContext, type YellowLimitHit } from '../lib/yellowLimit'
import { primaryButton } from '../lib/ui'

const RESET_NOTICE_MS = 6000

/** App-wide so the warning outlives the picker or card that saved the yellow. */
export function YellowLimitProvider({ children }: { children: ReactNode }) {
  const [hit, setHit] = useState<YellowLimitHit | null>(null)

  useEffect(() => {
    if (hit?.kind !== 'reset') return
    const timer = setTimeout(() => setHit(null), RESET_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [hit])

  return (
    <YellowLimitContext.Provider value={setHit}>
      {children}
      {hit?.kind === 'limit' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setHit(null)
          }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="yellow-limit-title" aria-describedby="yellow-limit-text"
            className="w-full max-w-sm rounded-[28px] border border-line bg-card p-6 text-center">
            <span className="mx-auto mb-3 block h-10 w-10 rounded-xl bg-cell-yellow" aria-hidden="true" />
            <h2 id="yellow-limit-title" className="text-[20px] font-extrabold text-fg">Yellow limit reached</h2>
            <p id="yellow-limit-text" className="mt-2 text-[15px] text-muted">
              You've hit {hit.limit} yellows in a row on {hit.name}. Next time go green, or the streak starts over.
            </p>
            <button type="button" autoFocus onClick={() => setHit(null)} className={`${primaryButton} mt-5 w-full`}>
              Got it
            </button>
          </div>
        </div>
      )}
      {hit?.kind === 'reset' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-5 md:bottom-8">
          <div role="status" className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_8px_24px_rgb(0_0_0/0.45)]">
            <span className="h-6 w-6 flex-none rounded-lg bg-cell-yellow" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-[14px] leading-snug text-fg">
              Fresh start on {hit.name}: that was yellow {hit.limit + 1} in a row, so the streak is back to 1.
            </p>
            <button type="button" onClick={() => setHit(null)}
              className="-my-2 -mr-2 min-h-11 min-w-11 flex-none rounded-full px-3 text-[14px] font-semibold text-accent">OK</button>
          </div>
        </div>
      )}
    </YellowLimitContext.Provider>
  )
}

export default YellowLimitProvider
