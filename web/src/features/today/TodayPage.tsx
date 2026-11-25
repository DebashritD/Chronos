import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { dayOfMonth, formatLongDay, formatMonth, formatWeekday } from '../../lib/dates'
import { atYellowLimit } from '../../lib/yellowLimit'
import { useNow } from '../../lib/useNow'
import { EmptyState } from '../../app/EmptyState'
import { SyncStatus } from '../../app/SyncStatus'
import { inkButton, eyebrow } from '../../lib/ui'
import { browserTimezone, useSession } from '../auth/session'
import { CellPicker } from '../checkin/CellPicker'
import { useHabits } from '../habits/api'
import { WeekTiles } from '../progress/WeekTiles'
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
  const pickedStreak = picked ? streakFor(picked.habit.id) : undefined
  const isDone = (item: TodayItem) => item.cell.state === 'GREEN' || item.cell.state === 'YELLOW'
  const ordered = [...items.filter((item) => !isDone(item)), ...items.filter(isDone)]
  const firstDone = ordered.findIndex(isDone)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
      <div>
        <h1 className="sr-only">Today</h1>
        <p className="sr-only">{formatLongDay(data.today)}</p>
        {summary.countdown && <p className="sr-only">{summary.countdown.text}</p>}
        <header aria-hidden="true" className="flex items-end justify-between gap-4">
          <div>
            <p className={eyebrow}>{formatWeekday(data.today)}</p>
            <p className="font-serif text-[92px] leading-[0.85] tracking-[-0.02em] text-ink">{dayOfMonth(data.today)}</p>
          </div>
          <div className="pb-2 text-right">
            <p className="text-[14px] text-muted">{formatMonth(data.today.slice(0, 7))}</p>
            {summary.countdown && (
              <p className={`font-mono text-[15px] font-medium ${summary.countdown.urgent ? 'text-accent' : 'text-ink'}`}>
                {summary.countdown.text}
              </p>
            )}
          </div>
        </header>
        <SyncStatus className="mt-1" />
        {data.habits.length === 0 ? (
          <EmptyState title="Start your first chain"
            action={<Link to="/habits" className={inkButton}>Create your first habit</Link>}>
            Add a habit with a minimum and a target. Even the minimum keeps the day off red.
          </EmptyState>
        ) : (
          <>
            <TodaySummary summary={summary} />
            <div className="flex flex-col *:last:border-b-0">
              {/* One flat keyed list, so a card that moves into Done keeps its state. */}
              {ordered.flatMap((item, i) => {
                const s = streakFor(item.habit.id)
                const habitCard = (
                  <HabitCard key={item.habit.id} habit={item.habit} cell={item.cell} streak={s?.current}
                    yellowLimit={atYellowLimit(s) ? s.yellowLimit : undefined} now={now} onOpen={() => setPicked(item)} />
                )
                return i === firstDone
                  ? [<h2 key="done" className="mt-6 text-[11px] font-semibold tracking-[0.22em] text-muted uppercase">Done</h2>, habitCard]
                  : [habitCard]
              })}
            </div>
          </>
        )}
      </div>
      <aside aria-label="This week" className="hidden lg:flex lg:flex-col lg:gap-4 lg:border-l lg:border-rule-2 lg:pl-8">
        {data.habits.length > 0 && (
          <div>
            <h2 className={eyebrow}>This week</h2>
            <WeekTiles start={data.start} today={data.today} habits={data.habits}
              onPick={(habit, cell) => setPicked({ habit, cell })} />
          </div>
        )}
        <StreakList />
      </aside>
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} streak={pickedStreak?.current}
        yellowLimit={atYellowLimit(pickedStreak) ? pickedStreak.yellowLimit : undefined} now={now} onClose={() => setPicked(null)} />}
    </div>
  )
}

export default TodayPage
