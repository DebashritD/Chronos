import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, requests, stubApi } from '../../test/http'
import { BOB, renderWithProviders } from '../../test/utils'
import { PlaygroundStep } from './PlaygroundStep'

describe('PlaygroundStep', () => {
  it('cycles a day and explains the streak', async () => {
    stubApi(() => undefined)
    const { user } = renderWithProviders(<PlaygroundStep onNext={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Read, Wed 18: Target hit' }))
    await user.click(screen.getByRole('button', { name: 'Read, Wed 18: Minimum done' }))

    expect(screen.getByRole('button', { name: 'Read, Wed 18: Missed' })).toBeInTheDocument()
    expect(screen.getByText('The miss on Wed restarted the streak.')).toBeInTheDocument()
  })

  it('saves a changed limit on Next, and sends nothing when unchanged', async () => {
    const fetchMock = stubApi(({ method }) => (method === 'PUT' ? jsonResponse({ ...BOB, maxYellows: 3 }) : undefined))
    const onNext = vi.fn()
    const { user } = renderWithProviders(<PlaygroundStep onNext={onNext} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(requests(fetchMock)).toEqual([{ method: 'PUT', url: '/api/auth/me', body: { maxYellows: 3 } }])
    expect(onNext).toHaveBeenCalledTimes(2)
  })
})
