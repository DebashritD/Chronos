import type { CellState } from '../../api/types'
import type { Summary } from './todaySummary'

const SEGMENT: Partial<Record<CellState, string>> = { GREEN: 'bg-cell-green', YELLOW: 'bg-cell-yellow', RED: 'bg-cell-red' }

/** Borderless summary above the Today cards: state headline, a line, the countdown and one segment per habit. */
export function TodaySummary({ summary }: { summary: Summary }) {
  const { headline, line, tone, countdown, segments, label } = summary
  return (
    <section aria-label="Today's progress" className="mb-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className={`text-[26px] leading-tight font-semibold tracking-[-0.035em] ${tone === 'green' ? 'text-cell-green' : 'text-fg'}`}>
            {headline}
          </h2>
          <p className="mt-1 text-[15px] leading-snug text-muted">{line}</p>
        </div>
        {countdown && (
          <span className={`mb-0.5 flex-none text-[13px] ${countdown.urgent ? 'text-accent' : 'text-dim'}`}>{countdown.text}</span>
        )}
      </div>
      {segments.length > 0 && (
        <div role="img" aria-label={label} className="mt-3.5 flex gap-1">
          {segments.map((state, i) => (
            <span key={i} className={`h-[5px] flex-1 rounded-full ${SEGMENT[state] ?? 'bg-cell-grey'}`} />
          ))}
        </div>
      )}
    </section>
  )
}
