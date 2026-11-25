import { NotebookPen } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Mark } from '../../app/Mark'
import { messageFor } from '../../api/errors'
import type { Color, WeekCell, WeekHabit } from '../../api/types'
import { STATE_LABEL } from '../../lib/cells'
import { hapticMark } from '../../lib/haptics'
import { useSaveCheckIn } from '../stats/api'
import { StreakLine } from './habitBits'
import { Stamp } from './Stamp'

const BUTTONS: { color: Color; label: string }[] = [
  { color: 'GREEN', label: 'Target' },
  { color: 'YELLOW', label: 'Minimum' },
  { color: 'RED', label: 'Missed' },
]

function NotePreview({ note }: { note: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
      <NotebookPen size={12} className="flex-none" aria-hidden="true" />
      <span className="truncate">{note}</span>
    </p>
  )
}

interface HabitCardProps {
  habit: WeekHabit
  cell: WeekCell
  /** Current streak, once the streaks query has loaded. */
  streak: number | undefined
  now: Date
  /** N while this habit is at its yellow limit. */
  yellowLimit?: number
  onOpen(): void
}

/**
 * One habit on Today as a ruled row. Open: one-tap Target / Minimum / Missed. Target or Minimum: a stamped row that
 * opens the picker. Both share the <article> root so the node (and this state) survives the switch.
 */
export function HabitCard({ habit, cell, streak, now, yellowLimit, onOpen }: HabitCardProps) {
  const saveCheckIn = useSaveCheckIn()
  const titleId = useId()
  const [error, setError] = useState<string | null>(null)
  const [popped, setPopped] = useState<Color | null>(null)
  const [missedJustNow, setMissedJustNow] = useState(false)
  const articleRef = useRef<HTMLElement>(null)
  const rowButtonRef = useRef<HTMLButtonElement>(null)
  const stamped = cell.state === 'GREEN' || cell.state === 'YELLOW'
  // At the limit, one more minimum restarts the streak (re-tapping today's own minimum changes nothing).
  const yellowResets = yellowLimit !== undefined && cell.state !== 'YELLOW'
  const collapsedJustNow = stamped && popped === cell.state

  // Collapsing unmounts the pressed button; hand focus to the row's button unless it has moved elsewhere.
  useEffect(() => {
    if (!collapsedJustNow) return
    const active = document.activeElement
    if (active === null || active === document.body || articleRef.current?.contains(active)) {
      rowButtonRef.current?.focus()
    }
  }, [collapsedJustNow])

  async function mark(color: Color): Promise<void> {
    if (cell.state === color) return
    setError(null)
    hapticMark(color)
    try {
      await saveCheckIn.mutateAsync({ habitId: habit.id, periodStart: cell.periodStart ?? cell.date, color, note: cell.note })
      // A miss gets a quiet word instead of a stamp.
      setPopped(color === 'RED' ? null : color)
      setMissedJustNow(color === 'RED')
    } catch (err) {
      setError(messageFor(err))
    }
  }

  const streakLine = <StreakLine habit={habit} cell={cell} streak={streak} now={now} />
  const errorLine = error && <p role="alert" className="mt-2 text-sm text-cell-red">{error}</p>
  const name = 'font-display text-[23px] leading-tight break-words text-ink'

  if (stamped) {
    return (
      <article ref={articleRef} aria-labelledby={titleId} className="relative flex items-center gap-4 border-b border-rule py-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className={name}>
            {/* The ::after stretches the tap target over the whole row. */}
            <button ref={rowButtonRef} type="button" aria-haspopup="dialog" onClick={onOpen}
              className="text-left after:absolute after:inset-0">
              {habit.name}
            </button>
          </h2>
          <p className="sr-only">{STATE_LABEL[cell.state]}</p>
          {streakLine}
          {cell.note && <NotePreview note={cell.note} />}
          {errorLine}
        </div>
        <Stamp color={cell.state as 'GREEN' | 'YELLOW'} pressed={popped === cell.state} onDone={() => setPopped(null)} />
      </article>
    )
  }

  return (
    <article ref={articleRef} aria-labelledby={titleId} className="border-b border-rule py-4">
      <h2 id={titleId} className={name}>
        <button type="button" aria-haspopup="dialog" onClick={onOpen}
          className="text-left decoration-rule-2 underline-offset-4 hover:underline">
          {habit.name}
        </button>
      </h2>
      {streakLine}
      <div className="mt-2 grid grid-cols-3">
        {BUTTONS.map(({ color, label }, i) => {
          const pressed = cell.state === color
          const warn = color === 'YELLOW' && yellowResets
          return (
            <button key={color} type="button" aria-pressed={pressed} disabled={saveCheckIn.isPending}
              aria-describedby={warn ? `${titleId}-reset` : undefined}
              onClick={() => void mark(color)}
              className={`flex min-h-11 flex-col items-center justify-center px-1 py-1.5 text-[14px] font-medium text-ink transition-colors active:bg-paper-2 disabled:opacity-60 ${
                i > 0 ? 'border-l border-dashed border-faint' : ''
              } ${pressed ? 'bg-paper-2' : ''}`}>
              <span className="flex items-center gap-2">
                <Mark kind={color} size={12} />
                {label}
              </span>
              {warn && <span className="font-mono text-[11px] leading-tight text-yellow-ink" aria-hidden="true">restarts streak</span>}
            </button>
          )
        })}
      </div>
      {yellowResets && (
        <p id={`${titleId}-reset`} className="sr-only">You've used {yellowLimit} minimums in a row; another restarts the streak.</p>
      )}
      {yellowLimit !== undefined && (
        <p className="mt-1 font-mono text-[12px] text-yellow-ink">{yellowLimit}/{yellowLimit} minimums in a row</p>
      )}
      {missedJustNow && cell.state === 'RED' && (
        <p role="status" className="mt-2 font-mono text-[12px] text-muted">
          That's honest. {habit.frequency === 'DAILY' ? 'Tomorrow' : 'The next one'} is a fresh start.
        </p>
      )}
      {cell.state === 'RED' && cell.note && <NotePreview note={cell.note} />}
      {errorLine}
    </article>
  )
}

export default HabitCard
