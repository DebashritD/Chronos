import type { WeekCell, WeekHabit } from '../../api/types'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { addDays, dayOfMonth, WEEKDAYS } from '../../lib/dates'
import { coversToday, periodLabel } from '../checkin/period'

function subtitle(habit: WeekHabit): string | null {
  if (habit.frequency === 'WEEKLY') return 'weekly'
  if (habit.frequency === 'EVERY_N_DAYS') return `every ${habit.intervalDays} days`
  return null
}

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
              const isToday = coversToday(habit, cell, today)
              const weekly = habit.frequency === 'WEEKLY'
              return (
                <td key={cell.date} colSpan={weekly ? 7 : undefined}>
                  <button
                    type="button"
                    aria-label={`${habit.name}, ${periodLabel(habit, cell)}, ${STATE_LABEL[cell.state]}`}
                    aria-current={isToday ? 'date' : undefined}
                    disabled={!cell.editable}
                    onClick={() => onPick(habit, cell)}
                    className={`block w-full rounded-cell ${weekly ? 'h-[34px]' : 'aspect-square'} ${cellClass(cell.state)} ${
                      isToday ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : ''
                    } ${cell.editable ? 'cursor-pointer transition-transform active:scale-95' : cell.state === 'NOT_DUE' ? '' : 'opacity-50'}`}
                  />
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
