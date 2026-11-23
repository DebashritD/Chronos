import type { CurrentPeriod, Habit, WeekHabit, WeekView } from '../../api/types'
import { addDays, weekdayIndex } from '../../lib/dates'
import { startOfDayIn, todayIn } from '../../lib/zonedTime'

type Schedule = Pick<Habit, 'frequency' | 'intervalDays' | 'startDate'>

function periodLength({ frequency, intervalDays }: Schedule): number {
  if (frequency === 'WEEKLY') return 7
  if (frequency === 'EVERY_N_DAYS') return intervalDays ?? 1
  return 1
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** Mirrors the server's `HabitSchedule.periodContaining`: the period start containing `date`, or null before the first period. */
export function periodContaining(schedule: Schedule, date: string): string | null {
  const first = schedule.frequency === 'WEEKLY'
    ? addDays(schedule.startDate, -weekdayIndex(schedule.startDate))
    : schedule.startDate
  if (date < first) return null
  return addDays(date, -(daysBetween(first, date) % periodLength(schedule)))
}

/**
 * The saved week with each active habit's current period re-derived for the device's today, so Today moves on to new
 * periods offline after midnight. Paused habits keep their saved current (the server still lists them in the week);
 * habits missing from the saved habits list (archived) are dropped. Same day (or habits not loaded): the saved week as is.
 */
export function localTodayWeek(week: WeekView, habits: Habit[] | undefined, timezone: string, now: Date): WeekView {
  const today = todayIn(timezone, now)
  if (today <= week.today || !habits) return week
  const saved = new Map(week.habits.map((h) => [h.id, h]))
  const rows = habits
    .map((habit): WeekHabit => {
      const row = saved.get(habit.id)
      const start = periodContaining(habit, today)
      let current: CurrentPeriod | null = null
      if (habit.status === 'PAUSED') {
        current = row?.current ?? null
      } else if (start !== null) {
        const closesAt = startOfDayIn(addDays(start, periodLength(habit)), timezone)
        const kept = row?.current?.periodStart === start ? row.current : null
        current = kept
          ? { ...kept, closesAt }
          : { periodStart: start, state: 'PENDING', editable: true, note: null, closesAt }
      }
      return { id: habit.id, name: habit.name, minText: habit.minText, targetText: habit.targetText,
        frequency: habit.frequency, intervalDays: habit.intervalDays ?? null, status: habit.status, current,
        cells: row?.cells ?? [] }
    })
  return { ...week, today, habits: rows }
}
