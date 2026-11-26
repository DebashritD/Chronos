import { describe, expect, it } from 'vitest'
import type { Task } from '../../api/types'
import { carriedText, openTodayCount, splitTasks } from './taskDates'

const t = (id: string, over: Partial<Task>): Task => ({ id, text: id, scheduledOn: '2026-11-18', doneOn: null, createdAt: `2026-11-18T0${id.length}:00:00Z`, ...over })

describe('taskDates', () => {
  it('splits open (oldest day first), done today, and Later (newest first)', () => {
    const tasks = [
      t('a', {}), t('bb', { scheduledOn: '2026-11-15' }), t('ccc', { doneOn: '2026-11-18' }),
      t('dddd', { doneOn: '2026-11-17' }), t('e', { scheduledOn: null, createdAt: '2026-11-10T00:00:00Z' }),
      t('f', { scheduledOn: null, createdAt: '2026-11-12T00:00:00Z' }), t('g', { scheduledOn: null, doneOn: '2026-11-18', createdAt: '2026-11-18T09:00:00Z' }),
    ]
    const { open, done, later } = splitTasks(tasks, '2026-11-18')
    expect(open.map((x) => x.id)).toEqual(['bb', 'a'])
    expect(done.map((x) => x.id)).toEqual(['ccc', 'g'])
    expect(later.map((x) => x.id)).toEqual(['f', 'e'])
  })

  it('names the carry-over age', () => {
    expect(carriedText('2026-11-18', '2026-11-18')).toBeNull()
    expect(carriedText('2026-11-17', '2026-11-18')).toBe('carried 1 day')
    expect(carriedText('2026-11-15', '2026-11-18')).toBe('carried 3 days')
  })

  it('counts open tasks on Today only', () => {
    expect(openTodayCount([t('a', {}), t('b', { scheduledOn: null }), t('c', { doneOn: '2026-11-18' })], '2026-11-18')).toBe(1)
    expect(openTodayCount(undefined, '2026-11-18')).toBe(0)
  })
})
