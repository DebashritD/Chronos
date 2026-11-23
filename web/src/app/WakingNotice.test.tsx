import { onlineManager } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackPending } from '../api/pending'
import { WakingNotice } from './WakingNotice'

describe('WakingNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays hidden before 3 seconds of pending requests', () => {
    render(<WakingNotice />)

    let resolvePending: () => void = () => {}
    act(() => {
      trackPending(new Promise<void>((resolve) => (resolvePending = resolve)))
    })

    act(() => {
      vi.advanceTimersByTime(2999)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    resolvePending()
  })

  it('shows the notice once a request has been pending for 3 seconds', async () => {
    render(<WakingNotice />)

    let resolvePending: () => void = () => {}
    const pending = act(async () => {
      trackPending(new Promise<void>((resolve) => (resolvePending = resolve)))
    })
    await pending

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByRole('status')).toHaveTextContent('Waking the server…')
    expect(screen.getByRole('status').className).toMatch(/z-40/)
    expect(screen.getByRole('status').className).toContain('bottom-[calc(4.5rem+env(safe-area-inset-bottom))]')

    resolvePending()
  })

  it('hides the notice once the pending request settles', async () => {
    render(<WakingNotice />)

    let resolvePending: () => void = () => {}
    await act(async () => {
      trackPending(new Promise<void>((resolve) => (resolvePending = resolve)))
    })

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    await act(async () => {
      resolvePending()
      await Promise.resolve()
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stays hidden while offline', () => {
    render(<WakingNotice />)
    act(() => onlineManager.setOnline(false))

    let resolvePending: () => void = () => {}
    act(() => {
      trackPending(new Promise<void>((resolve) => (resolvePending = resolve)))
    })
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    resolvePending()
    act(() => onlineManager.setOnline(true))
  })
})
