import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Habit } from '../../api/types'
import { jsonResponse, problemResponse, requests, stubApi, type ApiRequest } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { HabitsPage } from './HabitsPage'

const read: Habit = { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY',
  startDate: '2026-11-01', status: 'ACTIVE' }
const run: Habit = { id: 2, name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS',
  intervalDays: 3, startDate: '2026-11-02', status: 'PAUSED' }
const piano: Habit = { id: 3, name: 'Piano', minText: '5 min', targetText: '30 min', frequency: 'WEEKLY',
  startDate: '2026-10-01', status: 'ARCHIVED' }

function api(overrides: (r: ApiRequest) => Response | undefined = () => undefined) {
  return stubApi((r) => {
    const custom = overrides(r)
    if (custom) return custom
    if (r.method === 'GET' && r.url === '/api/habits') return jsonResponse([read, run])
    if (r.method === 'GET' && r.url === '/api/habits?status=ARCHIVED') return jsonResponse([piano])
    return undefined
  })
}

describe('HabitsPage', () => {
  it('lists current habits and keeps archived ones in a collapsed section', async () => {
    api()
    renderWithProviders(<HabitsPage />, { route: '/habits' })

    const readRow = await screen.findByRole('listitem', { name: 'Read' })
    expect(within(readRow).getByText('Daily · since Sun 1 Nov')).toBeInTheDocument()
    expect(within(readRow).getByText('Green').nextElementSibling).toHaveTextContent('20 pages')
    expect(within(readRow).getByText('Yellow').nextElementSibling).toHaveTextContent('1 page')
    const runRow = screen.getByRole('listitem', { name: 'Run' })
    expect(within(runRow).getByText('Every 3 days · since Mon 2 Nov')).toBeInTheDocument()
    expect(within(runRow).getByText('Paused')).toBeInTheDocument()
    expect(within(runRow).getByRole('button', { name: 'Resume Run' })).toBeInTheDocument()
    expect(await screen.findByText('Archived (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unarchive Piano' })).toBeInTheDocument()
  })

  it('creates an every-N-days habit', async () => {
    const fetchMock = api((r) => (r.method === 'POST' ? jsonResponse({ ...run, id: 9, status: 'ACTIVE' }, 201) : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'New habit' }))
    await user.type(screen.getByLabelText('Name'), 'Run')
    await user.type(screen.getByLabelText('Bare minimum (YELLOW)'), '1 km')
    await user.type(screen.getByLabelText('Target (GREEN)'), '5 km')
    await user.selectOptions(screen.getByLabelText('Frequency'), 'EVERY_N_DAYS')
    await user.clear(screen.getByLabelText('Every how many days?'))
    await user.type(screen.getByLabelText('Every how many days?'), '3')
    await user.click(screen.getByRole('button', { name: 'Create habit' }))

    expect(await screen.findByRole('button', { name: 'New habit' })).toBeInTheDocument()
    expect(requests(fetchMock).find((r) => r.method === 'POST')).toEqual({
      method: 'POST',
      url: '/api/habits',
      body: { name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS', intervalDays: 3 },
    })
  })

  it('opens the form from the empty state', async () => {
    api((r) => (r.method === 'GET' ? jsonResponse([]) : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'Create your first habit' }))

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'No habits yet' })).not.toBeInTheDocument()
  })

  it('only asks for an interval for every-N-days habits', async () => {
    api()
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'New habit' }))

    expect(screen.queryByLabelText('Every how many days?')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Frequency'), 'EVERY_N_DAYS')
    expect(screen.getByLabelText('Every how many days?')).toBeInTheDocument()
  })

  it('edits only the texts', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ ...read, name: 'Read more' }) : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'Edit Read' }))
    expect(screen.queryByLabelText('Frequency')).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Read more')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('button', { name: 'Edit Read' })).toBeInTheDocument()
    expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
      method: 'PUT',
      url: '/api/habits/1',
      body: { name: 'Read more', minText: '1 page', targetText: '20 pages' },
    })
  })

  it('pauses and archives', async () => {
    const fetchMock = api((r) => (r.method === 'POST' ? jsonResponse(read) : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'Pause Read' }))
    await user.click(screen.getByRole('button', { name: 'Archive Read' }))

    const posts = requests(fetchMock).filter((r) => r.method === 'POST').map((r) => r.url)
    expect(posts).toEqual(['/api/habits/1/pause', '/api/habits/1/archive'])
  })

  it('shows action errors', async () => {
    api((r) => (r.method === 'POST' ? problemResponse(409, 'INVALID_STATE') : undefined))
    const { user } = renderWithProviders(<HabitsPage />, { route: '/habits' })

    await user.click(await screen.findByRole('button', { name: 'Pause Read' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("That action isn't available")
  })
})
