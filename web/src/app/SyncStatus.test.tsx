import { MutationObserver, onlineManager } from '@tanstack/react-query'
import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { stubApi } from '../test/http'
import { renderWithProviders } from '../test/utils'
import { CHECK_IN_KEY } from '../features/checkin/queue'
import type { CheckInVars } from '../features/checkin/patchWeek'
import { SyncStatus, syncStatusText } from './SyncStatus'

describe('syncStatusText', () => {
  it('words each case', () => {
    expect(syncStatusText(true, 0)).toBeNull()
    expect(syncStatusText(true, 2)).toBe('Syncing 2…')
    expect(syncStatusText(false, 0)).toBe('Offline')
    expect(syncStatusText(false, 1)).toBe('Offline · 1 waiting to sync')
    expect(syncStatusText(false, 3)).toBe('Offline · 3 waiting to sync')
  })
})

describe('SyncStatus', () => {
  afterEach(() => {
    act(() => onlineManager.setOnline(true))
  })

  it('follows the connection and the queue', async () => {
    stubApi(() => undefined)
    const { queryClient } = renderWithProviders(<SyncStatus />)
    expect(screen.queryByText(/Offline|Syncing/)).not.toBeInTheDocument()

    act(() => onlineManager.setOnline(false))
    expect(screen.getByText('Offline')).toHaveClass('text-[12px]')

    act(() => {
      void new MutationObserver<void, Error, CheckInVars>(queryClient, { mutationKey: CHECK_IN_KEY })
        .mutate({ op: 'clear', habitId: 1, periodStart: '2026-11-18' }).catch(() => undefined)
    })
    expect(await screen.findByText('Offline · 1 waiting to sync')).toBeInTheDocument()
    queryClient.getMutationCache().clear()
  })
})
