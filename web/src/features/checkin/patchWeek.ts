import type { CellState, Color, CurrentPeriod, WeekView } from '../../api/types'

/** Variables of a queued check-in mutation (persisted with the cache, so keep them plain data). */
export interface CheckInVars {
  op: 'save' | 'clear'
  habitId: number
  periodStart: string
  color?: Color
  note?: string | null
}

/** The week as it will look once the mark syncs: shown at once, even offline. */
export function patchWeek(week: WeekView, vars: CheckInVars): WeekView {
  const state: CellState = vars.op === 'save' && vars.color ? vars.color : 'PENDING'
  const note = vars.op === 'save' ? (vars.note ?? null) : null
  return {
    ...week,
    habits: week.habits.map((habit) => {
      if (habit.id !== vars.habitId) return habit
      const current: CurrentPeriod | null = habit.current
      let nextCurrent = current
      if (current?.periodStart === vars.periodStart) {
        nextCurrent = { ...current, state, note }
      } else if (current === null || vars.periodStart > current.periodStart) {
        // A period derived on the device after midnight; localTodayWeek recomputes its closesAt.
        nextCurrent = { periodStart: vars.periodStart, state, editable: true, note, closesAt: current?.closesAt ?? '' }
      }
      return {
        ...habit,
        current: nextCurrent,
        cells: habit.cells.map((cell) => (cell.periodStart === vars.periodStart ? { ...cell, state, note } : cell)),
      }
    }),
  }
}
