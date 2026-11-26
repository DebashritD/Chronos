import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../../api/types'
import { formatDayMonth } from '../../lib/dates'
import { jsonResponse, requests, stubApi } from '../../test/http'
import { renderWithProviders } from '../../test/utils'
import { TasksPage } from './TasksPage'

const plumber: Task = { id: 'a', text: 'Call the plumber', scheduledOn: '2026-11-15', doneOn: null, createdAt: '2026-11-15T05:00:00Z' }
const milk: Task = { id: 'b', text: 'Buy milk', scheduledOn: '2026-11-18', doneOn: '2026-11-18', createdAt: '2026-11-18T05:00:00Z' }
const old: Task = { id: 'c', text: 'Old done', scheduledOn: '2026-11-17', doneOn: '2026-11-17', createdAt: '2026-11-17T05:00:00Z' }
const photos: Task = { id: 'd', text: 'Sort old photos', scheduledOn: null, doneOn: null, createdAt: '2026-11-12T05:00:00Z' }

/** A stub server that keeps what it's sent, so the refetch after a write sees it. */
function api(initial: Task[] = [plumber, milk, old, photos]) {
  let list = initial
  return stubApi((r) => {
    if (r.method === 'GET' && r.url === '/api/tasks') return jsonResponse(list)
    const id = r.url.replace('/api/tasks/', '')
    if (r.method === 'PUT') {
      const saved = { createdAt: '2026-11-18T06:30:00Z', ...list.find((t) => t.id === id), ...(r.body as Pick<Task, 'text' | 'scheduledOn' | 'doneOn'>), id }
      list = [...list.filter((t) => t.id !== id), saved]
      return jsonResponse(saved)
    }
    if (r.method === 'DELETE') {
      list = list.filter((t) => t.id !== id)
      return new Response(null, { status: 204 })
    }
    return undefined
  })
}
const writes = (f: ReturnType<typeof stubApi>) => requests(f).filter((r) => r.method !== 'GET')

/** Drags a row sideways by `dx` on a 400px-wide row. */
function swipe(row: HTMLElement, dx: number): void {
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect)
  fireEvent.touchStart(row, { touches: [{ clientX: 350, clientY: 300 }] })
  fireEvent.touchMove(row, { touches: [{ clientX: 340, clientY: 300 }] })
  fireEvent.touchMove(row, { touches: [{ clientX: 350 + dx, clientY: 300 }] })
  fireEvent.touchEnd(row, { changedTouches: [{ clientX: 350 + dx, clientY: 300 }] })
}

