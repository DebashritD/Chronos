import type { CellState, WeekCell, WeekHabit } from '../../api/types'
import { Mark } from '../../app/Mark'
import { brightness } from '../../lib/brightness'
import { markKind } from '../../lib/cells'
import { addDays, dayOfMonth, WEEKDAYS } from '../../lib/dates'
import { WeekCellButton } from './WeekCellButton'
import { frequencyText, weekSegments, type Segment } from './weekLayout'

const NAME_COL = '6.5rem'
const GRID = 'grid grid-cols-[6.5rem_repeat(7,minmax(0,1fr))]'
const inRun = (state: CellState | undefined) => state === 'GREEN' || state === 'YELLOW'
const TONE: Partial<Record<CellState, string>> = { GREEN: 'text-cell-green', YELLOW: 'text-cell-yellow', RED: 'text-cell-red' }

interface WeekTilesProps {
  start: string
  today: string
  habits: WeekHabit[]
  onPick(habit: WeekHabit, cell: WeekCell): void
}

/** A period longer than a day: a line with end ticks across it, its dot centred on the same line. */
function Bracket({ state, future, dim }: { state: CellState; future: boolean; dim: boolean }) {
  const tone = TONE[state] ?? (future ? 'text-rule-2' : 'text-ring')
  return (
    <span aria-hidden="true" className={`absolute inset-x-2 top-1/2 h-2.5 -translate-y-1/2 ${tone} ${dim ? 'opacity-30' : TONE[state] ? 'opacity-60' : ''}`}>
      <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-current" />
      <span className="absolute inset-y-0 left-0 w-[1.5px] bg-current" />
      <span className="absolute inset-y-0 right-0 w-[1.5px] bg-current" />
    </span>
  )
}

function HabitMarks({ habit, start, today, onPick }: { habit: WeekHabit; start: string; today: string; onPick: WeekTilesProps['onPick'] }) {
  const segments = weekSegments(habit, start)
  const bright = brightness(segments.map((segment) => segment.cell?.state ?? 'NOT_DUE'))
  const daily = habit.frequency === 'DAILY'
  return segments.map(({ col, span, cell, from, to }: Segment, i) => {
    const style = { gridColumn: `${col + 2} / span ${span}` }
    if (!cell) return <span key={col} style={style} aria-hidden="true" />
    const future = from > today
    const kind = markKind(cell.state, future)
    const dim = !bright[i]
    const joined = daily && i > 0 && inRun(segments[i - 1].cell?.state) && inRun(cell.state)
    return (
      <div key={col} style={style} className="relative flex h-14 items-center">
        {joined && (
          <span aria-hidden="true" className={`absolute top-1/2 right-1/2 left-[-50%] h-[1.5px] -translate-y-1/2 ${
            cell.state === 'GREEN' ? 'bg-cell-green' : 'bg-cell-yellow'} ${dim ? 'opacity-30' : 'opacity-60'}`} />
        )}
        {!daily && cell.state !== 'NOT_DUE' && <Bracket state={cell.state} future={future} dim={dim} />}
        <WeekCellButton habit={habit} cell={cell} isToday={from <= today && today <= to} onPick={onPick}>
          {kind && <Mark kind={kind} dim={dim && kind !== 'RED'} />}
        </WeekCellButton>
      </div>
    )
  })
}

/** Progress week: Monday-first columns, one ruled row per habit with dot marks; today's column is tinted. */
export function WeekTiles({ start, today, habits, onPick }: WeekTilesProps) {
  const todayCol = WEEKDAYS.findIndex((_, i) => addDays(start, i) === today)
  return (
    <div>
      <div className="relative">
      {todayCol >= 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 rounded-full bg-accent/[0.06]"
          style={{ left: `calc(${NAME_COL} + (100% - ${NAME_COL}) * ${todayCol} / 7)`, width: `calc((100% - ${NAME_COL}) / 7)` }} />
      )}
      {/* Every cell's label already names its day, so the header is visual only. */}
      <div aria-hidden="true" className={`${GRID} pb-2 text-center`}>
        <span />
        {WEEKDAYS.map((weekday, i) => {
          const date = addDays(start, i)
          return (
            <span key={weekday} className="flex flex-col items-center">
              <span className={`text-[10px] font-semibold tracking-[0.14em] ${date === today ? 'text-accent' : 'text-muted'}`}>
                {weekday.charAt(0)}
              </span>
              <span className={`font-display text-[15px] leading-tight ${date > today ? 'text-muted' : 'text-ink'}`}>{dayOfMonth(date)}</span>
            </span>
          )
        })}
      </div>
      <ul>
        {habits.map((habit) => (
          <li key={habit.id} aria-label={habit.name} className={`${GRID} items-center border-b border-rule`}>
            <div className="min-w-0 py-2 pr-2">
              <h3 className="font-display text-[17px] leading-[1.15] break-words hyphens-auto text-ink">{habit.name}</h3>
              <p className="font-mono text-[11px] text-muted">{frequencyText(habit)}</p>
            </div>
            <HabitMarks habit={habit} start={start} today={today} onPick={onPick} />
          </li>
        ))}
      </ul>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><Mark kind="GREEN" size={10} /> bright: current run</span>
        <span className="flex items-center gap-1.5"><Mark kind="GREEN" size={10} dim /> dim: before the last miss</span>
      </p>
    </div>
  )
}

export default WeekTiles
