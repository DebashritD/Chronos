/** Shared Tailwind class strings for the calendar pad (tokens in index.css). No cards: sections are ruled. */
export const eyebrow = 'text-[11px] font-semibold tracking-[0.22em] text-accent uppercase'
export const pageTitle = 'font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-ink'
export const meta = 'font-mono text-[12px] text-muted'
/** A ruled section below the previous one. */
export const section = 'mt-7 border-t border-rule-2 pt-5'
export const underlineInput =
  'w-full rounded-none border-0 border-b border-rule-2 bg-transparent px-0 py-2.5 text-[16px] text-ink placeholder:text-muted focus:border-ink focus:outline-none'
export const inkButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-ink px-5 text-[15px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-50'
export const outlineButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-ink px-5 text-[15px] font-medium text-ink disabled:opacity-50'
export const textButton =
  'inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-ink underline decoration-rule-2 decoration-2 underline-offset-[6px] hover:decoration-ink disabled:opacity-50'
export const iconButton =
  'flex h-11 w-11 flex-none items-center justify-center rounded-full text-ink transition-colors hover:bg-paper-2 active:bg-paper-2 disabled:opacity-40'

/** @deprecated Removed in Task 10; use the helpers above. */
export const card = 'border-t border-rule-2 py-5'
/** @deprecated */
export const chip = 'inline-flex items-center gap-1.5 font-mono text-[12px]'
/** @deprecated */
export const cardTitle = `mb-3 block ${eyebrow}`
/** @deprecated */
export const inputClass = underlineInput
/** @deprecated */
export const primaryButton = inkButton
/** @deprecated */
export const secondaryButton = outlineButton
/** @deprecated */
export const pillButton = textButton
/** @deprecated */
export const emptyAction = inkButton
