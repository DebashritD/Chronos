import type { QueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { Habit, WeekView } from '../../api/types'
import { showSyncToast } from '../../lib/syncToast'
import { AuthDiscardedError, waitForAuth } from './authGate'
import { patchWeek, type CheckInVars } from './patchWeek'

export const CHECK_IN_KEY = ['checkIn'] as const

async function send(vars: CheckInVars): Promise<void> {
  const path = `/api/habits/${vars.habitId}/check-ins/${vars.periodStart}`
  for (;;) {
    try {
      if (vars.op === 'save') await api.put(path, { color: vars.color, note: vars.note ?? null })
      else await api.del(path)
      return
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error
      await waitForAuth()
    }
  }
}

function habitName(queryClient: QueryClient, habitId: number): string {
  const listed = queryClient.getQueriesData<Habit[]>({ queryKey: ['habits'] }).flatMap(([, data]) => data ?? [])
  const inWeeks = queryClient.getQueriesData<WeekView>({ queryKey: ['stats', 'week'] }).flatMap(([, data]) => data?.habits ?? [])
  return [...listed, ...inWeeks].find((h) => h.id === habitId)?.name ?? 'a habit'
}

/** Pending = queued offline, waiting for sign-in, or in flight. */
export function pendingCheckIns(queryClient: QueryClient): number {
  return queryClient.isMutating({ mutationKey: CHECK_IN_KEY })
}

/** Refresh stats once, after the last queued mark (the settling one still counts as pending here). */
function invalidateWhenDrained(queryClient: QueryClient): Promise<void> | undefined {
  if (pendingCheckIns(queryClient) > 1) return undefined
  return queryClient.invalidateQueries({ queryKey: ['stats'] })
}

/** Defaults live on the client (not the hooks) so marks restored after a reload can resume. */
export function registerCheckInDefaults(queryClient: QueryClient): void {
  queryClient.setMutationDefaults(CHECK_IN_KEY, {
    mutationFn: (vars: CheckInVars) => send(vars),
    scope: { id: 'checkIn' },
    retry: (_failureCount, error) =>
      !(error instanceof AuthDiscardedError) && !(error instanceof ApiError && error.status < 500),
    onMutate: async (vars: CheckInVars) => {
      await queryClient.cancelQueries({ queryKey: ['stats', 'week'] })
      queryClient.setQueriesData<WeekView>({ queryKey: ['stats', 'week'] }, (week) => week && patchWeek(week, vars))
    },
    onSuccess: () => invalidateWhenDrained(queryClient),
    onError: (error, vars: CheckInVars) => {
      if (error instanceof ApiError && error.status < 500) {
        showSyncToast(`Couldn’t sync ${habitName(queryClient, vars.habitId)}. Refreshed.`)
        return queryClient.invalidateQueries({ queryKey: ['stats'] })
      }
      return invalidateWhenDrained(queryClient)
    },
  })
}
