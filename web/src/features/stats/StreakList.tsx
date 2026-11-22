import { Flame } from 'lucide-react'
import { card, cardTitle } from '../../lib/ui'
import { useStreaks } from './api'

/** Current and best streak per habit; streaks count GREEN/YELLOW periods and skip paused ones. */
export function StreakList() {
  const { data } = useStreaks()
  return (
    <section aria-label="Streaks" className={card}>
      <h2 className={cardTitle}>Streaks</h2>
      {data?.length === 0 && <p className="text-sm text-muted">No habits yet</p>}
      <ul className="divide-y divide-line">
        {data?.map((streak) => (
          <li key={streak.habitId} aria-label={streak.name} className="flex items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{streak.name}</span>
            {streak.current > 0 && <Flame size={16} className="text-urgent" aria-hidden="true" />}
            <span className="text-muted">
              <b className="font-semibold text-fg">{streak.current}</b> · best {streak.best}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default StreakList
