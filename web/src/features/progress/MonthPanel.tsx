import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import type { MonthHabit } from '../../api/types'
import { Mark } from '../../app/Mark'
import { markKind, STATE_LABEL } from '../../lib/cells'
import { brightness } from '../../lib/brightness'
import { addMonths, formatDay, formatMonth } from '../../lib/dates'
import { eyebrow, iconButton, pageTitle, textButton } from '../../lib/ui'
import { useMonth } from '../stats/api'
import { DistributionBar } from '../stats/DistributionBar'
import { CalendarGrid, scoreClass } from './CalendarGrid'

/** Share of due periods (GREEN/YELLOW/RED/GREY) that were GREEN, or null when nothing was due. */
function greenShare(habit: MonthHabit): number | null {
  const due = habit.cells.filter(({ state }) => ['GREEN', 'YELLOW', 'RED', 'GREY'].includes(state)).length
  if (due === 0) return null
  return Math.round((habit.cells.filter(({ state }) => state === 'GREEN').length * 100) / due)
}

/** One dot per day of the month: same shapes and bright/dim rule as the week; PENDING (today/future) is faint. */
function HabitStrip({ habit }: { habit: MonthHabit }) {
  const share = greenShare(habit)
  const bright = brightness(habit.cells.map(({ state }) => state))
  return (
    <section aria-label={habit.name} className="border-b border-rule py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 font-serif text-[20px] leading-tight break-words text-ink">{habit.name}</h3>
        <span className="flex-none font-mono text-[12px] text-muted">{share === null ? '–' : `${share}% target`}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-[2.5px]">
        {habit.cells.map(({ date, state }, i) => {
          const kind = markKind(state, state === 'PENDING')
          return (
            <span key={date} role="img" aria-label={`${habit.name}, ${formatDay(date)}, ${STATE_LABEL[state]}`}>
              {kind ? <Mark kind={kind} size={8} dim={!bright[i] && kind !== 'RED'} /> : <span className="block h-2 w-2" />}
            </span>
          )
        })}
      </div>
    </section>
  )
}

export function MonthPanel({ toggle }: { toggle: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const month = searchParams.get('month') ?? undefined
  const { data, isPending, isError, fetchStatus } = useMonth(month)

  if (isPending) {
    return <>{toggle}<p className="mt-4 text-muted">{fetchStatus === 'paused' ? 'Connect to load this month.' : 'Loading…'}</p></>
  }
  if (isError) return <>{toggle}<p role="alert" className="mt-4 text-cell-red">Couldn't load this month.</p></>

  const goTo = (target: string) => setSearchParams({ view: 'month', month: target })
  const overview = data.overview.map(({ date, score }) => ({
    date,
    className: scoreClass(score),
    label: `${formatDay(date)}: ${score === null ? 'nothing marked' : `score ${score.toFixed(1)}`}`,
  }))

  return (
    <div>
      <p className={`${pageTitle} mt-1`}>{formatMonth(data.month).split(' ')[0]}</p>
      {toggle}
      <div className="mt-4 mb-4 flex items-center gap-1 border-y border-rule-2 py-1">
        <button type="button" aria-label="Previous month" className={iconButton} onClick={() => goTo(addMonths(data.month, -1))}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 text-center font-serif text-[22px] text-ink">{formatMonth(data.month)}</h2>
        <button type="button" aria-label="Next month" className={iconButton} onClick={() => goTo(addMonths(data.month, 1))}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      {month && <button type="button" className={`${textButton} mb-2`} onClick={() => setSearchParams({ view: 'month' })}>This month</button>}
      <section aria-label="Daily score" className="mt-2">
        <h3 className={`${eyebrow} mb-3`}>Daily score</h3>
        <CalendarGrid days={overview} />
        <div aria-hidden="true" className="mt-4 flex items-center gap-2 font-mono text-[11px] text-muted">
          <span>Missed</span>
          <span className="h-2 flex-1 rounded-full bg-linear-to-r from-score-0 via-score-2 to-score-4" />
          <span>Target</span>
          <span className="ml-2 h-3 w-3 flex-none rounded-full border-[1.5px] border-faint" />
          <span>not marked</span>
        </div>
      </section>
      <DistributionBar title="Distribution" caption={`${data.distribution.total} due`} distribution={data.distribution} />
      {data.habits.length > 0 && (
        <section aria-label="By habit" className="mt-8 border-t border-rule-2 pt-5">
          <div className="flex items-baseline justify-between">
            <h2 className={eyebrow}>By habit</h2>
            <span aria-hidden="true" className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">% target</span>
          </div>
          {data.habits.map((habit) => <HabitStrip key={habit.id} habit={habit} />)}
        </section>
      )}
    </div>
  )
}

export default MonthPanel
