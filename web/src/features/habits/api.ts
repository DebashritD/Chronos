import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Habit, HabitStatus, HabitTexts, NewHabit } from '../../api/types'

export type HabitAction = 'pause' | 'resume' | 'archive' | 'unarchive'

export function useHabits(status?: HabitStatus) {
  return useQuery({
    queryKey: ['habits', status ?? 'current'],
    queryFn: () => api.get<Habit[]>('/api/habits', { status }),
  })
}

/** Habit changes affect every stats view, so both caches are refreshed. */
function useInvalidateHabits() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['habits'] }),
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
    ])
}

export function useCreateHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({ mutationFn: (body: NewHabit) => api.post<Habit>('/api/habits', body), onSuccess: invalidate })
}

export function useUpdateHabit() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: ({ id, ...texts }: HabitTexts & { id: number }) => api.put<Habit>(`/api/habits/${id}`, texts),
    onSuccess: invalidate,
  })
}

export function useHabitAction() {
  const invalidate = useInvalidateHabits()
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: HabitAction }) => api.post<Habit>(`/api/habits/${id}/${action}`),
    onSuccess: invalidate,
  })
}
