import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Streak, WeekCell, WeekView } from '../../api/types'
import { jsonResponse, problemResponse, requests, stubApi, type ApiRequest } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { WeekPanel } from './WeekPanel'

const days = ['16', '17', '18', '19', '20', '21', '22'].map((d) => `2026-11-${d}`)

function daily(states: WeekCell['state'][]): WeekCell[] {
  return days.map((date, i) => ({
    date,
    periodStart: date,
    state: states[i],
    editable: date <= '2026-11-18',
    note: i === 0 ? 'great' : null,
    closesAt: `${date}T18:30:00Z`,
  }))
}

const week: WeekView = {
  start: '2026-11-16',
  today: '2026-11-18',
  distribution: { green: 1, yellow: 0, red: 1, grey: 0, total: 2 },
  habits: [
    { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY', intervalDays: null, status: 'ACTIVE',
      current: { periodStart: '2026-11-18', state: 'PENDING', editable: true, note: null, closesAt: '2026-11-18T18:30:00Z' },
      cells: daily(['GREEN', 'RED', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']) },
    { id: 2, name: 'Piano', minText: '5 min', targetText: '30 min', frequency: 'WEEKLY', intervalDays: null, status: 'ACTIVE',
      current: { periodStart: '2026-11-16', state: 'PENDING', editable: true, note: null, closesAt: '2026-11-22T18:30:00Z' },
      cells: [{ date: '2026-11-16', periodStart: '2026-11-16', state: 'PENDING', editable: true, note: null,
        closesAt: '2026-11-22T18:30:00Z' }] },
  ],
}
const streaks: Streak[] = [{ habitId: 1, name: 'Read', current: 0, best: 9, yellowRun: 0, yellowLimit: 2 }]

function api(overrides: (r: ApiRequest) => Response | undefined = () => undefined) {
  return stubApi((r) => {
    const custom = overrides(r)
    if (custom) return custom
    if (r.url.startsWith('/api/stats/week')) return jsonResponse(week)
    if (r.url === '/api/stats/streaks') return jsonResponse(streaks)
    return undefined
  })
}

describe('WeekPanel', () => {
  it('shows the grid, distribution and streaks', async () => {
    api()
    renderWithProviders(<WeekPanel />, { route: '/progress' })

    expect(await screen.findByRole('heading', { name: '16 – 22 Nov 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read, Mon 16 Nov, Target hit' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Read, Tue 17 Nov, Missed' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Read, Thu 19 Nov, Not marked yet' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Piano, week of Mon 16 Nov, Not marked yet' })).toBeEnabled()
    expect(screen.getByRole('heading', { level: 3, name: 'Read' }).closest('li')).toContainElement(
      screen.getByRole('button', { name: 'Read, Mon 16 Nov, Target hit' }))
    const distribution = screen.getByRole('region', { name: 'This week' })
    expect(within(distribution).getByRole('listitem', { name: 'Green 1' })).toBeInTheDocument()
    expect(within(distribution).getByRole('listitem', { name: 'Red 1' })).toBeInTheDocument()
    const streakList = screen.getByRole('region', { name: 'Streaks' })
    expect(await within(streakList).findByRole('listitem', { name: 'Read' })).toHaveTextContent('0 · best 9')
  })

  it("marks today's cells", async () => {
    api()
    renderWithProviders(<WeekPanel />, { route: '/progress' })

    expect(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: /^Piano/ })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: /^Read, Tue/ })).not.toHaveAttribute('aria-current')
  })

  it('saves a color with a note', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'GREEN', note: 'ch 4' }) : undefined))
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' }))
    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveTextContent('20 pages')
    expect(within(dialog).getByRole('button', { name: /^Minimum done/ })).toHaveTextContent('1 page')
    expect(within(dialog).getByRole('button', { name: /^Missed/ })).toHaveTextContent("Didn't do it")
    await user.click(within(dialog).getByRole('button', { name: /^Target hit/ }))
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'ch 4')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
      method: 'PUT',
      url: '/api/habits/1/check-ins/2026-11-18',
      body: { color: 'GREEN', note: 'ch 4' },
    })
    expect(requests(fetchMock).filter((r) => r.url.startsWith('/api/stats/week')).length).toBeGreaterThan(1)
  })

  it('opens with the current color and note, and clears', async () => {
    const fetchMock = api((r) => (r.method === 'DELETE' ? new Response(null, { status: 204 }) : undefined))
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Mon 16 Nov, Target hit' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Note (optional)')).toHaveValue('great')
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(requests(fetchMock).find((r) => r.method === 'DELETE')?.url).toBe('/api/habits/1/check-ins/2026-11-16')
  })

  it('has no Clear for unmarked periods and closes on Cancel', async () => {
    api()
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: /^Piano/ }))
    expect(screen.getByRole('dialog', { name: 'Piano, week of Mon 16 Nov' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows save errors in the picker', async () => {
    api((r) => (r.method === 'PUT' ? problemResponse(422, 'CHECK_IN_NOT_ALLOWED') : undefined))
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Tue 17 Nov, Missed' }))
    await user.click(screen.getByRole('button', { name: /^Minimum done/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
      'That period can no longer be changed',
    )
  })

  it('moves between weeks', async () => {
    const fetchMock = api()
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    expect(await screen.findByRole('region', { name: 'This week' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'This week' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous week' }))

    expect(await screen.findByRole('button', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Distribution' })).toBeInTheDocument()
    expect(requests(fetchMock).map((r) => r.url)).toContain('/api/stats/week?start=2026-11-09')
  })

  it('points to the habits page when there are none', async () => {
    api((r) => (r.url.startsWith('/api/stats/week') ? jsonResponse({ ...week, habits: [], distribution: { green: 0, yellow: 0, red: 0, grey: 0, total: 0 } }) : undefined))
    renderWithProviders(<WeekPanel />, { route: '/progress' })

    expect(await screen.findByRole('link', { name: 'Create your first habit' })).toHaveAttribute('href', '/habits')
  })

  it('warns when a yellow saved from the grid uses up the limit', async () => {
    let run = 1
    api((r) => {
      if (r.method === 'PUT') {
        run = 2
        return jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: null })
      }
      if (r.url === '/api/stats/streaks')
        return jsonResponse([{ habitId: 1, name: 'Read', current: 3, best: 9, yellowRun: run, yellowLimit: 2 }])
      return undefined
    })
    const { user } = renderWithProviders(<WeekPanel />, { route: '/progress' })

    await user.click(await screen.findByRole('button', { name: 'Read, Wed 18 Nov, Not marked yet' }))
    await user.click(screen.getByRole('button', { name: /^Minimum done/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alertdialog', { name: 'Yellow limit reached' })).toBeInTheDocument()
  })
})
