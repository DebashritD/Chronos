import type { ReactNode } from 'react'
import { eyebrow, inkButton } from '../../lib/ui'

export const lede = 'mt-3 text-[15px] leading-normal text-muted'
export const explainBox = 'mt-5 rounded-[10px] bg-paper-2 px-4 py-3.5 text-[14px] leading-normal text-ink'
export const fieldLabel = 'text-[11px] font-semibold tracking-[0.22em] text-muted uppercase'
export const footNote = 'text-center font-mono text-[11px] text-muted'

/** A screen's opening: accent label and a heading that takes focus when the screen changes. */
export function StepHeading({ label, children, small = false }: { label: ReactNode; children: ReactNode; small?: boolean }) {
  return (
    <>
      <p className={eyebrow}>{label}</p>
      <h1 tabIndex={-1} className={`mt-2 font-display leading-[1.05] tracking-[-0.01em] text-ink outline-none! ${small ? 'text-[30px]' : 'text-[34px]'}`}>
        {children}
      </h1>
    </>
  )
}

/** Accent "→ …" guidance for the try-it screens; announced as it changes. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mt-4 mb-2 flex min-h-10 gap-2 text-[13.5px] leading-snug font-semibold text-accent">
      <span aria-hidden="true">→</span>
      <span>{children}</span>
    </p>
  )
}

/** The screen's main action, pinned to the bottom of the sheet. */
export function StepFooter({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="mt-auto flex flex-col gap-2 pt-6">
      {children}
      {note && <p className={footNote}>{note}</p>}
    </div>
  )
}

export const primaryButton = `${inkButton} min-h-12 w-full`
