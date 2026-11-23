import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Color, MonthView, Streak, WeekView } from '../../api/types'
import { atYellowLimit, useNotifyYellowLimit } from '../../lib/yellowLimit'

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

function checkInPath({ habitId, periodStart }: CheckInKey): string {
  return `/api/habits/${habitId}/check-ins/${periodStart}`
}

/**
 * Returning the invalidation promise makes `mutateAsync` resolve after week, month and streaks have refetched.
 * A yellow that brings the habit's run up to its limit raises the yellow-limit dialog (not when only the note changed).
 */
export function useSaveCheckIn() {
  const queryClient = useQueryClient()
  const notifyYellowLimit = useNotifyYellowLimit()
  return useMutation({
    mutationFn: ({ color, note, ...key }: CheckInKey & { color: Color; note: string | null }) =>
      api.put(checkInPath(key), { color, note }),
    onMutate: ({ habitId }) => ({
      runBefore: queryClient.getQueryData<Streak[]>(streaksQuery.queryKey)?.find((s) => s.habitId === habitId)?.yellowRun,
    }),
    onSuccess: async (_data, { habitId, color }, context) => {
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      if (color !== 'YELLOW') return
      const streak = (await queryClient.ensureQueryData(streaksQuery)).find((s) => s.habitId === habitId)
      if (atYellowLimit(streak) && streak.yellowRun !== context?.runBefore) {
        notifyYellowLimit({ name: streak.name, limit: streak.yellowLimit })
      }
    },
  })
}

export function useClearCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: CheckInKey) => api.del(checkInPath(key)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats'] }),
  })
}
