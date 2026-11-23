import { useQueryClient } from '@tanstack/react-query'
import type { Color } from '../../api/types'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { isColor } from '../../lib/cells'
import { formatLongDay } from '../../lib/dates'
import { atYellowLimit } from '../../lib/yellowLimit'
import { useNow } from '../../lib/useNow'
import { EmptyState } from '../../app/EmptyState'
import { card, cardTitle, emptyAction, pageTitle } from '../../lib/ui'
import { CellPicker } from '../checkin/CellPicker'
import { WeekGrid } from '../progress/WeekGrid'
import { useStreaks, useWeek } from '../stats/api'
import { StreakList } from '../stats/StreakList'
import { HabitCard } from './HabitCard'
import { ProgressRing } from './ProgressRing'
import { todayItems, type TodayItem } from './todayItems'

function encouragement(total: number, left: number, missed: number): [string, string] {
  if (total === 0) return ['Nothing due today', 'Enjoy the break.']
  if (left === 0 && missed > 0) return ['All marked', 'Honest marks, every one. Tomorrow starts fresh.']
  if (left === 0) return ['All done', 'Every habit is off red today. Nice work.']
  return ['Keep it off red', `${left} ${left === 1 ? 'habit' : 'habits'} left today. Even the minimum counts.`]
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
  const count = (color: Color) => items.filter(({ cell }) => cell.state === color).length
  const marks = { green: count('GREEN'), yellow: count('YELLOW'), red: count('RED') }
  const marked = items.filter(({ cell }) => isColor(cell.state)).length
  const [headline, message] = encouragement(items.length, items.length - marked, marks.red)
  const streakFor = (habitId: number) => streaks.data?.find((s) => s.habitId === habitId)

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
      <div>
        <h1 className={pageTitle}>Today</h1>
        <p className="mt-0.5 mb-5 text-[15px] text-muted">{formatLongDay(data.today)}</p>
        {data.habits.length === 0 ? (
          <EmptyState title="Start your first chain"
            action={<Link to="/habits" className={emptyAction}>Create your first habit</Link>}>
            Add a habit with a minimum and a target. Even the minimum keeps the day off red.
          </EmptyState>
        ) : (
          <>
            <section aria-label="Today's progress"
              className="mb-4 flex items-center gap-4 rounded-card border border-line bg-card px-4 py-3.5">
              <ProgressRing {...marks} total={items.length} />
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold text-fg">{headline}</h2>
                <p className="mt-0.5 text-[14px] leading-snug text-muted">{message}</p>
              </div>
            </section>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {items.map((item) => {
                const s = streakFor(item.habit.id)
                return (
                  <HabitCard key={item.habit.id} habit={item.habit} cell={item.cell} streak={s?.current}
                    yellowLimit={atYellowLimit(s) ? s.yellowLimit : undefined} now={now} onOpen={() => setPicked(item)} />
                )
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
      {picked && <CellPicker habit={picked.habit} cell={picked.cell} onClose={() => setPicked(null)} />}
    </div>
  )
}

export default TodayPage
