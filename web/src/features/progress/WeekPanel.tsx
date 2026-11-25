import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays, formatWeekRange } from '../../lib/dates'
import { EmptyState } from '../../app/EmptyState'
import { inkButton, iconButton, pageTitle, textButton } from '../../lib/ui'
import { useNow } from '../../lib/useNow'
import { atYellowLimit } from '../../lib/yellowLimit'
import { CellPicker } from '../checkin/CellPicker'
import { useStreaks, useWeek } from '../stats/api'
import { DistributionBar } from '../stats/DistributionBar'
import { StreakList } from '../stats/StreakList'
import { WeekTiles } from './WeekTiles'

export function WeekPanel({ toggle }: { toggle: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const start = searchParams.get('start') ?? undefined
  const { data, isPending, isError, fetchStatus } = useWeek(start)
  const streaks = useStreaks()
  const now = useNow()
  const [picked, setPicked] = useState<{ habit: WeekHabit; cell: WeekCell } | null>(null)

  // Offline and never loaded: the query is paused, not failing.
  if (isPending) {
    return <>{toggle}<p className="mt-4 text-muted">{fetchStatus === 'paused' ? 'Connect to load this week.' : 'Loading…'}</p></>
  }
  if (isError) return <>{toggle}<p role="alert" className="mt-4 text-cell-red">Couldn't load this week.</p></>

  const goTo = (weekStart: string) => setSearchParams({ start: weekStart })
  const pickedStreak = picked ? streaks.data?.find((streak) => streak.habitId === picked.habit.id) : undefined

  const noRed = data.habits.every((habit) => habit.cells.every((cell) => cell.state !== 'RED'))
  const current = !start
  const headline = noRed ? `No red ${current ? 'this' : 'that'} week` : current ? 'This week' : 'That week'

  return (
    <div>
      <p className={`${pageTitle} mt-1`}>{headline}</p>
      {toggle}
      <div className="mt-4 mb-4 flex items-center gap-1 border-y border-rule-2 py-1">
        <button type="button" aria-label="Previous week" className={iconButton} onClick={() => goTo(addDays(data.start, -7))}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 text-center font-serif text-[22px] text-ink">{formatWeekRange(data.start)}</h2>
        <button type="button" aria-label="Next week" className={iconButton} onClick={() => goTo(addDays(data.start, 7))}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      {start && <button type="button" className={`${textButton} mb-2`} onClick={() => setSearchParams({})}>This week</button>}
      {data.habits.length === 0 ? (
        <EmptyState title="Your progress shows up here"
          action={<Link to="/habits" className={inkButton}>Create your first habit</Link>}>
          Mark your habits each day and this week fills up with targets, minimums and misses.
        </EmptyState>
      ) : (
        <WeekTiles start={data.start} today={data.today} habits={data.habits}
          onPick={(habit, cell) => setPicked({ habit, cell })} />
      )}
      <DistributionBar title={start ? 'Distribution' : 'This week'} caption={`${data.distribution.total} due${start ? '' : ' so far'}`}
        distribution={data.distribution} />
      <StreakList />
      {picked && <CellPicker habit={picked.habit} cell={picked.cell}
        streak={pickedStreak?.current}
        yellowLimit={atYellowLimit(pickedStreak) ? pickedStreak.yellowLimit : undefined} now={now} onClose={() => setPicked(null)} />}
    </div>
  )
}

export default WeekPanel
