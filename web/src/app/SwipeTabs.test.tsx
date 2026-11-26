import { onlineManager, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { createQueryClient } from '../api/queryClient'
import { drag, pause, stubMedia, useFakeSwipeClock } from '../test/touch'
import { LocationDisplay } from '../test/utils'
import { SETTLE_MS, SwipeTabs } from './SwipeTabs'

vi.mock('./tabPages', async () => {
  const { useIsNeighbour } = await import('./neighbour')
  function Page({ to }: { to: string }) {
    return <p>{useIsNeighbour() ? 'Neighbour' : 'Live page'} {to}</p>
  }
  return { renderTabPage: (to: string) => <Page to={to} /> }
})

function renderTabs(route = '/') {
  const queryClient = createQueryClient({ retry: false })
  const refetch = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<SwipeTabs />}>
            <Route path="/" element={<p>Today page</p>} />
            <Route path="/tasks" element={<p>Tasks page</p>} />
            <Route path="/progress" element={<p>Progress page <input aria-label="Note" /></p>} />
            <Route path="/habits" element={<p>Habits page</p>} />
            <Route path="/settings" element={<p>Account page</p>} />
            <Route path="*" element={<p>Missing page</p>} />
          </Route>
        </Routes>
        <LocationDisplay />
        <Link to="/">Go Today</Link>
        <Link to="/tasks">Go Tasks</Link>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { refetch }
}

const location = () => screen.getByTestId('location-display')

beforeEach(() => {
  stubMedia()
  useFakeSwipeClock()
  // jsdom doesn't implement scrolling.
  vi.stubGlobal('scrollTo', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('tab swipe', () => {
  test('a left swipe on Today goes to Tasks', async () => {
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    await waitFor(() => expect(location()).toHaveTextContent('/tasks'))
    expect(screen.getByText('Tasks page')).toBeInTheDocument()
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  test('tapping a tab also starts the new tab at the top', () => {
    renderTabs('/')
    vi.mocked(window.scrollTo).mockClear()
    fireEvent.click(screen.getByRole('link', { name: 'Go Tasks' }))
    expect(location()).toHaveTextContent('/tasks')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  test('a fast short flick also switches', async () => {
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [240, 400], 50)
    await waitFor(() => expect(location()).toHaveTextContent('/tasks'))
  })

  test('a right swipe on Tasks goes back to Today', async () => {
    renderTabs('/tasks')
    drag(screen.getByText('Tasks page'), [100, 400], [300, 400])
    await waitFor(() => expect(location()).toHaveTextContent(/^\/$/))
  })

  test('the neighbour is gone after a committed swipe and a return', async () => {
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    await waitFor(() => expect(location()).toHaveTextContent('/tasks'))
    fireEvent.click(screen.getByText('Go Today'))
    await waitFor(() => expect(location()).toHaveTextContent(/^\/$/))
    expect(screen.queryByText('Neighbour /tasks')).not.toBeInTheDocument()
  })

  test('a tab tap during the settle wins over the swipe', async () => {
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    fireEvent.click(screen.getByText('Go Tasks'))
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent('/tasks')
    expect(screen.getByText('Tasks page')).toBeInTheDocument()
  })

  test('shows the neighbour while dragging', () => {
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [200, 400])
    expect(screen.getByText('Neighbour /tasks')).toBeInTheDocument()
  })

  test.each([
    ['a short slow drag', '/', [300, 400], [250, 400]],
    ['a right swipe on Today', '/', [100, 400], [350, 400]],
    ['a left swipe on Account', '/settings', [300, 400], [40, 400]],
    ['a start in the right edge zone', '/', [380, 400], [100, 400]],
    ['a vertical drag', '/', [200, 300], [215, 500]],
  ] as const)('%s stays put', async (_name, route, from, to) => {
    renderTabs(route)
    drag(screen.getByText(/page/), [...from], [...to])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent(new RegExp(`^${route}$`))
  })

  test('a swipe starting on a form control is ignored', async () => {
    renderTabs('/progress')
    drag(screen.getByLabelText('Note'), [100, 400], [300, 400])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent('/progress')
  })

  test('no swipe while a dialog is open', async () => {
    renderTabs('/')
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialog)
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent(/^\/$/)
  })

  test('no swipe on desktop', async () => {
    stubMedia({ mobile: false })
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent(/^\/$/)
  })

  test('crossing the mobile breakpoint keeps the page and what was typed', () => {
    const media = stubMedia()
    renderTabs('/progress')
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'half done' } })
    act(() => media.setMobile(false))
    expect(screen.getByLabelText('Note')).toHaveValue('half done')
    act(() => media.setMobile(true))
    expect(screen.getByLabelText('Note')).toHaveValue('half done')
  })

  test.each([['/nope', 'Missing page'], ['/habits', 'Habits page']])('non-tab route %s renders without swipe', async (route, text) => {
    renderTabs(route)
    drag(screen.getByText(text), [300, 400], [100, 400])
    await pause(SETTLE_MS + 50)
    expect(location()).toHaveTextContent(route)
  })

  test('with reduced motion, a committed swipe switches tabs at once with no fade', () => {
    stubMedia({ reduced: true })
    renderTabs('/')
    drag(screen.getByText('Today page'), [300, 400], [100, 400])
    expect(screen.queryByText('Neighbour /tasks')).not.toBeInTheDocument()
    expect(location()).toHaveTextContent('/tasks')
    expect(screen.getByText('Tasks page').closest('[style]')).toBeNull()
  })
})

describe('pull to refresh', () => {
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  test('pulling past the threshold on Today refetches the page', async () => {
    const { refetch } = renderTabs('/')
    drag(screen.getByText('Today page'), [200, 100], [200, 300])
    expect(refetch).toHaveBeenCalledWith({ type: 'active' })
    expect(await screen.findByText('Refreshing')).toBeInTheDocument()
  })

  test('works on Progress too', () => {
    const { refetch } = renderTabs('/progress')
    drag(screen.getByText('Progress page'), [200, 100], [200, 300])
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  test('a short pull does nothing', () => {
    const { refetch } = renderTabs('/')
    drag(screen.getByText('Today page'), [200, 100], [200, 180])
    expect(refetch).not.toHaveBeenCalled()
  })

  test('offline shows “Offline” and sends nothing', async () => {
    onlineManager.setOnline(false)
    const { refetch } = renderTabs('/')
    drag(screen.getByText('Today page'), [200, 100], [200, 300])
    expect(await screen.findByText('Offline')).toBeInTheDocument()
    expect(refetch).not.toHaveBeenCalled()
  })

  test('not on Habits', () => {
    const { refetch } = renderTabs('/habits')
    drag(screen.getByText('Habits page'), [200, 100], [200, 300])
    expect(refetch).not.toHaveBeenCalled()
  })

  test('not when the page is scrolled down', () => {
    vi.stubGlobal('scrollY', 120)
    const { refetch } = renderTabs('/')
    drag(screen.getByText('Today page'), [200, 100], [200, 300])
    expect(refetch).not.toHaveBeenCalled()
  })
})
