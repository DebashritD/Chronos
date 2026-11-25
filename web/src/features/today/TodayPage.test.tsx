import { onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentPeriod, Habit, Streak, WeekCell, WeekView } from '../../api/types'
import { jsonResponse, problemResponse, requests, stubApi, type ApiRequest } from '../../test/http'
import { subscribeSyncToast } from '../../lib/syncToast'
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
    { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY', intervalDays: null, status: 'ACTIVE',
      current: currentOf(readCells[2]), cells: readCells },
    { id: 2, name: 'Run', minText: '1 km', targetText: '5 km', frequency: 'EVERY_N_DAYS', intervalDays: 3, status: 'ACTIVE',
      current: currentOf(runCells[1]), cells: runCells },
    { id: 3, name: 'Piano', minText: '5 min', targetText: '30 min', frequency: 'WEEKLY', intervalDays: null, status: 'ACTIVE',
      current: currentOf(pianoCell), cells: [pianoCell] },
    { id: 4, name: 'Meditate', minText: '1 min', targetText: '10 min', frequency: 'DAILY', intervalDays: null, status: 'PAUSED',
      current: currentOf(meditateCells[2]), cells: meditateCells },
    { id: 5, name: 'Stretch', minText: '1 pose', targetText: '15 min', frequency: 'DAILY', intervalDays: null, status: 'ACTIVE',
      current: currentOf(stretchCells[2]), cells: stretchCells },
    // Swim: one 7-day period 15–21 Nov that began last week, so no cell of this week starts it.
    { id: 6, name: 'Swim', minText: '1 lap', targetText: '20 laps', frequency: 'EVERY_N_DAYS', intervalDays: 7, status: 'ACTIVE',
      current: { periodStart: '2026-11-15', state: 'PENDING', editable: true, note: null, closesAt: '2026-11-21T18:30:00Z' },
      cells: daily(['NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'PENDING']).map((cell) =>
        cell.date === '2026-11-22' ? { ...cell, closesAt: '2026-11-28T18:30:00Z' } : cell) },
    // Hike was paused mid-period: its 17–19 Nov period started before the pause, so it is still pending and editable.
    { id: 8, name: 'Hike', minText: '1 km', targetText: '10 km', frequency: 'EVERY_N_DAYS', intervalDays: 3, status: 'PAUSED',
      current: currentOf(runCells[1]), cells: runCells },
    // Yoga starts on 20 Nov: no current period yet.
    { id: 7, name: 'Yoga', minText: '1 pose', targetText: '20 min', frequency: 'DAILY', intervalDays: null, status: 'ACTIVE',
      current: null, cells: daily(['NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'NOT_DUE', 'PENDING', 'PENDING', 'PENDING']) },
  ],
}

const streaks: Streak[] = [
  { habitId: 1, name: 'Read', current: 12, best: 20, yellowRun: 0, yellowLimit: 2 },
  { habitId: 2, name: 'Run', current: 0, best: 4, yellowRun: 0, yellowLimit: 2 },
  { habitId: 3, name: 'Piano', current: 2, best: 2, yellowRun: 0, yellowLimit: 2 },
  { habitId: 5, name: 'Stretch', current: 1, best: 3, yellowRun: 0, yellowLimit: 2 },
  { habitId: 6, name: 'Swim', current: 3, best: 3, yellowRun: 0, yellowLimit: 2 },
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

/** The week with one habit's current period (18 Nov) set to `state`; `only` drops the other habits. */
function weekWith(habitId: number, state: WeekCell['state'], only = false): WeekView {
  const habits = week.habits.map((habit) => {
    if (habit.id !== habitId || !habit.current) return habit
    const cells = habit.cells.map((cell) => (cell.date === '2026-11-18' ? { ...cell, state } : cell))
    return { ...habit, current: { ...habit.current, state }, cells }
  })
  return { ...week, habits: only ? habits.filter((habit) => habit.id === habitId) : habits }
}

describe('TodayPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T06:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    onlineManager.setOnline(true)
  })

  it("shows the date, today's progress and one card per habit due today", async () => {
    api()
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(screen.getByText('Wednesday, 18 Nov')).toBeInTheDocument()
    const progress = screen.getByRole('region', { name: "Today's progress" })
    expect(within(progress).getByRole('heading', { name: 'Good start' })).toBeInTheDocument()
    expect(within(progress).getByText('1 of 5 marked. 4 to go.')).toBeInTheDocument()
    // The countdown lives in the (aria-hidden) header and is repeated for screen readers.
    expect(screen.getAllByText('12h left')).toHaveLength(2)
    expect(within(progress).getByRole('img', { name: '1 of 5 marked: 1 target' })).toBeInTheDocument()
    const names = screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent)
    expect(names).toEqual(['Run', 'Piano', 'Stretch', 'Swim', 'Read'])
    expect(screen.getByRole('heading', { level: 2, name: 'Done' })).toBeInTheDocument()

    // Read is on target: a stamped row with its note and streak, no mark buttons or countdown.
    const read = screen.getByRole('article', { name: 'Read' })
    expect(within(read).queryByRole('button', { name: /^(Target|Minimum|Missed)$/ })).not.toBeInTheDocument()
    expect(read).toHaveTextContent('Target hit')
    expect(read).toHaveTextContent('ch 3')
    expect(read).not.toHaveTextContent('20 pages')
    await waitFor(() => expect(read).toHaveTextContent('Current streak 12'))
    expect(chip(read)).toBeNull()

    const run = screen.getByRole('article', { name: 'Run' })
    expect(run).not.toHaveTextContent('5 km')
    // Mid-period: the 17–19 Nov period still shows on the 18th.
    expect(chip(run)).toHaveTextContent('1d 12h left in this period')
    expect(chip(run)).toHaveAttribute('data-tone', 'normal')

    const piano = screen.getByRole('article', { name: 'Piano' })
    expect(chip(piano)).toHaveTextContent('4d 12h left this week')

    const stretch = screen.getByRole('article', { name: 'Stretch' })
    expect(stretch).not.toHaveTextContent('1 pose')
    // A daily habit shows its time left only once urgent.
    expect(chip(stretch)).toBeNull()

    const swim = screen.getByRole('article', { name: 'Swim' })
    expect(chip(swim)).toHaveTextContent('3d 12h left in this period')
  })

  it('shows a daily habit streak as days unbroken', async () => {
    api()
    renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await waitFor(() => expect(read).toHaveTextContent('Current streak 12 days unbroken'))
  })

  it('turns the countdown orange in the last three hours', async () => {
    vi.setSystemTime(new Date('2026-11-18T15:50:00Z'))
    api()
    renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    expect(chip(stretch)).toHaveTextContent('2h 40m left')
    expect(chip(stretch)).toHaveAttribute('data-tone', 'urgent')
  })

  it('hides the countdown once the period has closed', async () => {
    vi.setSystemTime(new Date('2026-11-18T18:31:00Z'))
    api()
    renderWithProviders(<TodayPage />)

    expect(chip(await screen.findByRole('article', { name: 'Stretch' }))).toBeNull()
  })

  it('refetches the week once the earliest displayed period closes', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(new Date('2026-11-18T18:29:30Z'))
    const fetchMock = api()
    renderWithProviders(<TodayPage />)
    await screen.findByRole('article', { name: 'Read' })
    const weekRequests = () => requests(fetchMock).filter((r) => r.url.startsWith('/api/stats/week')).length
    expect(weekRequests()).toBe(1)

    await act(async () => { vi.advanceTimersByTime(60_000) })

    await waitFor(() => expect(weekRequests()).toBe(2))
    // The refetch returns the same closesAt; further ticks must not refetch again.
    await act(async () => { vi.advanceTimersByTime(120_000) })
    expect(weekRequests()).toBe(2)
  })

  it('marks with one tap, keeping the existing note', async () => {
    const red = weekWith(5, 'RED')
    red.habits = red.habits.map((habit) => habit.id === 5 && habit.current
      ? { ...habit, current: { ...habit.current, note: 'sore' } } : habit)
    const fetchMock = api((r) => (r.method === 'PUT' ? jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: 'sore' }) : undefined), red)
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    expect(within(stretch).getByRole('button', { name: 'Missed' })).toHaveAttribute('aria-pressed', 'true')
    expect(stretch).toHaveTextContent('sore')
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    await waitFor(() =>
      expect(requests(fetchMock).find((r) => r.method === 'PUT')).toEqual({
        method: 'PUT',
        url: '/api/habits/5/check-ins/2026-11-18',
        body: { color: 'YELLOW', note: 'sore' },
      }),
    )
  })

  it('vibrates on a tap and stamps the row once saved', async () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    let after = false
    api((r) => {
      if (r.method === 'PUT') {
        after = true
        return jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: null })
      }
      if (r.url.startsWith('/api/stats/week')) return jsonResponse(after ? weekWith(5, 'YELLOW') : week)
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    expect(vibrate).toHaveBeenCalledWith(14)
    await waitFor(() => expect(stretch.querySelector('[data-stamp]')).not.toBeNull())
    delete (navigator as { vibrate?: unknown }).vibrate
  })

  it('collapses a habit into Done once it is on target, stamping the row', async () => {
    let after = false
    api((r) => {
      if (r.method === 'PUT') {
        after = true
        return jsonResponse({ periodStart: '2026-11-18', color: 'GREEN', note: null })
      }
      if (r.url.startsWith('/api/stats/week')) return jsonResponse(after ? weekWith(5, 'GREEN') : week)
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Target' }))

    await waitFor(() => expect(within(stretch).queryByRole('button', { name: 'Target' })).not.toBeInTheDocument())
    expect(stretch).toHaveTextContent('Target hit')
    expect(stretch.querySelector('[data-stamp]')).not.toBeNull()
    expect(within(stretch).getByRole('button', { name: 'Stretch' })).toHaveFocus()
    const names = screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent)
    expect(names).toEqual(['Run', 'Piano', 'Swim', 'Read', 'Stretch'])
  })

  it('collapses a habit into a stamped row under Done when Minimum is marked', async () => {
    let after = false
    api((r) => {
      if (r.method === 'PUT') {
        after = true
        return jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: null })
      }
      if (r.url.startsWith('/api/stats/week')) return jsonResponse(after ? weekWith(5, 'YELLOW') : week)
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    await waitFor(() => expect(within(stretch).queryByRole('button', { name: /^Minimum$/ })).toBeNull())
    expect(stretch.querySelector('[data-stamp]')).not.toBeNull()
    const names = screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent)
    expect(names.indexOf('Stretch')).toBeGreaterThan(names.indexOf('Run'))
    expect(names.slice(-2)).toEqual(['Read', 'Stretch'])
  })

  it('edits notes only in the picker, not on the card', async () => {
    api(undefined, weekWith(5, 'YELLOW'))
    renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    expect(within(stretch).queryByRole('button', { name: /^Minimum$/ })).toBeNull()
    expect(stretch).toHaveTextContent('Minimum')
    expect(screen.queryByRole('button', { name: /note/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
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
    const fetchMock = api(undefined, weekWith(5, 'RED'))
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Missed' }))

    expect(requests(fetchMock).filter((r) => r.method === 'PUT')).toEqual([])
  })

  it('opens the picker from a done row to edit its note', async () => {
    api()
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Read' }))

    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(within(dialog).getByRole('button', { name: /^Target hit/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Note (optional)')).toHaveValue('ch 3')
  })

  it('shows the streak and time left in the picker', async () => {
    api()
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await waitFor(() => expect(read).toHaveTextContent('Current streak 12'))
    await user.click(within(read).getByRole('button', { name: 'Read' }))

    const dialog = screen.getByRole('dialog', { name: 'Read, Wed 18 Nov' })
    expect(dialog).toHaveTextContent('Current streak 12')
    expect(chip(dialog)).toBeNull()
  })

  it('drops a mark the server rejects and says so in a toast', async () => {
    api((r) => (r.method === 'PUT' ? problemResponse(422, 'CHECK_IN_NOT_ALLOWED') : undefined))
    const toast = vi.fn()
    const unsubscribe = subscribeSyncToast(toast)
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Couldn’t sync Stretch. Refreshed.'))
    expect(within(stretch).queryByRole('alert')).not.toBeInTheDocument()
    unsubscribe()
  })

  it('marks offline at once and sends nothing until back online', async () => {
    const fetchMock = api((r) => (r.method === 'PUT' ? new Response(null, { status: 204 }) : undefined))
    const { user } = renderWithProviders(<TodayPage />)
    const stretch = await screen.findByRole('article', { name: 'Stretch' })

    act(() => onlineManager.setOnline(false))
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    await waitFor(() => expect(stretch.querySelector('[data-stamp]')).not.toBeNull())
    expect(within(stretch).queryByRole('button', { name: /^Minimum$/ })).toBeNull()
    expect(requests(fetchMock).some((r) => r.method === 'PUT')).toBe(false)

    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(requests(fetchMock).some((r) => r.method === 'PUT')).toBe(true))
  })

  it('says it is offline while a never-loaded week waits for the connection', async () => {
    stubApi(() => undefined)
    onlineManager.setOnline(false)
    renderWithProviders(<TodayPage />)
    expect(await screen.findByText('Offline')).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('celebrates when everything is marked', async () => {
    const allDone: WeekView = {
      ...week,
      habits: week.habits.filter((habit) => habit.name === 'Read'),
    }
    api(undefined, allDone)
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('img', { name: '1 of 1 marked: 1 target' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All on target' })).toBeInTheDocument()
  })

  it('answers a miss with a kind word instead of a stamp', async () => {
    let state: WeekCell['state'] = 'PENDING'
    api((r) => {
      if (r.method === 'PUT') {
        state = 'RED'
        return jsonResponse({ periodStart: '2026-11-18', color: 'RED', note: null })
      }
      if (r.url.startsWith('/api/stats/week')) return jsonResponse(weekWith(5, state, true))
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    await user.click(within(stretch).getByRole('button', { name: 'Missed' }))

    expect(await within(stretch).findByRole('status')).toHaveTextContent("That's honest. Tomorrow is a fresh start.")
    expect(stretch.querySelector('[data-stamp]')).toBeNull()
    expect(screen.getByRole('heading', { name: 'All marked' })).toBeInTheDocument()
  })

  it('points to the habits page when there are none', async () => {
    api(undefined, { ...week, habits: [], distribution: { green: 0, yellow: 0, red: 0, grey: 0, total: 0 } })
    renderWithProviders(<TodayPage />)

    expect(await screen.findByRole('link', { name: 'Create your first habit' })).toHaveAttribute('href', '/habits')
  })

  it('warns when a minimum uses up the limit and stamps the card', async () => {
    let stretchRun = 1
    const fetchMock = api((r) => {
      if (r.method === 'PUT') {
        stretchRun = 2
        return jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: null })
      }
      if (r.url.startsWith('/api/stats/week')) return jsonResponse(stretchRun === 2 ? weekWith(5, 'YELLOW') : week)
      if (r.url === '/api/stats/streaks')
        return jsonResponse([{ habitId: 5, name: 'Stretch', current: 3, best: 9, yellowRun: stretchRun, yellowLimit: 2 }])
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    expect(within(stretch).queryByText('2/2 minimums in a row')).not.toBeInTheDocument()
    const streaksFetches = () => requests(fetchMock).filter((r) => r.url === '/api/stats/streaks').length
    await waitFor(() => expect(streaksFetches()).toBe(1))
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))

    const dialog = await screen.findByRole('alertdialog', { name: 'Yellow limit reached' })
    expect(streaksFetches()).toBe(2)
    expect(dialog).toHaveTextContent("You've hit 2 yellows in a row on Stretch. Next time go green, or the streak starts over.")
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(stretch.querySelector('[data-stamp]')).not.toBeNull()
  })

  it('still warns when the yellow syncs while another mark is queued behind it', async () => {
    let runRun = 1
    api((r) => {
      if (r.method === 'PUT') {
        if (r.url.startsWith('/api/habits/2/')) runRun = 2
        return new Response(null, { status: 204 })
      }
      if (r.url === '/api/stats/streaks')
        return jsonResponse([{ habitId: 2, name: 'Run', current: 3, best: 9, yellowRun: runRun, yellowLimit: 2 }])
      return undefined
    })
    const { user, queryClient } = renderWithProviders(<TodayPage />)
    const run = await screen.findByRole('article', { name: 'Run' })
    const stretch = screen.getByRole('article', { name: 'Stretch' })
    await waitFor(() => expect(queryClient.getQueryData(['stats', 'streaks'])).toBeDefined())

    act(() => onlineManager.setOnline(false))
    await user.click(within(run).getByRole('button', { name: 'Minimum' }))
    await user.click(within(stretch).getByRole('button', { name: 'Minimum' }))
    act(() => onlineManager.setOnline(true))

    expect(await screen.findByRole('alertdialog', { name: 'Yellow limit reached' })).toHaveTextContent('on Run')
  })

  it('does not warn again when a yellow is re-saved on a habit already at the limit', async () => {
    const fetchMock = api((r) => {
      if (r.method === 'PUT') return jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: 'ch 3' })
      if (r.url === '/api/stats/streaks')
        return jsonResponse([{ habitId: 1, name: 'Read', current: 3, best: 9, yellowRun: 2, yellowLimit: 2 }])
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const read = await screen.findByRole('article', { name: 'Read' })
    await user.click(within(read).getByRole('button', { name: 'Read' }))
    await user.click(screen.getByRole('button', { name: /^Minimum done/ }))

    await waitFor(() => {
      const all = requests(fetchMock)
      const put = all.findIndex((r) => r.method === 'PUT')
      expect(put).toBeGreaterThanOrEqual(0)
      expect(all.slice(put + 1).some((r) => r.url === '/api/stats/streaks')).toBe(true)
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('flags the yellow that would restart the streak, then says so once it does', async () => {
    let after = false
    api((r) => {
      if (r.method === 'PUT') {
        after = true
        return jsonResponse({ periodStart: '2026-11-18', color: 'YELLOW', note: null })
      }
      if (r.url === '/api/stats/streaks')
        return jsonResponse([{ habitId: 5, name: 'Stretch', current: after ? 1 : 3, best: 9, yellowRun: after ? 1 : 2, yellowLimit: 2 }])
      return undefined
    })
    const { user } = renderWithProviders(<TodayPage />)

    const stretch = await screen.findByRole('article', { name: 'Stretch' })
    const minimum = await within(stretch).findByRole('button', { name: 'Minimum', description: /another restarts the streak/ })
    expect(minimum).toHaveTextContent('restarts streak')
    await user.click(minimum)

    expect(await screen.findByText('Fresh start on Stretch: that was yellow 3 in a row, so the streak is back to 1.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('moves on to today’s periods on the device when the saved week is from yesterday', async () => {
    vi.setSystemTime(new Date('2026-11-19T06:30:00Z'))
    const habits: Habit[] = [
      { id: 1, name: 'Read', minText: '1 page', targetText: '20 pages', frequency: 'DAILY', startDate: '2026-11-01',
        status: 'ACTIVE', yellowCap: true },
      { id: 4, name: 'Meditate', minText: '1 min', targetText: '10 min', frequency: 'DAILY', startDate: '2026-11-01',
        status: 'PAUSED', yellowCap: true },
    ]
    api((r) => (r.url === '/api/habits' ? jsonResponse(habits) : undefined))
    renderWithProviders(<TodayPage />)

    expect(await screen.findByText('Thursday, 19 Nov')).toBeInTheDocument()
    const names = screen.getAllByRole('article').map((article) => within(article).getByRole('heading').textContent)
    expect(names).toEqual(['Read'])
    const read = screen.getByRole('article', { name: 'Read' })
    expect(within(read).getByRole('button', { name: 'Target' })).toHaveAttribute('aria-pressed', 'false')
    expect(chip(read)).toBeNull()
  })
})
