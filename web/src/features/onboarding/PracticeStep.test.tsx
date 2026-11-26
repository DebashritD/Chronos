import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { PracticeStep } from './PracticeStep'

describe('PracticeStep', () => {
  it('enables Next after a mark, stamps the row, and saves nothing', async () => {
    const fetchMock = stubApi(() => undefined)
    const { user } = renderWithProviders(<PracticeStep onNext={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Target' }))

    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(screen.getByText('Target hit')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('tap the row to open it')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('opens the picker from the row; Clear reopens the day', async () => {
    stubApi(() => undefined)
    const { user } = renderWithProviders(<PracticeStep onNext={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Minimum' }))
    await user.click(screen.getByRole('button', { name: 'Read' }))

    expect(screen.getByRole('dialog', { name: 'Read' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Target' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Cleared. The day is open again.')).toBeInTheDocument()
  })
})
