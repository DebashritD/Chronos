/* oxlint-disable react/only-export-components -- scoreClass is the grid's colour scale, kept beside it */
import { dayOfMonth, weekdayIndex, WEEKDAYS } from '../../lib/dates'

export interface CalendarDay {
  date: string
  className: string
  label: string
}

/**
 * Daily score (GREEN = 2, YELLOW = 1, RED/GREY = 0, averaged over habits due that day) on a five-step
 * red → green scale. Thresholds are explicit so 1.25 lands in step 3 without float surprises.
 */
export function scoreClass(score: number | null): string {
  if (score === null) return 'bg-surface text-dim'
  if (score < 0.4) return 'bg-score-0 text-bg'
  if (score < 0.8) return 'bg-score-1 text-bg'
  if (score < 1.2) return 'bg-score-2 text-bg'
  if (score < 1.6) return 'bg-score-3 text-bg'
  return 'bg-score-4 text-bg'
}

interface CalendarGridProps {
  days: CalendarDay[]
  showNumbers?: boolean
  compact?: boolean
}

/** One month as a Monday-first 7-column grid. */
export function CalendarGrid({ days, showNumbers = false, compact = false }: CalendarGridProps) {
  const blanks = days.length > 0 ? weekdayIndex(days[0].date) : 0
  return (
    <div className={`grid grid-cols-7 ${compact ? 'gap-[3px]' : 'gap-1.5'}`}>
      {!compact && WEEKDAYS.map((weekday) => (
        <div key={weekday} className="pb-1 text-center text-[11px] font-medium text-muted" aria-hidden="true">
          {weekday.charAt(0)}
        </div>
      ))}
      {Array.from({ length: blanks }, (_, i) => <div key={`blank-${i}`} data-blank />)}
      {days.map((day) => (
        <div key={day.date} role="img" aria-label={day.label}
          className={`aspect-square ${compact ? 'rounded-[3px]' : 'rounded-[8px] p-1 text-[11px] font-semibold'} ${day.className}`}>
          {showNumbers && dayOfMonth(day.date)}
        </div>
      ))}
    </div>
  )
}

export default CalendarGrid
