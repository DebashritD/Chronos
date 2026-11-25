/** App icon plus the serif "No Reds" wordmark; the wordmark takes the surrounding text colour. */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const large = size === 'lg'
  return (
    <span className="flex items-center gap-3">
      <img src="/favicon.svg" alt="" className={`block flex-none ${large ? 'h-12 w-12 rounded-[12px]' : 'h-7 w-7 rounded-[7px]'}`} />
      <span className={`font-display leading-none ${large ? 'text-[28px]' : 'text-[19px]'}`}>No Reds</span>
    </span>
  )
}

export default Logo
