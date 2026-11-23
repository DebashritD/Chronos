import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Color, MonthView, Streak, WeekView } from '../../api/types'
import { atYellowLimit, useNotifyYellowLimit } from '../../lib/yellowLimit'
import type { CheckInVars } from '../checkin/patchWeek'
import { CHECK_IN_KEY, checkInSynced } from '../checkin/queue'

export function useWeek(start?: string) {
  return useQuery({
    queryKey: ['stats', 'week', start ?? 'current'],
    queryFn: () => api.get<WeekView>('/api/stats/week', { start }),
  })
}

export function useMonth(month?: string) {
  return useQuery({
    queryKey: ['stats', 'month', month ?? 'current'],
    queryFn: () => api.get<MonthView>('/api/stats/month', { month }),
  })
}

const streaksQuery = { queryKey: ['stats', 'streaks'], queryFn: () => api.get<Streak[]>('/api/stats/streaks') }

export function useStreaks() {
  return useQuery(streaksQuery)
}

interface CheckInKey {
  habitId: number
  periodStart: string
}

// The streak before each save, for the yellow-limit check once it syncs (keyed by the queued variables object).
const streakBefore = new WeakMap<CheckInVars, Streak | undefined>()

/**
 * Marks are queued (`['checkIn']` defaults in features/checkin/queue.ts): `mutateAsync` resolves once the mark is
 * queued and shown; sync failures surface as the sync toast. When a queued yellow syncs during this session, a yellow
 * that brings the habit's run up to its limit raises the yellow-limit dialog (not when only the note changed); one
 * past the limit, which restarts the streak, gets a quieter notice. Marks restored after a reload sync without it.
 */
export function useSaveCheckIn() {
  const queryClient = useQueryClient()
  const notifyYellowLimit = useNotifyYellowLimit()
  const mutation = useMutation<void, Error, CheckInVars>({
    mutationKey: CHECK_IN_KEY,
    // Replaces the default onSuccess, so it must still run the drain-aware refresh first.
    onSuccess: async (_data, vars) => {
      await checkInSynced(queryClient)
      if (vars.color !== 'YELLOW') return
      // A failed streaks lookup only skips the dialog; the save itself succeeded.
      const streaks = await queryClient.ensureQueryData(streaksQuery).catch(() => undefined)
      const streak = streaks?.find((s) => s.habitId === vars.habitId)
      const before = streakBefore.get(vars)
      if (atYellowLimit(before) && streak && streak.current < before.current) {
        notifyYellowLimit({ kind: 'reset', name: streak.name, limit: before.yellowLimit })
      } else if (atYellowLimit(streak) && streak.yellowRun !== before?.yellowRun) {
        notifyYellowLimit({ kind: 'limit', name: streak.name, limit: streak.yellowLimit })
      }
    },
  })
  return {
    isPending: false as const,
    mutateAsync: async ({ habitId, periodStart, color, note }: CheckInKey & { color: Color; note: string | null }) => {
      const vars: CheckInVars = { op: 'save', habitId, periodStart, color, note }
      streakBefore.set(vars, queryClient.getQueryData<Streak[]>(streaksQuery.queryKey)?.find((s) => s.habitId === habitId))
      mutation.mutate(vars)
    },
  }
}

export function useClearCheckIn() {
  const mutation = useMutation<void, Error, CheckInVars>({ mutationKey: CHECK_IN_KEY })
  return {
    isPending: false as const,
    mutateAsync: async ({ habitId, periodStart }: CheckInKey) => {
      mutation.mutate({ op: 'clear', habitId, periodStart })
    },
  }
}
