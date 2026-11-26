import { BottomSheet } from '../../app/BottomSheet'
import { useCreateHabit } from './api'
import { HabitForm } from './HabitForm'

export function NewHabitSheet({ onClose }: { onClose(): void }) {
  const createHabit = useCreateHabit()
  return (
    <BottomSheet title="New habit" onClose={onClose}>
      <HabitForm bare submitLabel="Create habit" onCancel={onClose}
        onSubmit={async (values) => {
          await createHabit.mutateAsync(values)
          onClose()
        }} />
    </BottomSheet>
  )
}
