import { fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { drag, pause, stubMedia, useFakeSwipeClock } from '../../test/touch'
import { SHEET_SETTLE_MS, shouldCloseSheet, useSheetDrag } from './useSheetDrag'

describe('shouldCloseSheet', () => {
  test('closes past 30% of the sheet height', () => {
    expect(shouldCloseSheet(130, 0, 400)).toBe(true)
    expect(shouldCloseSheet(110, 0, 400)).toBe(false)
  })
  test('closes on a fast downward flick', () => {
    expect(shouldCloseSheet(30, 0.5, 400)).toBe(true)
    expect(shouldCloseSheet(30, -0.5, 400)).toBe(false)
  })
})

function Sheet({ onClose, enabled = true, reduced = false }: { onClose(): void; enabled?: boolean; reduced?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useSheetDrag(ref, { enabled, reduced, onClose })
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <p>Sheet body</p>
      <textarea aria-label="Note" />
    </div>
  )
}

describe('useSheetDrag', () => {
  beforeEach(() => {
    stubMedia()
    useFakeSwipeClock()
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('a long downward drag closes the sheet after it slides away', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    drag(screen.getByText('Sheet body'), [200, 500], [200, 700])
    expect(onClose).not.toHaveBeenCalled()
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('with reduced motion it closes at once', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} reduced />)
    drag(screen.getByText('Sheet body'), [200, 500], [200, 700])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['a short slow drag', [200, 500], [200, 560]],
    ['an upward drag', [200, 500], [200, 300]],
    ['a sideways drag', [100, 500], [300, 520]],
  ] as const)('%s keeps it open', async (_name, from, to) => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    drag(screen.getByText('Sheet body'), [...from], [...to])
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).not.toHaveBeenCalled()
  })

  test('a drag starting in the note field keeps it open', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    drag(screen.getByLabelText('Note'), [200, 500], [200, 700])
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).not.toHaveBeenCalled()
  })

  test('disabled on desktop', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} enabled={false} />)
    drag(screen.getByText('Sheet body'), [200, 500], [200, 700])
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).not.toHaveBeenCalled()
  })

  test('a second finger mid-drag snaps the sheet back and keeps it open', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    const body = screen.getByText('Sheet body')
    const sheet = screen.getByRole('dialog')
    fireEvent.touchStart(body, { touches: [{ clientX: 200, clientY: 500 }] })
    fireEvent.touchMove(body, { touches: [{ clientX: 200, clientY: 560 }] })
    expect(sheet.style.transform).toBe('translateY(60px)')
    fireEvent.touchStart(body, { touches: [{ clientX: 200, clientY: 560 }, { clientX: 250, clientY: 600 }] })
    expect(sheet.style.transform).toBe('')
    await pause(SHEET_SETTLE_MS + 50)
    expect(onClose).not.toHaveBeenCalled()
  })
})
