import { eyebrow } from '../../lib/ui'
import { useStreaks } from './api'

/** Current and best streak per habit; a broken run (current 0) fades its numeral only, so names and meta keep their contrast. Streaks count Target/Minimum periods. */
export function StreakList() {
  const { data } = useStreaks()
  return (
    <section aria-label="Streaks" className="mt-8 border-t border-rule-2 pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className={eyebrow}>Streaks</h2>
        <span aria-hidden="true" className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Now · best</span>
      </div>
      {data?.length === 0 && <p className="mt-2 text-sm text-muted">No habits yet</p>}
      <ul className="mt-1">
        {data?.map((streak) => (
          <li key={streak.habitId} aria-label={streak.name}
            className={`flex items-baseline gap-3 border-b border-rule py-2.5`}>
            <span className="min-w-0 flex-1 font-display text-[19px] leading-tight break-words text-ink">{streak.name}</span>
            <span className={`font-display text-[22px] leading-none font-bold text-ink ${streak.current === 0 ? 'opacity-45' : ''}`}>
              <span className="sr-only">Current streak </span>{streak.current}
            </span>
            <span className="w-16 text-right font-mono text-[12px] text-muted">best {streak.best}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default StreakList
