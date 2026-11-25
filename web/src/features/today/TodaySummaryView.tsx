import type { Summary } from './todaySummary'

/** Today's progress in words under the date; the rows themselves show state, so the segment bar is screen-reader only. */
export function TodaySummary({ summary }: { summary: Summary }) {
  const { headline, line, tone, label } = summary
  return (
    <section aria-label="Today's progress" className="mt-4 border-b border-rule-2 pb-4">
      <h2 className={`font-display text-[21px] leading-tight ${tone === 'green' ? 'text-cell-green' : 'text-ink'}`}>{headline}</h2>
      <p className="mt-0.5 text-[14px] text-muted">{line}</p>
      {summary.segments.length > 0 && <span role="img" aria-label={label} className="sr-only" />}
    </section>
  )
}
