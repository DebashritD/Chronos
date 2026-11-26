import type { Task } from '../../api/types'
import { useNow } from '../../lib/useNow'
import { todayIn } from '../../lib/zonedTime'
import { browserTimezone, useSession } from '../auth/session'

const byCreated = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt)

export function splitTasks(tasks: Task[], today: string) {
  const open = tasks.filter((t) => t.scheduledOn !== null && t.doneOn === null)
    .sort((a, b) => (a.scheduledOn ?? '').localeCompare(b.scheduledOn ?? '') || byCreated(a, b))
  const done = tasks.filter((t) => t.doneOn === today).sort(byCreated)
  const later = tasks.filter((t) => t.scheduledOn === null && t.doneOn === null).sort((a, b) => byCreated(b, a))
  return { open, done, later }
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export function carriedText(scheduledOn: string, today: string): string | null {
  const days = daysBetween(scheduledOn, today)
  if (days <= 0) return null
  return days === 1 ? 'carried 1 day' : `carried ${days} days`
}

export function openTodayCount(tasks: Task[] | undefined, today: string): number {
  return tasks ? splitTasks(tasks, today).open.length : 0
}

export function useTaskToday(): string {
  const { me } = useSession()
  return todayIn(me?.timezone ?? browserTimezone(), useNow())
}
