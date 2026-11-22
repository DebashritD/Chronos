import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { WeekCell, WeekHabit } from '../../api/types'
import { addDays, formatWeekRange } from '../../lib/dates'
import { EmptyState } from '../../app/EmptyState'
import { emptyAction, pillButton } from '../../lib/ui'
import { CellPicker } from '../checkin/CellPicker'
import { useStreaks, useWeek } from '../stats/api'
import { DistributionDonut } from '../stats/DistributionDonut'
import { StreakList } from '../stats/StreakList'
import { WeekTiles } from './WeekTiles'

const iconButton = 'flex h-9 w-9 flex-none items-center justify-center rounded-full bg-card text-fg'

export function WeekPanel() {
  const [searchParams, setSearchParams] = useSearchParams()
  const start = searchParams.get('start') ?? undefined
  const { data, isPending, isError } = useWeek(start)
  const streaks = useStreaks()
  const [picked, setPicked] = useState<{ habit: WeekHabit; cell: WeekCell } | null>(null)

  if (isPending) return <p className="text-muted">Loading…</p>
  if (isError) return <p role="alert" className="text-cell-red">Couldn't load this week.</p>

  const goTo = (weekStart: string) => setSearchParams({ start: weekStart })

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button type="button" aria-label="Previous week" className={iconButton}
          onClick={() => goTo(addDays(data.start, -7))}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-fg md:flex-none md:px-2">
          {formatWeekRange(data.start)}
        </h2>
        <button type="button" aria-label="Next week" className={iconButton}
          onClick={() => goTo(addDays(data.start, 7))}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {start && <button type="button" className={pillButton} onClick={() => setSearchParams({})}>This week</button>}
      </div>
      {data.habits.length === 0 ? (
        <EmptyState title="Your progress shows up here"
          action={<Link to="/habits" className={emptyAction}>Create your first habit</Link>}>
          Mark your habits each day and this week fills up with green, yellow and red.
        </EmptyState>
      ) : (
        <WeekTiles start={data.start} today={data.today} habits={data.habits}
          streakOf={(habitId) => streaks.data?.find((streak) => streak.habitId === habitId)?.current}
          onPick={(habit, cell) => setPicked({ habit, cell })} />
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <DistributionDonut title={start ? 'Distribution' : 'This week'} distribution={data.distribution} />
        <StreakList />
      </div>
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} onClose={() => setPicked(null)} />}
    </div>
  )
}

export default WeekPanel
