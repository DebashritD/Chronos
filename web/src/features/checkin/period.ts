import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays, formatDay } from '../../lib/dates'

type HabitLike = Pick<WeekHabit, 'frequency'>
type CellLike = Pick<WeekCell, 'date'>

/** "Wed 18 Nov", or "week of Mon 16 Nov" for weekly habits. */
export function periodLabel(habit: HabitLike, cell: CellLike): string {
  return habit.frequency === 'WEEKLY' ? `week of ${formatDay(cell.date)}` : formatDay(cell.date)
}

/** A weekly cell covers its whole Mon–Sun week; other cells cover one day. */
export function coversToday(habit: HabitLike, cell: CellLike, today: string): boolean {
  return habit.frequency === 'WEEKLY' ? cell.date <= today && today <= addDays(cell.date, 6) : cell.date === today
}
