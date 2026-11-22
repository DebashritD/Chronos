import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays, dayOfMonth, WEEKDAYS } from '../../lib/dates'
import { coversToday } from '../checkin/period'
import { WeekCellButton } from './WeekCellButton'
import { subtitle } from './weekLayout'

interface WeekGridProps {
  start: string
  today: string
  habits: WeekHabit[]
  onPick(habit: WeekHabit, cell: WeekCell): void
}

/** Habits × Mon–Sun. Weekly habits have one cell spanning all 7 columns. */
export function WeekGrid({ start, today, habits, onPick }: WeekGridProps) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-[5px]">
      <thead>
        <tr>
          <th className="w-20 md:w-32"><span className="sr-only">Habit</span></th>
          {WEEKDAYS.map((weekday, i) => {
            const date = addDays(start, i)
            return (
              <th key={weekday} scope="col" className="text-center text-[11px] font-medium text-muted">
                {weekday}
                <span className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                  date === today ? 'bg-accent text-bg' : 'text-fg'
                }`}>
                  {dayOfMonth(date)}
                </span>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {habits.map((habit) => (
          <tr key={habit.id}>
            <th scope="row" className="pr-1 text-left align-middle">
              <span className="block truncate text-[13px] font-semibold text-fg md:text-sm">{habit.name}</span>
              {subtitle(habit) && <span className="block truncate text-[11px] font-normal text-dim">{subtitle(habit)}</span>}
            </th>
            {habit.cells.map((cell) => {
              const weekly = habit.frequency === 'WEEKLY'
              return (
                <td key={cell.date} colSpan={weekly ? 7 : undefined}>
                  <WeekCellButton habit={habit} cell={cell} isToday={coversToday(habit, cell, today)} onPick={onPick}
                    shape={weekly ? 'h-[34px]' : 'aspect-square'} />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default WeekGrid
