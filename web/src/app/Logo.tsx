/** The conic-gradient tile; `md` adds the "Chronos" wordmark (sidebar), `lg` is the tile alone (auth pages). */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  if (size === 'lg') {
    return <span className="logo-tile block h-14 w-14 rounded-[18px]" aria-hidden="true" />
  }
  return (
    <span className="flex items-center gap-2.5">
      <span className="logo-tile block h-8 w-8 rounded-[10px]" aria-hidden="true" />
      <span className="text-[17px] font-bold tracking-tight text-fg">Chronos</span>
    </span>
  )
}

export default Logo
