import { Check } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Task } from '../../api/types'
import { formatDayMonth } from '../../lib/dates'
import { carriedText } from './taskDates'

interface Props {
  task: Task
  today: string
  inLater?: boolean
  aside?: ReactNode
  onChange(next: Task): void
  onDelete(task: Task): void
}

export function TaskRow({ task, today, inLater = false, aside, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.text)
  const done = task.doneOn !== null
  const note = inLater ? `added ${formatDayMonth(task.createdAt.slice(0, 10))}` : task.scheduledOn && !done ? carriedText(task.scheduledOn, today) : null

  function commit(): void {
    const text = draft.trim()
    setEditing(false)
    if (text === '' || text === task.text) return setDraft(task.text)
    onChange({ ...task, text: text.slice(0, 200) })
  }
  function onKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') { setDraft(task.text); setEditing(false) }
  }

  return (
    <li aria-label={task.text} className="flex min-h-14 items-start gap-3 border-b border-rule py-2.5">
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
          <input autoFocus aria-label="Edit task" value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)}
            onBlur={commit} onKeyDown={onKey}
            className="w-full border-0 border-b border-ink bg-transparent p-0 text-[17px] text-ink focus:outline-none" />
        ) : (
          <button type="button" aria-label={`Edit ${task.text}`} onClick={() => { setDraft(task.text); setEditing(true) }}
            className={`w-full text-left text-[17px] break-words ${done ? 'text-faint line-through decoration-faint' : 'text-ink'}`}>
            {task.text}
          </button>
        )}
        {note && <p className="mt-0.5 font-mono text-[12px] text-muted">{note}</p>}
      </div>
      {aside}
    </li>
  )
}
