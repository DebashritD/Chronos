import { useState, type ReactNode } from 'react'
import { YellowLimitContext, type YellowLimitHit } from '../lib/yellowLimit'
import { primaryButton } from '../lib/ui'

/** App-wide so the warning outlives the picker or card that saved the yellow. */
export function YellowLimitProvider({ children }: { children: ReactNode }) {
  const [hit, setHit] = useState<YellowLimitHit | null>(null)
  return (
    <YellowLimitContext.Provider value={setHit}>
      {children}
      {hit && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
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
    </YellowLimitContext.Provider>
  )
}

export default YellowLimitProvider
