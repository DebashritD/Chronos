import type { WeekCell, WeekHabit } from '../../api/types'
import { isColor } from '../../lib/cells'
import { formatTimeLeft, isUrgent } from '../../lib/timeLeft'
import { streakText } from './streakText'

/**
 * Mono line under a habit's name: its streak, then (open periods only) the time left; daily habits show time left
 * only once it's urgent, since the header carries the day's countdown.
 */
export function StreakLine({ habit, cell, streak, now }: { habit: WeekHabit; cell: WeekCell; streak: number | undefined; now: Date }) {
  const left = cell.closesAt && !isColor(cell.state) ? formatTimeLeft(cell.closesAt, now, habit.frequency) : null
  const urgent = left !== null && cell.closesAt !== null && isUrgent(cell.closesAt, now)
  const showLeft = left !== null && (habit.frequency !== 'DAILY' || urgent)
  const text = streak === undefined ? null : streakText(habit.frequency, streak)
  if (!text && !showLeft) return null
  return (
    <p className="mt-1 font-mono text-[12px] text-muted">
      {text && (
        <>
          {text.count !== null && (
            <><span className="sr-only">Current streak </span><b className="font-medium text-ink">{text.count}</b>{' '}</>
          )}
          {text.rest}
        </>
      )}
      {showLeft && (
        <>
          {text && ' · '}
          <span data-tone={urgent ? 'urgent' : 'normal'} className={urgent ? 'text-accent' : undefined}>{left}</span>
        </>
      )}
    </p>
  )
}
