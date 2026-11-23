import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createQueryClient } from '../api/queryClient'
import { MIN_SPIN_MS, PullToRefresh, type PullToRefreshHandle } from './PullToRefresh'

function renderChip(refetchMs: number) {
  const queryClient = createQueryClient({ retry: false })
  vi.spyOn(queryClient, 'refetchQueries').mockImplementation(
    () => new Promise((resolve) => setTimeout(resolve, refetchMs)),
  )
  const ref = createRef<PullToRefreshHandle>()
  render(<QueryClientProvider client={queryClient}><PullToRefresh ref={ref} /></QueryClientProvider>)
  return ref
}

const chip = () => screen.getByRole('status').parentElement!

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('spins for at least 400ms when the refetch is quick, then returns to idle', async () => {
  const ref = renderChip(10)
  act(() => ref.current!.release(300))
  await act(() => vi.advanceTimersByTimeAsync(MIN_SPIN_MS - 1))
  expect(screen.getByText('Refreshing')).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(screen.queryByText('Refreshing')).not.toBeInTheDocument()
  expect(chip().style.transform).toBe('translateY(-44px)')
})

test('keeps spinning until a slow refetch finishes', async () => {
  const ref = renderChip(1000)
  act(() => ref.current!.release(300))
  await act(() => vi.advanceTimersByTimeAsync(999))
  expect(screen.getByText('Refreshing')).toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(screen.queryByText('Refreshing')).not.toBeInTheDocument()
})

test('a new pull works once it is idle again', async () => {
  const ref = renderChip(10)
  act(() => ref.current!.release(300))
  await act(() => vi.advanceTimersByTimeAsync(MIN_SPIN_MS))
  act(() => ref.current!.move(100))
  expect(chip().style.transform).toBe('translateY(6px)')
})
