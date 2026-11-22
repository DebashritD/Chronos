import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { isColor } from '../../lib/cells'
import { formatLongDay } from '../../lib/dates'
import { useNow } from '../../lib/useNow'
import { card, cardTitle, eyebrow, pageTitle } from '../../lib/ui'
import { CellPicker } from '../checkin/CellPicker'
import { WeekGrid } from '../progress/WeekGrid'
import { useStreaks, useWeek } from '../stats/api'
import { StreakList } from '../stats/StreakList'
import { HabitCard } from './HabitCard'
import { ProgressRing } from './ProgressRing'
import { todayItems, type TodayItem } from './todayItems'

function encouragement(total: number, left: number): [string, string] {
  if (total === 0) return ['Nothing due today', 'Enjoy the break.']
  if (left === 0) return ['All done', 'Every habit is marked for today. Nice work.']
  return ['Keep the chain green', `${left} ${left === 1 ? 'habit' : 'habits'} left today. Even the minimum keeps it off red.`]
}

/** Home: today's habits from the current week view, plus (desktop) the week grid and streaks. */
export function TodayPage() {
  const week = useWeek()
  const streaks = useStreaks()
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

  if (week.isPending) return <p className="text-muted">Loading…</p>
  if (week.isError) return <p role="alert" className="text-cell-red">Couldn't load today.</p>

  const data = week.data
  const items = todayItems(data)
  const done = items.filter(({ cell }) => isColor(cell.state)).length
  const [headline, message] = encouragement(items.length, items.length - done)
  const streakOf = (habitId: number) => streaks.data?.find((streak) => streak.habitId === habitId)?.current

  return (
    <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-8">
      <div>
        <p className={eyebrow}>{formatLongDay(data.today)}</p>
        <h1 className={`${pageTitle} mb-5`}>Today</h1>
        {data.habits.length === 0 ? (
          <p className={`${card} text-muted`}>
            No habits yet. <Link to="/habits" className="font-semibold text-accent">Create your first habit</Link>
          </p>
        ) : (
          <>
            <section aria-label="Today's progress" className={`${card} mb-4 flex items-center gap-5`}>
              <ProgressRing done={done} total={items.length} />
              <div>
                <h2 className="text-[20px] font-bold text-fg">{headline}</h2>
                <p className="mt-1 text-[14px] leading-snug text-muted">{message}</p>
              </div>
            </section>
            <div className="grid gap-3 xl:grid-cols-2">
              {items.map((item) => (
                <HabitCard key={item.habit.id} habit={item.habit} cell={item.cell} streak={streakOf(item.habit.id)}
                  now={now} onOpen={() => setPicked(item)} />
              ))}
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
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} onClose={() => setPicked(null)} />}
    </div>
  )
}

export default TodayPage