describe('TasksPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T06:30:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('lists open with the carry-over note, done today struck through, and Later; hides earlier done', async () => {
    api()
    renderWithProviders(<TasksPage />, { route: '/tasks' })
    const open = await screen.findByRole('listitem', { name: 'Call the plumber' })
    expect(within(open).getByText('carried 3 days')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Buy milk' })).getByRole('checkbox')).toBeChecked()
    expect(screen.queryByText('Old done')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Later' })).getByText('Sort old photos')).toBeInTheDocument()
  })

  it('adds to Today and to Later, keeping focus', async () => {
    const f = api([])
    const { user } = renderWithProviders(<TasksPage />, { route: '/tasks' })
    const input = await screen.findByRole('textbox', { name: 'Add a task' })
    await user.type(input, 'Book dentist{Enter}')
    expect(input).toHaveFocus()
    expect(await screen.findByRole('listitem', { name: 'Book dentist' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Later' }))
    await user.type(input, 'Fix bike{Enter}')
    await waitFor(() => expect(writes(f).map((r) => (r.body as Task).scheduledOn)).toEqual(['2026-11-18', null]))
  })

  it('a chip tap keeps the input focused, so the chip survives Safari’s null-relatedTarget blur', async () => {
    const f = api([])
    const { user } = renderWithProviders(<TasksPage />, { route: '/tasks' })
    const input = await screen.findByRole('textbox', { name: 'Add a task' })
    await user.click(input)
    const later = screen.getByRole('button', { name: 'Later' })
    // Safari doesn't focus a tapped button: unless mousedown is prevented, the input blurs with no relatedTarget.
    if (fireEvent.mouseDown(later)) fireEvent.blur(input, { relatedTarget: null })
    fireEvent.click(later)
    expect(screen.getByRole('button', { name: 'Later' })).toHaveAttribute('aria-pressed', 'true')
    await user.type(input, 'Fix bike{Enter}')
    await waitFor(() => expect(writes(f).map((r) => (r.body as Task).scheduledOn)).toEqual([null]))
  })

  it('shows a Later task’s added date in the user’s timezone', async () => {
    api([{ ...photos, createdAt: '2026-11-11T19:30:00Z' }])
    renderWithProviders(<TasksPage />, { route: '/tasks' })
    const row = await screen.findByRole('listitem', { name: 'Sort old photos' })
    expect(within(row).getByText(`added ${formatDayMonth('2026-11-12')}`)).toBeInTheDocument()
  })

  it('ticks and un-ticks with today’s date', async () => {
    const f = api()
    const { user } = renderWithProviders(<TasksPage />, { route: '/tasks' })
    await user.click(within(await screen.findByRole('listitem', { name: 'Call the plumber' })).getByRole('checkbox'))
    await user.click(within(screen.getByRole('listitem', { name: 'Buy milk' })).getByRole('checkbox'))
    await waitFor(() => expect(writes(f).map((r) => [r.url, (r.body as Task).doneOn])).toEqual([
      ['/api/tasks/a', '2026-11-18'], ['/api/tasks/b', null],
    ]))
  })

  it('edits on tap; an empty edit cancels', async () => {
    const f = api()
    const { user } = renderWithProviders(<TasksPage />, { route: '/tasks' })
    await user.click(await screen.findByRole('button', { name: 'Edit Call the plumber' }))
    const field = screen.getByRole('textbox', { name: 'Edit task' })
    await user.clear(field)
    await user.type(field, 'Call Raj{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Edit Call Raj' }))
    await user.clear(screen.getByRole('textbox', { name: 'Edit task' }))
    await user.keyboard('{Enter}')
    expect(screen.getByRole('listitem', { name: 'Call Raj' })).toBeInTheDocument()
    expect(writes(f)).toHaveLength(1)
  })

  it('deletes from edit mode without a swipe, and Undo shows', async () => {
    const f = api()
    const { user } = renderWithProviders(<TasksPage />, { route: '/tasks' })
    await user.click(await screen.findByRole('button', { name: 'Edit Call the plumber' }))
    await user.click(within(screen.getByRole('listitem', { name: 'Call the plumber' })).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
    await waitFor(() => expect(writes(f).map((r) => `${r.method} ${r.url}`)).toEqual(['DELETE /api/tasks/a']))
    await new Promise((r) => setTimeout(r, 50))
    expect(writes(f)).toHaveLength(1)
  })

  it('moves an open task to Later from edit mode; Escape still cancels', async () => {
    const f = api()
    const { user } = renderWithProviders(<TasksPage />, { route: '/tasks' })
    await user.click(await screen.findByRole('button', { name: 'Edit Buy milk' }))
    expect(within(screen.getByRole('listitem', { name: 'Buy milk' })).queryByRole('button', { name: 'Later' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Edit Call the plumber' }))
    await user.click(within(screen.getByRole('listitem', { name: 'Call the plumber' })).getByRole('button', { name: 'Later' }))
    await waitFor(() => expect(writes(f).map((r) => [r.url, (r.body as Task).scheduledOn])).toEqual([['/api/tasks/a', null]]))
    expect(await within(screen.getByRole('region', { name: 'Later' })).findByText('Call the plumber')).toBeInTheDocument()
  })

  it('pulls a Later task onto today', async () => {
    const f = api()
    const { user } = renderWithProviders(<TasksPage />, { route: '/tasks' })
    await user.click(await screen.findByRole('button', { name: 'Do Sort old photos today' }))
    expect(await screen.findByRole('listitem', { name: 'Sort old photos' })).not.toHaveTextContent('carried')
    await waitFor(() => expect((writes(f)[0].body as Task).scheduledOn).toBe('2026-11-18'))
  })

  it('swipes to delete and Undo puts it back', async () => {
    const f = api()
    const { user } = renderWithProviders(<TasksPage />, { route: '/tasks' })
    const row = await screen.findByRole('listitem', { name: 'Call the plumber' })
    swipe(row, -300)
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Call the plumber' })).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('listitem', { name: 'Call the plumber' })).toBeInTheDocument()
    await waitFor(() => expect(writes(f).map((r) => r.method)).toEqual(['DELETE', 'PUT']))
  })

  it('a cancelled swipe springs back and changes nothing', async () => {
    const f = api()
    renderWithProviders(<TasksPage />, { route: '/tasks' })
    const row = await screen.findByRole('listitem', { name: 'Call the plumber' })
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ width: 400 } as DOMRect)
    fireEvent.touchStart(row, { touches: [{ clientX: 350, clientY: 300 }] })
    fireEvent.touchMove(row, { touches: [{ clientX: 340, clientY: 300 }] })
    fireEvent.touchMove(row, { touches: [{ clientX: 50, clientY: 300 }] })
    const content = row.querySelector<HTMLElement>('[style]')!
    expect(content.style.transform).toBe('translateX(-300px)')
    fireEvent.touchCancel(row)
    expect(content.style.transform).toBe('translateX(0px)')
    fireEvent.touchEnd(row, { changedTouches: [{ clientX: 50, clientY: 300 }] })
    await new Promise((r) => setTimeout(r, 50))
    expect(writes(f)).toEqual([])
    expect(row).toBeInTheDocument()
  })

  it('swipes a little to move to Later', async () => {
    const f = api()
    renderWithProviders(<TasksPage />, { route: '/tasks' })
    swipe(await screen.findByRole('listitem', { name: 'Call the plumber' }), -150)
    await waitFor(() => expect((writes(f)[0].body as Task).scheduledOn).toBeNull())
  })
})
