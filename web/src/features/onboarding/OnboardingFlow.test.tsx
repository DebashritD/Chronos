import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { jsonResponse, problemResponse, requests, stubApi } from '../../test/http'
import { BOB, renderWithProviders } from '../../test/utils'
import { OnboardingFlow } from './OnboardingFlow'

const NEW = { ...BOB, onboarded: false }
const HABIT = { id: 7, name: 'Workout', minText: '10 min', targetText: '45 min', frequency: 'DAILY', startDate: '2026-11-27', status: 'ACTIVE', yellowCap: true }

function api(existing: unknown[] = []) {
  return stubApi(({ method, url }) => {
    if (method === 'GET' && url.startsWith('/api/habits')) return jsonResponse(existing)
    if (method === 'POST' && url === '/api/habits') return jsonResponse(HABIT, 201)
    if (method === 'POST' && url === '/api/auth/me/onboarded') return new Response(null, { status: 204 })
    return undefined
  })
}

async function skipToHabit(user: ReturnType<typeof renderWithProviders>['user']) {
  expect(screen.getByRole('heading', { name: 'Aim for no reds, not perfect days.' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Skip' }))
  expect(await screen.findByRole('heading', { name: 'Start with one habit.' })).toBeInTheDocument()
}

describe('OnboardingFlow', () => {
  it('walks Welcome → How → Practice in order', async () => {
    api()
    const { user } = renderWithProviders(<OnboardingFlow replay={false} />, { me: NEW })
    expect(screen.getByText('Welcome, bob')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show me how' }))
    expect(screen.getByRole('heading', { name: 'Every habit has two levels.' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Marking is one tap.' })).toBeInTheDocument()
  })

  it('skips to the first habit, which has no skip, and needs every field', async () => {
    api()
    const { user } = renderWithProviders(<OnboardingFlow replay={false} />, { me: NEW })
    await skipToHabit(user)
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
    const create = screen.getByRole('button', { name: 'Create habit' })
    expect(create).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Workout' }))
    expect(screen.getByLabelText('Minimum')).toHaveValue('10 min')
    expect(screen.getByLabelText('Target')).toHaveValue('45 min')
    expect(create).toBeEnabled()

    await user.clear(screen.getByLabelText('Target'))
    expect(screen.getByRole('button', { name: 'Workout' })).toHaveAttribute('aria-pressed', 'false')
    expect(create).toBeDisabled()
  })

  it('creates the habit, marks the account onboarded, then shows the install tip', async () => {
    const fetchMock = api()
    const { user } = renderWithProviders(<OnboardingFlow replay={false} />, { me: NEW, route: '/welcome' })
    await skipToHabit(user)
    await user.click(screen.getByRole('button', { name: 'Workout' }))
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await screen.findByRole('heading', { name: 'Keep it one tap away.' })).toBeInTheDocument()
    expect(screen.getByText('Workout')).toBeInTheDocument()
    const writes = requests(fetchMock).filter((r) => r.method === 'POST')
    expect(writes).toEqual([
      { method: 'POST', url: '/api/habits', body: { name: 'Workout', minText: '10 min', targetText: '45 min', frequency: 'DAILY', yellowCap: true } },
      { method: 'POST', url: '/api/auth/me/onboarded', body: undefined },
    ])

    await user.click(screen.getByRole('button', { name: 'Go to Today' }))
    expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/)
  })

  it('keeps what was typed when creating fails', async () => {
    stubApi(({ method, url }) => {
      if (method === 'GET' && url.startsWith('/api/habits')) return jsonResponse([])
      if (method === 'POST' && url === '/api/habits') return problemResponse(503, 'UNAVAILABLE', 'Server is waking up')
      return undefined
    })
    const { user } = renderWithProviders(<OnboardingFlow replay={false} />, { me: NEW })
    await skipToHabit(user)
    await user.type(screen.getByLabelText('Name'), 'Journal')
    await user.type(screen.getByLabelText('Minimum'), '1 line')
    await user.type(screen.getByLabelText('Target'), '1 page')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Journal')
  })

  it('on replay with habits, offers Done and never marks onboarded', async () => {
    const fetchMock = api([HABIT])
    const { user } = renderWithProviders(<OnboardingFlow replay />)
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await user.click(await screen.findByRole('button', { name: 'Done' }))

    expect(await screen.findByText('You’re all set.')).toBeInTheDocument()
    expect(requests(fetchMock).some((r) => r.url === '/api/auth/me/onboarded')).toBe(false)
  })
})
