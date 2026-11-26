import { useMutation, type Mutation, type QueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { authedSend } from '../../api/authedSend'
import { ApiError } from '../../api/errors'
import type { Task } from '../../api/types'
import { showSyncToast } from '../../lib/syncToast'
import { AuthDiscardedError } from '../checkin/authGate'
import { isCheckIn } from '../checkin/queue'
import { TASKS_KEY } from './api'

export const TASK_KEY = ['task'] as const
const MAX_SERVER_ERROR_RETRIES = 8

export type TaskVars = { op: 'put'; task: Task } | { op: 'delete'; id: string }

export function patchTasks(list: Task[], vars: TaskVars): Task[] {
  if (vars.op === 'delete') return list.filter((t) => t.id !== vars.id)
  return list.some((t) => t.id === vars.task.id)
    ? list.map((t) => (t.id === vars.task.id ? vars.task : t))
    : [...list, vars.task]
}

function send(vars: TaskVars): Promise<unknown> {
  if (vars.op === 'delete') return authedSend(() => api.del(`/api/tasks/${vars.id}`))
  const { id, text, scheduledOn, doneOn, createdAt } = vars.task
  return authedSend(() => api.put(`/api/tasks/${id}`, { text, scheduledOn, doneOn, createdAt }))
}

/** Refetch once the last queued change settles (the settling one still counts here). */
function synced(queryClient: QueryClient): Promise<void> | undefined {
  if (queryClient.isMutating({ mutationKey: TASK_KEY }) > 1) return undefined
  return queryClient.invalidateQueries({ queryKey: TASKS_KEY })
}

export function registerTaskDefaults(queryClient: QueryClient): void {
  queryClient.setMutationDefaults(TASK_KEY, {
    mutationFn: (vars: TaskVars) => send(vars),
    scope: { id: 'tasks' },
    retry: (failureCount, error) => {
      if (error instanceof AuthDiscardedError) return false
      if (!(error instanceof ApiError)) return true
      return error.status >= 500 && failureCount < MAX_SERVER_ERROR_RETRIES
    },
    onMutate: async (vars: TaskVars) => {
      await queryClient.cancelQueries({ queryKey: TASKS_KEY })
      queryClient.setQueryData<Task[]>(TASKS_KEY, (list) => patchTasks(list ?? [], vars))
    },
    onSuccess: () => synced(queryClient),
    onError: (error) => {
      if (error instanceof ApiError) {
        showSyncToast('Couldn’t sync a task. Refreshed.')
        return queryClient.invalidateQueries({ queryKey: TASKS_KEY })
      }
      return synced(queryClient)
    },
  })
}

export function useTaskChange(): (vars: TaskVars) => void {
  const { mutate } = useMutation<unknown, Error, TaskVars>({ mutationKey: TASK_KEY })
  return mutate
}

export function isTaskChange(mutation: Mutation): boolean {
  return mutation.options.mutationKey?.[0] === TASK_KEY[0]
}

/** What the sync line and the logout check count: marks and task changes still waiting. */
export function isQueuedChange(mutation: Mutation): boolean {
  return isCheckIn(mutation) || isTaskChange(mutation)
}

export async function resumeTasks(queryClient: QueryClient): Promise<void> {
  const pending = queryClient.getMutationCache().findAll({ mutationKey: TASK_KEY, status: 'pending' })
  await Promise.all(pending.map((m) => m.continue().catch(() => undefined)))
}

/** Call before discardCheckIns, which rejects the shared auth gate. */
export function discardTasks(queryClient: QueryClient): void {
  const cache = queryClient.getMutationCache()
  for (const m of cache.findAll({ mutationKey: TASK_KEY })) cache.remove(m)
}
