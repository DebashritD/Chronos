import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentPeriod, Streak, WeekCell, WeekView } from '../../api/types'
import { jsonResponse, problemResponse, requests, stubApi, type ApiRequest } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { TodayPage } from './TodayPage'

const days = ['16', '17', '18', '19', '20', '21', '22'].map((d) => `2026-11-${d}`)

/** Daily cells in Asia/Kolkata: each day closes at 18:30Z (midnight IST). */
function daily(states: WeekCell['state'][], notes: (string | null)[] = []): WeekCell[] {
  return days.map((date, i) => ({
    date,
    periodStart: states[i] === 'NOT_DUE' ? null : date,
    state: states[i],
    editable: date <= '2026-11-18' && states[i] !== 'PAUSED' && states[i] !== 'NOT_DUE',
    note: notes[i] ?? null,
    closesAt: states[i] === 'NOT_DUE' ? null : `${date}T18:30:00Z`,
  }))
}

const STRETCH_WEEK: WeekCell['state'][] = ['GREEN', 'RED', 'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING']

/** `current` for a habit whose current period is the given week cell. */
function currentOf(cell: WeekCell): CurrentPeriod {
  return { periodStart: cell.periodStart ?? cell.date, state: cell.state, editable: cell.editable, note: cell.note,
    closesAt: cell.closesAt ?? `${cell.date}T18:30:00Z` }
}

const readCells = daily(['GREEN', 'RED', 'GREEN', 'PENDING', 'PENDING', 'PENDING', 'PENDING'], [null, null, 'ch 3'])
// Run: 3-day periods 17–19 and 20–22 Nov. Today (18th) is mid-period.
const runCells = daily(['NOT_DUE', 'PENDING', 'NOT_DUE', 'NOT_DUE', 'PENDING', 'NOT_DUE', 'NOT_DUE']).map((cell) =>
  cell.date === '2026-11-17' ? { ...cell, closesAt: '2026-11-19T18:30:00Z' }
    : cell.date === '2026-11-20' ? { ...cell, editable: false, closesAt: '2026-11-22T18:30:00Z' } : cell)
const pianoCell: WeekCell = { date: '2026-11-16', periodStart: '2026-11-16', state: 'PENDING', editable: true, note: null,
  closesAt: '2026-11-22T18:30:00Z' }
const meditateCells = daily(Array<WeekCell['state']>(7).fill('PAUSED'))
const stretchCells = daily(STRETCH_WEEK)

