import type { WeekCell, WeekHabit, WeekView } from '../../api/types'

export interface TodayItem {
  habit: WeekHabit
  cell: WeekCell
}

/**
 * Each habit's current period (the one containing today), as a cell dated at the period start so the card and the
 * picker can treat it like a week cell. Multi-day periods show on every one of their days, even when they began
 * before this week. Habits with no current period yet, paused (including mid-period) or not editable are left out.
 */
export function todayItems(week: WeekView): TodayItem[] {
  return week.habits.flatMap((habit) => {
    if (habit.status === 'PAUSED') return []
    const current = habit.current
    if (current === null || !current.editable || current.state === 'PAUSED') return []
    return [{ habit, cell: { date: current.periodStart, ...current } }]
  })
}
