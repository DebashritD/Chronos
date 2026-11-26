import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'

export function AddTask({ onAdd }: { onAdd(text: string, later: boolean): void }) {
  const [text, setText] = useState('')
  const [later, setLater] = useState(false)
  const [focused, setFocused] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const chip = (on: boolean) => `inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-[14px] font-semibold ${
    on ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink'}`

  return (
    <form className="border-b border-rule-2" onSubmit={(e) => {
      e.preventDefault()
      const value = text.trim()
      if (value === '') return
      onAdd(value.slice(0, 200), later)
      setText('')
      input.current?.focus()
    }}>
      <div className="flex min-h-14 items-center gap-3">
        <Plus size={20} strokeWidth={1.8} aria-hidden="true" className="flex-none text-muted" />
        <input ref={input} aria-label="Add a task" placeholder="Add a task" value={text} maxLength={200} enterKeyHint="done"
          onChange={(e) => setText(e.target.value)} onFocus={() => setFocused(true)}
          onBlur={(e) => { if (!e.currentTarget.form?.contains(e.relatedTarget)) setFocused(false) }}
          className="min-w-0 flex-1 border-0 bg-transparent py-3 text-[17px] text-ink placeholder:text-muted focus:outline-none" />
      </div>
      {(focused || text !== '') && (
        <div className="flex gap-2 pb-3 pl-8">
          <button type="button" aria-pressed={!later} onClick={() => { setLater(false); input.current?.focus() }} className={chip(!later)}>Today</button>
          <button type="button" aria-pressed={later} onClick={() => { setLater(true); input.current?.focus() }} className={chip(later)}>Later</button>
        </div>
      )}
    </form>
  )
}
