import { useEffect, useState, type ReactNode } from 'react'
import { YellowLimitContext, type YellowLimitHit } from '../lib/yellowLimit'
import { Mark } from './Mark'
import { inkButton } from '../lib/ui'

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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-binding/45 px-6"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setHit(null)
          }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="yellow-limit-title" aria-describedby="yellow-limit-text"
            className="w-full max-w-sm rounded-[12px] border border-rule-2 bg-paper p-6 text-center shadow-[0_20px_50px_rgb(29_27_24/0.25)]">
            <span className="mx-auto mb-3 block w-fit" aria-hidden="true"><Mark kind="YELLOW" size={36} /></span>
            <h2 id="yellow-limit-title" className="font-serif text-[26px] text-ink">Minimum limit reached</h2>
            <p id="yellow-limit-text" className="mt-2 text-[15px] text-muted">
              You've hit {hit.limit} minimums in a row on {hit.name}. Next time hit the target, or the streak starts over.
            </p>
            <button type="button" autoFocus onClick={() => setHit(null)} className={`${inkButton} mt-5 w-full`}>
              Got it
            </button>
          </div>
        </div>
      )}
      {hit?.kind === 'reset' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-5 md:bottom-8">
          <div role="status" className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[10px] bg-ink p-4 text-paper">
            <span className="flex-none" aria-hidden="true"><Mark kind="YELLOW" size={20} /></span>
            <p className="min-w-0 flex-1 text-[14px] leading-snug">
              Fresh start on {hit.name}: that was minimum {hit.limit + 1} in a row, so the streak is back to 1.
            </p>
            <button type="button" onClick={() => setHit(null)}
              className="-my-2 -mr-2 min-h-11 min-w-11 flex-none px-3 text-[14px] font-semibold text-paper underline">OK</button>
          </div>
        </div>
      )}
    </YellowLimitContext.Provider>
  )
}

export default YellowLimitProvider
