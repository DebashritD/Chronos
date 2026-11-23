import type { Mutation, QueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { ApiError } from '../../api/errors'
import type { Habit, WeekView } from '../../api/types'
import { showSyncToast } from '../../lib/syncToast'
import { AuthDiscardedError, authDiscarded, waitForAuth } from './authGate'
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
export function checkInSynced(queryClient: QueryClient): Promise<void> | undefined {
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
    onSuccess: () => checkInSynced(queryClient),
    onError: (error, vars: CheckInVars) => {
      if (error instanceof ApiError && error.status < 500) {
        showSyncToast(`Couldn’t sync ${habitName(queryClient, vars.habitId)}. Refreshed.`)
        return queryClient.invalidateQueries({ queryKey: ['stats'] })
      }
      return checkInSynced(queryClient)
    },
  })
}

export function isCheckIn(mutation: Mutation): boolean {
  return mutation.options.mutationKey?.[0] === CHECK_IN_KEY[0]
}

/** Restored marks may be paused (offline) or were waiting for sign-in; continue them all, in scope order. */
export async function resumeCheckIns(queryClient: QueryClient): Promise<void> {
  const pending = queryClient.getMutationCache().findAll({ mutationKey: CHECK_IN_KEY, status: 'pending' })
  await Promise.all(pending.map((mutation) => mutation.continue().catch(() => undefined)))
}

/** For the persist provider's onSuccess, which it awaits before it stops restoring: resume in the background. */
export function resumeCheckInsOnRestore(queryClient: QueryClient): void {
  void resumeCheckIns(queryClient)
}

/** Removes the marks before rejecting the gate, so none queued behind it can run under a different user. */
export function discardCheckIns(queryClient: QueryClient): void {
  const cache = queryClient.getMutationCache()
  for (const mutation of cache.findAll({ mutationKey: CHECK_IN_KEY })) cache.remove(mutation)
  authDiscarded()
}
