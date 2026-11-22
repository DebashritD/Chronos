import type { WeekCell, WeekHabit } from '../../api/types'
import { cellClass, STATE_LABEL } from '../../lib/cells'
import { periodLabel } from '../checkin/period'

interface WeekCellButtonProps {
  habit: WeekHabit
  cell: WeekCell
  isToday: boolean
  /** Size classes, e.g. 'aspect-square' or a fixed height. */
  shape: string
  onPick(habit: WeekHabit, cell: WeekCell): void
}

/** One tappable period cell; today's gets an accent ring, past uneditable ones are dimmed. */
export function WeekCellButton({ habit, cell, isToday, shape, onPick }: WeekCellButtonProps) {
  return (
    <button
      type="button"
      aria-label={`${habit.name}, ${periodLabel(habit, cell)}, ${STATE_LABEL[cell.state]}`}
      aria-current={isToday ? 'date' : undefined}
      disabled={!cell.editable}
      onClick={() => onPick(habit, cell)}
      className={`block w-full rounded-cell ${shape} ${cellClass(cell.state)} ${
        isToday ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : ''
      } ${cell.editable ? 'cursor-pointer transition-transform active:scale-95' : cell.state === 'NOT_DUE' ? '' : 'opacity-50'}`}
    />
  )
}

export default WeekCellButton
