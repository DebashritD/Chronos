import { useState } from 'react'
import type { Color } from '../../api/types'
import { BottomSheet } from '../../app/BottomSheet'
import { Mark } from '../../app/Mark'
import { STATE_LABEL } from '../../lib/cells'
import { hapticMark } from '../../lib/haptics'
import { inkButton, textButton, underlineInput } from '../../lib/ui'
import { Stamp } from '../today/Stamp'
import { explainBox, Hint, primaryButton, StepFooter, StepHeading } from './ui'

const BUTTONS: { color: Color; label: string }[] = [
  { color: 'GREEN', label: 'Target' },
  { color: 'YELLOW', label: 'Minimum' },
  { color: 'RED', label: 'Missed' },
]
const CHOICE_HINT: Record<Color, string> = { GREEN: '20 pages', YELLOW: '5 pages', RED: 'Didn’t do it' }
const HINTS = [
  'Tap Target, Minimum or Missed below.',
  'Nice. Now tap the row to open it. You can change the mark or add a note there.',
  'That’s it: tap to mark, tap again to change. Next when you’re ready.',
]
const EXPLAIN: Record<Color, [string, string]> = {
  GREEN: ['Target.', 'The full thing. The row folds into a stamp so done habits are easy to spot.'],
  YELLOW: ['Minimum.', 'A busy day, but you showed up. It still counts, and the streak keeps going.'],
  RED: ['Missed.', 'It happens. The streak starts over, so this is the one to avoid. The row stays open so you can change it.'],
}
const name = 'font-display text-[23px] leading-tight break-words text-ink'

/** Today's habit row with local state only: the same marks, stamp and picker, nothing saved. */
export function PracticeStep({ onNext }: { onNext(): void }) {
  const [mark, setMark] = useState<Color | null>(null)
  const [touched, setTouched] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(0)
  const [today] = useState(() => new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))
  const stamped = mark === 'GREEN' || mark === 'YELLOW'

  function choose(color: Color | null): void {
    if (color) hapticMark(color)
    setMark(color)
    setPressed(color === 'GREEN' || color === 'YELLOW')
    setTouched(true)
    setHint((h) => Math.max(h, 1))
  }

  function openPicker(): void {
    setDraft(note)
    setNoteOpen(Boolean(note))
    setHint(2)
    setOpen(true)
  }

  const streak = (
    <p className="mt-1 font-mono text-[12px] text-muted">
      {stamped ? <><b className="font-medium text-ink">1</b> day unbroken</> : 'Fresh start'}
    </p>
  )
  const notePreview = note && <p className="mt-1 truncate text-[12px] text-muted">✎ {note}</p>
  const [title, body] = mark ? EXPLAIN[mark] : [null, touched ? 'Cleared. The day is open again.' : 'Each tap saves straight away. You can change it until the day ends.']

  return (
    <>
      <StepHeading label="Try it">Marking is one tap.</StepHeading>
      <p className="mt-3 text-[15px] text-muted">This is how a habit looks on Today. Try it.</p>
      <Hint>{HINTS[hint]}</Hint>
      <div className="border-t border-rule">
        {stamped ? (
          <article aria-label="Read" className="relative flex items-center gap-4 border-b border-rule py-4">
            <div className="min-w-0 flex-1">
              <h2 className={name}>
                <button type="button" aria-haspopup="dialog" onClick={openPicker} className="text-left after:absolute after:inset-0">Read</button>
              </h2>
              <p className="sr-only">{STATE_LABEL[mark]}</p>
              {streak}
              {notePreview}
            </div>
            <Stamp color={mark} pressed={pressed} onDone={() => setPressed(false)} />
          </article>
        ) : (
          <article aria-label="Read" className="border-b border-rule py-4">
            <h2 className={name}>
              <button type="button" aria-haspopup="dialog" onClick={openPicker}
                className="text-left decoration-rule-2 underline-offset-4 hover:underline">Read</button>
            </h2>
            {streak}
            <div className="mt-2 grid grid-cols-3">
              {BUTTONS.map(({ color, label }, i) => (
                <button key={color} type="button" aria-pressed={mark === color}
                  onClick={() => mark !== color && choose(color)}
                  className={`flex min-h-11 items-center justify-center gap-2 px-1 py-1.5 text-[14px] font-medium text-ink transition-colors active:bg-paper-2 ${
                    i > 0 ? 'border-l border-dashed border-faint' : ''
                  } ${mark === color ? 'bg-paper-2' : ''}`}>
                  <Mark kind={color} size={12} />
                  {label}
                </button>
              ))}
            </div>
            {mark === 'RED' && <p className="mt-2 font-mono text-[12px] text-muted">That's honest. Tomorrow is a fresh start.</p>}
            {mark === 'RED' && notePreview}
          </article>
        )}
      </div>
      <p className={explainBox} aria-live="polite">{title && <b>{title} </b>}{body}</p>
      <StepFooter note="practice only · nothing is saved">
        <button type="button" disabled={!touched} className={primaryButton} onClick={onNext}>Next</button>
      </StepFooter>
      {open && (
        <BottomSheet title="Read" onClose={() => setOpen(false)}>
          <p className="-mt-4 font-mono text-[12px] text-muted">
            Today · {today}
          </p>
          {streak}
          <div className="mt-2 border-t border-rule">
            {BUTTONS.map(({ color }) => (
              <button key={color} type="button" aria-pressed={mark === color}
                onClick={() => {
                  if (noteOpen) setNote(draft.trim())
                  choose(color)
                  setOpen(false)
                }}
                className={`flex min-h-14 w-full items-center gap-3 border-b border-rule px-1 py-3 text-left ${mark === color ? 'bg-paper-2' : ''}`}>
                <Mark kind={color} size={18} />
                <span className="min-w-0 flex-1 text-[16px] font-semibold text-ink">
                  {STATE_LABEL[color]}
                  <small className="block font-mono text-[12px] font-normal text-muted">{CHOICE_HINT[color]}</small>
                </span>
                {mark === color && <span aria-hidden="true" className="font-mono text-[11px] tracking-[0.14em] text-muted">SAVED</span>}
              </button>
            ))}
          </div>
          {noteOpen ? (
            <>
              <label htmlFor="practice-note" className="mt-4 mb-1.5 block text-[13px] font-medium text-muted">Note (optional)</label>
              <textarea id="practice-note" rows={2} maxLength={500} value={draft} autoFocus
                onChange={(e) => setDraft(e.target.value)} className={underlineInput} />
            </>
          ) : (
            <button type="button" onClick={() => setNoteOpen(true)} className={`${textButton} mt-2`}>+ Add note</button>
          )}
          {mark && (
            <div className="mt-5 flex items-center gap-2">
              <button type="button" className={`${textButton} text-cell-red!`}
                onClick={() => {
                  setNote('')
                  choose(null)
                  setOpen(false)
                }}>Clear</button>
              {draft.trim() !== note && (
                <button type="button" className={`${inkButton} ml-auto`}
                  onClick={() => {
                    setNote(draft.trim())
                    setOpen(false)
                  }}>Save note</button>
              )}
            </div>
          )}
        </BottomSheet>
      )}
    </>
  )
}
