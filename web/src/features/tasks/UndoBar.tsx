import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export const UNDO_MS = 5000

export function UndoBar({ text, onUndo, onDone }: { text: string; onUndo(): void; onDone(): void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, UNDO_MS)
    return () => clearTimeout(timer)
  }, [onDone])
  return createPortal(
    <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-5 md:bottom-8">
      <div role="status" className="flex max-w-sm items-center gap-4 rounded-[10px] bg-ink py-1 pr-1 pl-4 text-[14px] text-paper shadow-[0_8px_24px_rgb(29_27_24/0.3)]">
        <span className="truncate">{text}</span>
        <button type="button" onClick={onUndo} className="min-h-11 rounded-[8px] px-3 font-semibold underline underline-offset-4">Undo</button>
      </div>
    </div>,
    document.body,
  )
}
