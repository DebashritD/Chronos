import { afterEach, describe, expect, test } from 'vitest'
import {
  dragOffset, ignoreStart, lockFor, pullDistance, releaseDecision, startsOnControl, velocityOf,
} from './useTabSwipe'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('lockFor', () => {
  test('waits for 10px of movement', () => {
    expect(lockFor(6, 6)).toBeNull()
  })
  test('locks horizontal when sideways movement wins', () => {
    expect(lockFor(-12, 4)).toBe('horizontal')
  })
  test('locks vertical when vertical movement wins or ties', () => {
    expect(lockFor(3, 12)).toBe('vertical')
    expect(lockFor(8, -8)).toBe('vertical')
  })
})

describe('dragOffset', () => {
  test('follows the finger between tabs', () => {
    expect(dragOffset(-90, 1, 4)).toBe(-90)
    expect(dragOffset(90, 1, 4)).toBe(90)
  })
  test('rubber-bands past the first and last tab', () => {
    expect(dragOffset(90, 0, 4)).toBe(30)
    expect(dragOffset(-90, 3, 4)).toBe(-30)
  })
})

describe('releaseDecision', () => {
  test('commits past 35% of the width', () => {
    expect(releaseDecision(-140, 0, 390, 0, 4)).toBe('next')
    expect(releaseDecision(140, 0, 390, 2, 4)).toBe('prev')
  })
  test('commits on a fast flick in the drag direction', () => {
    expect(releaseDecision(-40, -0.5, 390, 0, 4)).toBe('next')
  })
  test('cancels a short slow drag or a flick against the drag', () => {
    expect(releaseDecision(-100, -0.2, 390, 0, 4)).toBe('cancel')
    expect(releaseDecision(-40, 0.9, 390, 0, 4)).toBe('cancel')
  })
  test('cancels when there is no tab that way', () => {
    expect(releaseDecision(300, 2, 390, 0, 4)).toBe('cancel')
    expect(releaseDecision(-300, -2, 390, 3, 4)).toBe('cancel')
    expect(releaseDecision(0, 0, 390, 1, 4)).toBe('cancel')
  })
})

test('pullDistance halves the pull and caps it at 96px', () => {
  expect(pullDistance(100)).toBe(50)
  expect(pullDistance(-40)).toBe(0)
  expect(pullDistance(400)).toBe(96)
})

describe('ignoreStart', () => {
  test('ignores touches in the 16px edge zones', () => {
    expect(ignoreStart(document.body, 10, 390)).toBe(true)
    expect(ignoreStart(document.body, 380, 390)).toBe(true)
    expect(ignoreStart(document.body, 200, 390)).toBe(false)
  })
  test('ignores touches on form controls and editable text', () => {
    document.body.innerHTML = '<label><span id="s">x</span><input id="i" type="range"></label><div contenteditable="true"><b id="b">y</b></div>'
    expect(ignoreStart(document.getElementById('i'), 200, 390)).toBe(true)
    expect(ignoreStart(document.getElementById('b'), 200, 390)).toBe(true)
    expect(ignoreStart(document.getElementById('s'), 200, 390)).toBe(false)
    expect(startsOnControl(document.getElementById('i'))).toBe(true)
  })
  test('ignores every touch while a modal dialog is open', () => {
    document.body.innerHTML = '<p id="p">x</p><div aria-modal="true"></div>'
    expect(ignoreStart(document.getElementById('p'), 200, 390)).toBe(true)
  })
})

describe('velocityOf', () => {
  test('is the speed between the last two samples', () => {
    expect(velocityOf({ x: 0, y: 0, t: 0 }, { x: -30, y: 10, t: 50 }, 'x', 50)).toBeCloseTo(-0.6)
    expect(velocityOf({ x: 0, y: 0, t: 0 }, { x: -30, y: 10, t: 50 }, 'y', 50)).toBeCloseTo(0.2)
  })
  test('is 0 when the finger paused for over 100ms before lifting', () => {
    expect(velocityOf({ x: 0, y: 0, t: 0 }, { x: -30, y: 0, t: 50 }, 'x', 200)).toBe(0)
  })
  test('is 0 when the samples share a timestamp', () => {
    expect(velocityOf({ x: 0, y: 0, t: 5 }, { x: -30, y: 0, t: 5 }, 'x', 5)).toBe(0)
  })
})
