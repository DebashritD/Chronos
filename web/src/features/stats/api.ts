import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Color, MonthView, Streak, WeekView } from '../../api/types'

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

export function useStreaks() {
  return useQuery({ queryKey: ['stats', 'streaks'], queryFn: () => api.get<Streak[]>('/api/stats/streaks') })
}

interface CheckInKey {
  habitId: number
  periodStart: string
}

function checkInPath({ habitId, periodStart }: CheckInKey): string {
  return `/api/habits/${habitId}/check-ins/${periodStart}`
}

/** Returning the invalidation promise makes `mutateAsync` resolve after week, month and streaks have refetched. */
export function useSaveCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ color, note, ...key }: CheckInKey & { color: Color; note: string | null }) =>
      api.put(checkInPath(key), { color, note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats'] }),
  })
}

export function useClearCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: CheckInKey) => api.del(checkInPath(key)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stats'] }),
  })
}
