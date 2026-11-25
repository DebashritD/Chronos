import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSheetDrag } from '../features/checkin/useSheetDrag'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../lib/useMediaQuery'

interface BottomSheetProps {
  title: string
  onClose(): void
  children: ReactNode
}

/**
 * Bottom sheet on phones (drag down to close), centred dialog on wider screens. Rendered on the body so a
 * swiping track's transform can't move it. Focus goes to the first field (or the sheet) and back to the opener on close.
 */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const mobile = useMediaQuery(MOBILE_QUERY)
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY)
  useSheetDrag(sheetRef, { enabled: mobile, reduced, onClose })

  useEffect(() => {
    const opener = document.activeElement
    const sheet = sheetRef.current
    const field = sheet?.querySelector<HTMLElement>('input, select, textarea')
    ;(field ?? sheet)?.focus({ preventScroll: true })
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-binding/45 md:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <div ref={sheetRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label={title}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className="perforated max-h-[90dvh] w-full overflow-y-auto overscroll-contain bg-paper px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none md:max-w-md md:rounded-[12px] md:pt-7">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-rule-2 md:hidden" aria-hidden="true" />
        <h2 className="mb-4 font-serif text-[30px] leading-tight text-ink">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default BottomSheet
