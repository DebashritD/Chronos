import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Task } from '../../api/types'

export const TASKS_KEY = ['tasks'] as const

export function useTasks() {
  return useQuery({ queryKey: TASKS_KEY, queryFn: () => api.get<Task[]>('/api/tasks') })
}
