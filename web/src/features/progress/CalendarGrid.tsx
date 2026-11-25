/* oxlint-disable react/only-export-components -- scoreClass is the grid's colour scale, kept beside it */
import { dayOfMonth, weekdayIndex, WEEKDAYS } from '../../lib/dates'

export interface CalendarDay {
  date: string
  className: string
  label: string
}

/**
 * Daily score (GREEN = 2, YELLOW = 1, RED = 0, averaged over the marks that day) on a five-step red → green scale;
 * null (nothing marked, or a future day) stays neutral. Thresholds are explicit so 1.25 lands in step 3.
 */
export function scoreClass(score: number | null): string {
  if (score === null) return 'border-[1.5px] border-faint text-muted'
  if (score < 0.4) return 'bg-score-0/30 text-ink'
  if (score < 0.8) return 'bg-score-1/30 text-ink'
  if (score < 1.2) return 'bg-score-2/30 text-ink'
  if (score < 1.6) return 'bg-score-3/30 text-ink'
  return 'bg-score-4 text-paper'
}

/** One month as a Monday-first wall calendar: a serif numeral on a score-coloured circle. */
export function CalendarGrid({ days }: { days: CalendarDay[] }) {
  const blanks = days.length > 0 ? weekdayIndex(days[0].date) : 0
  return (
    <div className="grid grid-cols-7 gap-y-1.5">
      {WEEKDAYS.map((weekday) => (
        <div key={weekday} aria-hidden="true" className="pb-1 text-center text-[10px] font-semibold tracking-[0.14em] text-muted">
          {weekday.charAt(0)}
        </div>
      ))}
      {Array.from({ length: blanks }, (_, i) => <div key={`blank-${i}`} data-blank />)}
      {days.map((day) => (
        <div key={day.date} role="img" aria-label={day.label}
          className={`mx-auto flex h-[34px] w-[34px] items-center justify-center rounded-full font-serif text-[16px] ${day.className}`}>
          {dayOfMonth(day.date)}
        </div>
      ))}
    </div>
  )
}

export default CalendarGrid
