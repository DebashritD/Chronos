import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { formatLongDay } from '../../lib/dates'
import { atYellowLimit } from '../../lib/yellowLimit'
import { useNow } from '../../lib/useNow'
import { EmptyState } from '../../app/EmptyState'
import { SyncStatus } from '../../app/SyncStatus'
import { card, cardTitle, emptyAction, pageTitle } from '../../lib/ui'
import { browserTimezone, useSession } from '../auth/session'
import { CellPicker } from '../checkin/CellPicker'
import { useHabits } from '../habits/api'
import { WeekGrid } from '../progress/WeekGrid'
import { useStreaks, useWeek } from '../stats/api'
import { StreakList } from '../stats/StreakList'
import { HabitCard } from './HabitCard'
import { localTodayWeek } from './localTodayWeek'
import { todayItems, type TodayItem } from './todayItems'
import { TodaySummary } from './TodaySummaryView'
import { todaySummary } from './todaySummary'

/** Home: today's habits from the current week view, plus (desktop) the week grid and streaks. */
export function TodayPage() {
  const week = useWeek()
  const streaks = useStreaks()
  const habits = useHabits()
  const { me } = useSession()
  const now = useNow()
  const [picked, setPicked] = useState<TodayItem | null>(null)
  const queryClient = useQueryClient()
  const invalidatedAt = useRef<number | null>(null)

  const closesAt = week.data
    ? todayItems(week.data).reduce<number | null>((earliest, { cell }) => {
        const at = cell.closesAt ? Date.parse(cell.closesAt) : NaN
        return Number.isNaN(at) || (earliest !== null && earliest <= at) ? earliest : at
      }, null)
    : null

  // Once a displayed period has closed, refetch so cards move on to the new period instead of marking the old one.
  useEffect(() => {
    if (closesAt !== null && now.getTime() >= closesAt && invalidatedAt.current !== closesAt) {
      invalidatedAt.current = closesAt
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
    }
  }, [closesAt, now, queryClient])

  if (week.isPending) {
    return (
      <div>
        <p className="text-muted">Loading…</p>
        <SyncStatus className="mt-1" />
      </div>
    )
  }
  if (week.isError) return <p role="alert" className="text-cell-red">Couldn't load today.</p>

  // After midnight with no fresh week (offline), today's periods are derived on the device.
  const data = localTodayWeek(week.data, habits.data, me?.timezone ?? browserTimezone(), now)
  const items = todayItems(data)
  const streakFor = (habitId: number) => streaks.data?.find((s) => s.habitId === habitId)
  const summary = todaySummary(items, now, (habitId) => streakFor(habitId)?.current)
  const isDone = (item: TodayItem) => item.cell.state === 'GREEN'
  const ordered = [...items.filter((item) => !isDone(item)), ...items.filter(isDone)]
  const firstDone = ordered.findIndex(isDone)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
      <div>
        <h1 className={pageTitle}>Today</h1>
        <p className="mt-0.5 mb-5 text-[15px] text-muted">{formatLongDay(data.today)}</p>
        <SyncStatus />
        {data.habits.length === 0 ? (
          <EmptyState title="Start your first chain"
            action={<Link to="/habits" className={emptyAction}>Create your first habit</Link>}>
            Add a habit with a minimum and a target. Even the minimum keeps the day off red.
          </EmptyState>
        ) : (
          <>
            <TodaySummary summary={summary} />
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {/* One flat keyed list, so a card that moves into Done keeps its state. */}
              {ordered.flatMap((item, i) => {
                const s = streakFor(item.habit.id)
                const habitCard = (
                  <HabitCard key={item.habit.id} habit={item.habit} cell={item.cell} streak={s?.current}
                    yellowLimit={atYellowLimit(s) ? s.yellowLimit : undefined} now={now} onOpen={() => setPicked(item)} />
                )
                return i === firstDone
                  ? [<h2 key="done" className="col-span-full mt-2 px-1 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">Done</h2>, habitCard]
                  : [habitCard]
              })}
            </div>
          </>
        )}
      </div>
      <aside aria-label="This week" className="hidden lg:flex lg:flex-col lg:gap-4">
        {data.habits.length > 0 && (
          <div className={`${card} px-3`}>
            <h2 className={`${cardTitle} px-2`}>This week</h2>
            <WeekGrid start={data.start} today={data.today} habits={data.habits}
              onPick={(habit, cell) => setPicked({ habit, cell })} />
          </div>
        )}
        <StreakList />
      </aside>
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} streak={streakFor(picked.habit.id)?.current}
        now={now} onClose={() => setPicked(null)} />}
    </div>
  )
}

export default TodayPage
