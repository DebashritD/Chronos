import { Mark } from '../../app/Mark'

/** The rubber stamp on a marked row; `pressed` plays the stamp-press once (none under reduced motion). */
export function Stamp({ color, pressed, onDone }: { color: 'GREEN' | 'YELLOW'; pressed: boolean; onDone(): void }) {
  const green = color === 'GREEN'
  return (
    <span aria-hidden="true" data-stamp={pressed ? '' : undefined} onAnimationEnd={onDone}
      className={`stamp inline-flex flex-none items-center gap-2 px-2.5 py-1.5 font-mono text-[13px] font-medium tracking-[0.14em] data-stamp:animate-stamp ${
        green ? '-rotate-[7deg] text-cell-green' : 'rotate-[5deg] text-yellow-ink'
      }`}>
      <Mark kind={color} size={11} />
      {green ? 'TARGET' : 'MINIMUM'}
    </span>
  )
}

export default Stamp
