import { Check } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Task } from '../../api/types'
import { formatDayMonth } from '../../lib/dates'
import { textButton } from '../../lib/ui'
import { todayIn } from '../../lib/zonedTime'
import { carriedText, useTaskTimezone } from './taskDates'
import { useRowSwipe } from './useRowSwipe'

interface Props {
  task: Task
  today: string
  inLater?: boolean
  aside?: ReactNode
  onChange(next: Task): void
  onDelete(task: Task): void
  onLater?(task: Task): void
}

export function TaskRow({ task, today, inLater = false, aside, onChange, onDelete, onLater }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.text)
  const zone = useTaskTimezone()
  const done = task.doneOn !== null
  const note = inLater ? `added ${formatDayMonth(todayIn(zone, new Date(task.createdAt)))}` : task.scheduledOn && !done ? carriedText(task.scheduledOn, today) : null

  function commit(): void {
    const text = draft.trim()
    setEditing(false)
    if (text === '' || text === task.text) return setDraft(task.text)
    onChange({ ...task, text: text.slice(0, 200) })
  }
  function edited(): Task {
    const text = draft.trim()
    return text === '' ? task : { ...task, text: text.slice(0, 200) }
  }
  function onKey(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) commit()
    if (event.key === 'Escape') { setDraft(task.text); setEditing(false) }
  }
  const swipeable = !editing && (inLater || !done)
  const { dx, outcome, handlers } = useRowSwipe(inLater, (o) => (o === 'later' ? onLater?.(task) : onDelete(task)))

  return (
    <li aria-label={task.text} data-row-swipe={swipeable ? '' : undefined} {...(swipeable ? handlers : {})}
      className="relative -ml-2.5 touch-pan-y overflow-hidden after:absolute after:right-0 after:bottom-0 after:left-2.5 after:h-px after:bg-rule">
      {/* Widened by the checkbox's -m-2.5 so overflow-hidden keeps its 44px tap target; the rule stays aligned. */}
      {swipeable && (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-end bg-ink px-5 text-[14px] font-semibold text-paper">
          {outcome === 'delete' || inLater ? 'Delete' : 'Move to Later'}
        </div>
      )}
      <div style={{ transform: `translateX(${dx}px)` }}
        className={`relative flex min-h-14 items-start gap-3 bg-paper py-2.5 pl-2.5 ${dx === 0 ? 'transition-transform' : ''}`}>
        <label className="-m-2.5 flex h-11 w-11 flex-none cursor-pointer items-center justify-center">
          <input type="checkbox" checked={done} aria-label={`Done: ${task.text}`}
            onChange={() => onChange({ ...task, doneOn: done ? null : today })} className="peer sr-only" />
          <span aria-hidden="true" className={`flex h-[22px] w-[22px] items-center justify-center rounded-[3px] border-[1.5px] ${
            inLater ? 'border-dashed border-ring' : 'border-ink'} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink`}>
            {done && <Check size={16} strokeWidth={2.5} className="text-ink" />}
          </span>
        </label>
        <div className="min-w-0 flex-1 pt-0.5">
          {editing ? (
            // Blur saves only when focus leaves the input and its buttons; mousedown is prevented so a click (Safari) keeps focus.
            <div className="flex items-center gap-4" onKeyDown={onKey}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) commit() }}>
              <input autoFocus aria-label="Edit task" value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)}
                className="min-w-0 flex-1 border-0 border-b border-ink bg-transparent p-0 text-[17px] text-ink focus:outline-none!" />
              {!inLater && !done && onLater && (
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onLater(edited())}
                  className={`${textButton} -my-2.5 flex-none`}>Later</button>
              )}
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onDelete(task)}
                className={`${textButton} -my-2.5 flex-none`}>Delete</button>
            </div>
          ) : (
            <button type="button" aria-label={`Edit ${task.text}`} onClick={() => { setDraft(task.text); setEditing(true) }}
              className={`w-full text-left text-[17px] break-words ${done ? 'text-muted line-through decoration-faint' : 'text-ink'}`}>
              {task.text}
            </button>
          )}
          {note && <p className="mt-0.5 font-mono text-[12px] text-muted">{note}</p>}
        </div>
        {aside}
      </div>
    </li>
  )
}
