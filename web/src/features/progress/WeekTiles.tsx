import { Flame } from 'lucide-react'
import type { WeekCell, WeekHabit } from '../../api/types'
import { cellClass } from '../../lib/cells'
import { addDays, dayOfMonth, WEEKDAYS } from '../../lib/dates'
import { WeekCellButton } from './WeekCellButton'
import { subtitle, weekSegments } from './weekLayout'

const tile = 'rounded-card border border-line bg-card p-4'
const days = 'grid grid-cols-7 gap-1.5'
const cellHeight = 'h-10 md:h-11'

interface WeekTilesProps {
  start: string
  today: string
  habits: WeekHabit[]
  streakOf(habitId: number): number | undefined
  onPick(habit: WeekHabit, cell: WeekCell): void
}

/** Progress week: a shared Mon–Sun header, then one tile per habit with its full name above a full-width tracker. */
export function WeekTiles({ start, today, habits, streakOf, onPick }: WeekTilesProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Every cell's label already names its day, so the header is visual only. */}
      <div aria-hidden="true" className={`${tile} ${days} py-3 text-center text-[11px] font-medium text-muted`}>
        {WEEKDAYS.map((weekday, i) => {
          const date = addDays(start, i)
          return (
            <span key={weekday}>
              {weekday}
              <span className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                date === today ? 'bg-accent text-bg' : 'text-fg'
              }`}>
                {dayOfMonth(date)}
              </span>
            </span>
          )
        })}
      </div>
      <ul className="flex flex-col gap-3">
        {habits.map((habit) => {
          const sub = subtitle(habit)
          const streak = streakOf(habit.id)
          return (
            <li key={habit.id} aria-label={habit.name} className={tile}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[16px] leading-snug font-bold break-words text-fg">{habit.name}</h3>
                  {sub && <p className="mt-0.5 text-[12px] text-dim first-letter:uppercase">{sub}</p>}
                </div>
                {streak !== undefined && streak > 0 && (
                  <span className="flex flex-none items-center gap-1 font-display text-[14px] font-bold text-fg">
                    <Flame size={16} className="text-urgent" aria-hidden="true" />
                    <span className="sr-only">Current streak </span>
                    {streak}
                  </span>
                )}
              </div>
              <div className={days}>
                {weekSegments(habit, start).map(({ col, span, cell, from, to }) => (
                  <div key={col} style={{ gridColumn: `${col + 1} / span ${span}` }}>
                    {cell ? (
                      <WeekCellButton habit={habit} cell={cell} isToday={from <= today && today <= to} onPick={onPick}
                        shape={cellHeight} />
                    ) : (
                      <span aria-hidden="true" className={`block rounded-cell ${cellHeight} ${cellClass('NOT_DUE')}`} />
                    )}
                  </div>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default WeekTiles
