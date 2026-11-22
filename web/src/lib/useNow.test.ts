import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-18T06:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes every minute', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current.toISOString()).toBe('2026-11-18T06:30:00.000Z')

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.toISOString()).toBe('2026-11-18T06:31:00.000Z')
  })
})
