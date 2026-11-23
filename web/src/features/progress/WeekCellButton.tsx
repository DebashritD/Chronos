import type { WeekCell, WeekHabit } from '../../api/types'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { periodLabel } from '../checkin/period'

interface WeekCellButtonProps {
  habit: WeekHabit
  cell: WeekCell
  isToday: boolean
  /** Size classes, e.g. 'aspect-square' or a fixed height. */
  shape: string
  /** Draw the state as a thin pill centred in a transparent button instead of filling it. */
  pill?: boolean
  onPick(habit: WeekHabit, cell: WeekCell): void
}

/** One tappable period cell; past uneditable ones are dimmed. Today is marked in the day strip, not on each cell. */
export function WeekCellButton({ habit, cell, isToday, shape, pill = false, onPick }: WeekCellButtonProps) {
  const fill = cellClass(cell.state)
  return (
    <button
      type="button"
      aria-label={`${habit.name}, ${periodLabel(habit, cell)}, ${STATE_LABEL[cell.state]}`}
      aria-current={isToday ? 'date' : undefined}
      disabled={!cell.editable}
      onClick={() => onPick(habit, cell)}
      className={`block w-full ${shape} ${pill ? 'flex items-center' : `rounded-cell ${fill}`} ${cell.editable ? 'cursor-pointer transition-transform active:scale-95' : cell.state === 'NOT_DUE' ? '' : 'opacity-50'}`}
    >
      {pill && <span aria-hidden="true" data-pill="" className={`block h-2 w-full rounded-full ${fill}`} />}
    </button>
  )
}

export default WeekCellButton
