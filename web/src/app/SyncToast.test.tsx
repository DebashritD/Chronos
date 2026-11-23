import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showSyncToast } from '../lib/syncToast'
import { SYNC_TOAST_MS, SyncToast } from './SyncToast'

describe('SyncToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the latest message and hides it after 4 seconds', () => {
    render(<SyncToast />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => showSyncToast('Couldn’t sync Read. Refreshed.'))
    act(() => vi.advanceTimersByTime(SYNC_TOAST_MS - 1000))
    act(() => showSyncToast('Couldn’t sync Run. Refreshed.'))
    expect(screen.getByRole('status')).toHaveTextContent('Couldn’t sync Run. Refreshed.')

    act(() => vi.advanceTimersByTime(SYNC_TOAST_MS - 1))
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
