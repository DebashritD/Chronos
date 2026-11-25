import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import type { MonthHabit } from '../../api/types'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { addMonths, formatDay, formatMonth } from '../../lib/dates'
import { card, cardTitle, pillButton } from '../../lib/ui'
import { useMonth } from '../stats/api'
import { DistributionDonut } from '../stats/DistributionDonut'
import { CalendarGrid, scoreClass } from './CalendarGrid'

const iconButton = 'flex h-9 w-9 flex-none items-center justify-center rounded-full bg-card text-fg'

/** Share of due periods (GREEN/YELLOW/RED/GREY) that were GREEN, or null when nothing was due. */
function greenShare(habit: MonthHabit): number | null {
  const due = habit.cells.filter(({ state }) => ['GREEN', 'YELLOW', 'RED', 'GREY'].includes(state)).length
  if (due === 0) return null
  return Math.round((habit.cells.filter(({ state }) => state === 'GREEN').length * 100) / due)
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
      {toggle}
      <div className="my-4 flex items-center gap-2">
        <button type="button" aria-label="Previous month" className={iconButton}
          onClick={() => goTo(addMonths(data.month, -1))}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-fg md:flex-none md:px-2">
          {formatMonth(data.month)}
        </h2>
        <button type="button" aria-label="Next month" className={iconButton}
          onClick={() => goTo(addMonths(data.month, 1))}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {month && (
          <button type="button" className={pillButton} onClick={() => setSearchParams({ view: 'month' })}>
            This month
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Daily score" className={card}>
          <h3 className={cardTitle}>Daily score</h3>
          <CalendarGrid days={overview} showNumbers />
          <div className="mt-4 flex items-center gap-2 text-[12px] text-muted" aria-hidden="true">
            <span>Missed</span>
            <span className="h-2 flex-1 rounded-full bg-linear-to-r from-score-0 via-score-2 to-score-4" />
            <span>Target</span>
            <span className="ml-2 h-3 w-3 flex-none rounded-[4px] border border-outline bg-surface" />
            <span>Not marked</span>
          </div>
        </section>
        <div className="flex flex-col gap-4">
          <DistributionDonut title="Distribution" distribution={data.distribution} />
          {data.habits.length > 0 && (
            <div className={`${card} grid grid-cols-1 gap-5 sm:grid-cols-2`}>
              {data.habits.map((habit) => {
                const share = greenShare(habit)
                return (
                  <section key={habit.id} aria-label={habit.name}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="min-w-0 text-[15px] leading-snug font-semibold break-words text-fg">{habit.name}</h3>
                      <span className="flex-none text-[11px] text-muted">{share === null ? '–' : `${share}% green`}</span>
                    </div>
                    <CalendarGrid compact days={habit.cells.map(({ date, state }) => ({
                      date,
                      className: state === 'PENDING' || state === 'NOT_DUE' ? 'bg-surface' : cellClass(state),
                      label: `${habit.name}, ${formatDay(date)}, ${STATE_LABEL[state]}`,
                    }))} />
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MonthPanel
