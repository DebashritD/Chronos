import { useState } from 'react'
import type { Task } from '../../api/types'
import { SyncStatus } from '../../app/SyncStatus'
import { dayOfMonth, formatWeekday } from '../../lib/dates'
import { eyebrow, pageTitle, textButton } from '../../lib/ui'
import { AddTask } from './AddTask'
import { useTasks } from './api'
import { useTaskChange } from './queue'
import { splitTasks, useTaskToday } from './taskDates'
import { TaskRow } from './TaskRow'

const LATER_SHOWN = 5

export function TasksPage() {
  const tasks = useTasks()
  const change = useTaskChange()
  const today = useTaskToday()
  const [allLater, setAllLater] = useState(false)
  const { open, done, later } = splitTasks(tasks.data ?? [], today)
  const put = (task: Task) => change({ op: 'put', task })
  const remove = (task: Task) => change({ op: 'delete', id: task.id })

  function add(text: string, toLater: boolean): void {
    put({ id: crypto.randomUUID(), text, scheduledOn: toLater ? null : today, doneOn: null, createdAt: new Date().toISOString() })
  }

  const shownLater = allLater ? later : later.slice(0, LATER_SHOWN)
  return (
    <section className="max-w-xl">
      <p className={eyebrow}>{formatWeekday(today)} {dayOfMonth(today)}</p>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className={pageTitle}>Tasks</h1>
        {open.length + done.length > 0 && (
          <p className="font-mono text-[12px] text-muted">{done.length} of {open.length + done.length} done</p>
        )}
      </div>
      <SyncStatus className="mt-1" />
      {tasks.isPending && <p className="mt-4 text-muted">Loading…</p>}
      {tasks.data && open.length + done.length + later.length === 0 && (
        <p className="mt-4 text-[15px] text-muted">Nothing to do. Add a task below.</p>
      )}
      <ul className="mt-3">
        {[...open, ...done].map((task) => <TaskRow key={task.id} task={task} today={today} onChange={put} onDelete={remove} />)}
      </ul>
      <AddTask onAdd={add} />
      {later.length > 0 && (
        <section aria-label="Later" className="mt-7">
          <div className="flex items-baseline justify-between">
            <h2 className={`${eyebrow} text-muted`}>Later</h2>
            <span className="font-mono text-[12px] text-muted">{later.length}</span>
          </div>
          <ul className="mt-1">
            {shownLater.map((task) => (
              <TaskRow key={task.id} task={task} today={today} inLater onChange={put} onDelete={remove}
                aside={
                  <button type="button" aria-label={`Do ${task.text} today`} onClick={() => put({ ...task, scheduledOn: today })}
                    className={`${textButton} flex-none`}>Do today</button>
                } />
            ))}
          </ul>
          {!allLater && later.length > LATER_SHOWN && (
            <button type="button" onClick={() => setAllLater(true)} className="min-h-11 font-mono text-[13px] text-muted">
              {later.length - LATER_SHOWN} more
            </button>
          )}
        </section>
      )}
    </section>
  )
}

export default TasksPage
