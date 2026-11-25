import type { ReactNode } from 'react'
import type { WeekCell, WeekHabit } from '../../api/types'
import { STATE_LABEL } from '../../lib/cells'
import { periodLabel } from '../checkin/period'

interface WeekCellButtonProps {
  habit: WeekHabit
  cell: WeekCell
  isToday: boolean
  onPick(habit: WeekHabit, cell: WeekCell): void
  children: ReactNode
}

/** One tappable period: a transparent 44px-tall hit area over its mark. Past uneditable periods can't be tapped. */
export function WeekCellButton({ habit, cell, isToday, onPick, children }: WeekCellButtonProps) {
  return (
    <button type="button" aria-label={`${habit.name}, ${periodLabel(habit, cell)}, ${STATE_LABEL[cell.state]}`}
      aria-current={isToday ? 'date' : undefined} disabled={!cell.editable} onClick={() => onPick(habit, cell)}
      className={`relative z-10 flex h-11 w-full items-center justify-center rounded-full ${cell.editable ? 'cursor-pointer active:bg-paper-2' : ''}`}>
      {children}
    </button>
  )
}

export default WeekCellButton