const week: WeekView = {
  start: '2026-11-16',
  today: '2026-11-18',
  distribution: { green: 2, yellow: 0, red: 1, grey: 0, total: 3 },
  habits: [
    { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY', intervalDays: null,
      current: currentOf(readCells[2]), cells: readCells },
    { id: 2, name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS', intervalDays: 3,
      current: currentOf(runCells[1]), cells: runCells },
    { id: 3, name: 'Piano', minText: '5 min', targetText: '30 min', frequency: 'WEEKLY', intervalDays: null,
      current: currentOf(pianoCell), cells: [pianoCell] },
    { id: 4, name: 'Meditate', minText: '1 min', targetText: '10 min', frequency: 'DAILY', intervalDays: null,
      current: currentOf(meditateCells[2]), cells: meditateCells },
    { id: 5, name: 'Stretch', minText: '1 pose', targetText: '15 min', frequency: 'DAILY', intervalDays: null,
      current: currentOf(stretchCells[2]), cells: stretchCells },
    // Swim: one 7-day period 15–21 Nov that began last week, so no cell of this week starts it.
    { id: 6, name: 'Swim', minText: '1 lap', targetText: '20 laps', frequency: 'EVERY_N_DAYS', intervalDays: 7,
      current: { periodStart: '2026-11-15', state: 'PENDING', editable: true, note: null, closesAt: '2026-11-21T18:30:00Z' },
      cells: daily(['NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'PENDING']).map((cell) =>
        cell.date === '2026-11-22' ? { ...cell, closesAt: '2026-11-28T18:30:00Z' } : cell) },
    // Yoga starts on 20 Nov: no current period yet.
    { id: 7, name: 'Yoga', minText: '1 pose', targetText: '20 min', frequency: 'DAILY', intervalDays: null,
      current: null, cells: daily(['NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'PENDING', 'PENDING', 'PENDING']) },
  ],
}

const streaks: Streak[] = [
  { habitId: 1, name: 'Read', current: 12, best: 20 },
  { habitId: 2, name: 'Run', current: 0, best: 4 },
  { habitId: 3, name: 'Piano', current: 2, best: 2 },
  { habitId: 5, name: 'Stretch', current: 1, best: 3 },
  { habitId: 6, name: 'Swim', current: 3, best: 3 },
]

function api(overrides: (r: ApiRequest) => Response | undefined = () => undefined, data: WeekView = week) {
  return stubApi((r) => {
    const custom = overrides(r)
    if (custom) return custom
    if (r.url.startsWith('/api/stats/week')) return jsonResponse(data)
    if (r.url === '/api/stats/streaks') return jsonResponse(streaks)
    return undefined
  })
}

function chip(article: HTMLElement): HTMLElement | null {
  return article.querySelector('[data-tone]')
}

describe('TodayPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T06:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the date, today's progress and one card per habit due today", async () => {
    api()
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('Wednesday, 18 Nov')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '1 of 5 done' })).toBeInTheDocument()
    expect(screen.getByText('4 habits left today. Even the minimum keeps it off red.')).toBeInTheDocument()
    const names = screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent)
    expect(names).toEqual(['Read', 'Run', 'Piano', 'Stretch', 'Swim'])

    const read = screen.getByRole('article', { name: 'Read' })
    expect(within(read).getByRole('button', { name: 'Target' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(read).getByRole('button', { name: 'Minimum' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(read).getByRole('button', { name: 'Missed' })).toHaveAttribute('aria-pressed', 'false')
    expect(read).toHaveTextContent('Min 1 page · Target 20 pages')
    await waitFor(() => expect(read).toHaveTextContent('Current streak 12'))
    expect(chip(read)).toHaveTextContent('12h left today')
    expect(chip(read)).toHaveAttribute('data-tone', 'done')

    const run = screen.getByRole('article', { name: 'Run' })
    expect(run).toHaveTextContent('Every 3 days · Min 1 km · Target 5 km')
    // Mid-period: the 17–19 Nov period still shows on the 18th.
    expect(chip(run)).toHaveTextContent('1d 12h left in this period')
    expect(chip(run)).toHaveAttribute('data-tone', 'normal')

    const piano = screen.getByRole('article', { name: 'Piano' })
    expect(piano).toHaveTextContent('This week · Min 5 min · Target 30 min')
    expect(chip(piano)).toHaveTextContent('4d 12h left this week')

    expect(chip(screen.getByRole('article', { name: 'Stretch' }))).toHaveTextContent('12h left today')

    const swim = screen.getByRole('article', { name: 'Swim' })
    expect(swim).toHaveTextContent('Every 7 days · Min 1 lap · Target 20 laps')
    expect(chip(swim)).toHaveTextContent('3d 12h left in this period')
  })

  it('turns the countdown orange in the last three hours', async () => {
    vi.setSystemTime(new Date('2026-11-18T15:50:00Z'))
    api()
    renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    expect(chip(stretch)).toHaveTextContent('2h 40m left')
    expect(chip(stretch)).toHaveAttribute('data-tone', 'urgent')
    expect(chip(screen.getByRole('article', { name: 'Read' }))).toHaveAttribute('data-tone', 'done')
  })

  it('hides the countdown once the period has closed', async () => {
    vi.setSystemTime(new Date('2026-11-18T18:31:00Z'))
    api()
    renderWithProviders(<TodayPage />)

    expect(chip(await screen.findByRole('article', { name: 'Stretch' }))).toBeNull()
  })

  it('marks with one tap, keeping the existing note', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'RED', note: 'ch 3' }) : undefined))
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Missed' }))

    await waitFor(() =>
      expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
        method: 'PUT',
        url: '/api/habits/1/check-ins/2026-11-18',
        body: { color: 'RED', note: 'ch 3' },
      }),
    )
    await waitFor(() =>
      expect(requests(fetchMock).filter((r) => r.url.startsWith('/api/stats/week')).length).toBeGreaterThan(1),
    )
  })

  it('marks the current period of multi-day habits, even one that began last week', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-16', color: 'YELLOW', note: null }) : undefined))
    const { user } = renderWithProviders(<TodayPage />)

    await user.click(within(await screen.findByRole('article', { name: 'Piano' })).getByRole('button', { name: 'Minimum' }))
    await user.click(within(screen.getByRole('article', { name: 'Run' })).getByRole('button', { name: 'Target' }))
    await user.click(within(screen.getByRole('article', { name: 'Swim' })).getByRole('button', { name: 'Minimum' }))

    await waitFor(() =>
      expect(requests(fetchMock).filter((r) => r.method === 'PUT')).toEqual([
        { method: 'PUT', url: '/api/habits/3/check-ins/2026-11-16', body: { color: 'YELLOW', note: null } },
        { method: 'PUT', url: '/api/habits/2/check-ins/2026-11-17', body: { color: 'GREEN', note: null } },
        { method: 'PUT', url: '/api/habits/6/check-ins/2026-11-15', body: { color: 'YELLOW', note: null } },
      ]),
    )
  })

  it('does nothing when the selected button is tapped again', async () => {
    const fetchMock = api()
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Target' }))

    expect(requests(fetchMock).filter((r) => r.method === 'PUT')).toEqual([])
  })

  it('opens the picker from the habit name to add a note', async () => {
    api()
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Read' }))

    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Note (optional)')).toHaveValue('ch 3')
  })

  it('shows save errors on the card', async () => {
    api((r) => (r.method === 'PUT' ? problemResponse(422, 'CHECK_IN_NOT_ALLOWED') : undefined))
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    expect(await within(stretch).findByRole('alert')).toHaveTextContent('That period can no longer be changed')
  })

  it('celebrates when everything is marked', async () => {
    const allDone: WeekView = {
      ...week,
      habits: week.habits.filter((habit) => habit.name === 'Read'),
    }
    api(undefined, allDone)
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('img', { name: '1 of 1 done' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All done' })).toBeInTheDocument()
  })

  it('points to the habits page when there are none', async () => {
    api(undefined, { ...week, habits: [], distribution: { green: 0, yellow: 0, red: 0, grey: 0, total: 0 } })
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('link', { name: 'Create your first habit' })).toHaveAttribute('href', '/habits')
  })
})
