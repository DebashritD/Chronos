import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { renderTabPage } from './tabPages'
import { TABS, tabIndex } from './tabs'
import { dragOffset, releaseDecision, useTabSwipe } from './useTabSwipe'

export const SETTLE_MS = 250
export const FADE_MS = 150

interface Neighbour { from: string; dir: 1 | -1; top: number }

/** Mobile tab swipe: the routed page follows the finger and the next tab peeks in beside it. */
export function SwipeTabs() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mobile = useMediaQuery(MOBILE_QUERY)
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY)
  const index = tabIndex(pathname)
  const enabled = mobile && index >= 0
  const trackRef = useRef<HTMLDivElement>(null)
  const [neighbour, setNeighbour] = useState<Neighbour | null>(null)
  const settling = useRef(false)
  const snapTimer = useRef<number | undefined>(undefined)
  const commitTimer = useRef<number | undefined>(undefined)
  const scrollOnArrive = useRef(false)

  // A committed swipe lands here: reset the track before the new page paints.
  // Any other route change (a tab tap mid-settle) cancels the pending swipe.
  useLayoutEffect(() => {
    if (commitTimer.current !== undefined) {
      window.clearTimeout(commitTimer.current)
      commitTimer.current = undefined
      setNeighbour(null)
    }
    const track = trackRef.current
    if (track) {
      track.style.transition = ''
      track.style.transform = ''
      track.style.opacity = ''
    }
    settling.current = false
    if (scrollOnArrive.current) {
      scrollOnArrive.current = false
      window.scrollTo(0, 0)
    }
  }, [pathname])

  useEffect(() => () => {
    window.clearTimeout(snapTimer.current)
    window.clearTimeout(commitTimer.current)
  }, [])

  function moveTrack(x: number, ms = 0): void {
    const track = trackRef.current
    if (!track) return
    track.style.transition = ms ? `transform ${ms}ms ease-out` : ''
    track.style.transform = x ? `translateX(${x}px)` : ''
  }

  useTabSwipe(trackRef, enabled, {
    onDrag(dx) {
      if (settling.current || reduced) return
      window.clearTimeout(snapTimer.current)
      const dir = dx < 0 ? 1 : -1
      const target = index + dir
      const shown = neighbour !== null && neighbour.from === pathname && neighbour.dir === dir
      if (!shown && target >= 0 && target < TABS.length && trackRef.current) {
        const trackTop = trackRef.current.getBoundingClientRect().top + window.scrollY
        setNeighbour({ from: pathname, dir, top: Math.max(0, window.scrollY - trackTop) })
      }
      moveTrack(dragOffset(dx, index, TABS.length))
    },
    onRelease(dx, velocity) {
      if (settling.current) return
      const decision = releaseDecision(dx, velocity, window.innerWidth, index, TABS.length)
      if (decision === 'cancel') {
        moveTrack(0, reduced ? 0 : SETTLE_MS)
        snapTimer.current = window.setTimeout(() => setNeighbour(null), SETTLE_MS)
        return
      }
      settling.current = true
      window.clearTimeout(snapTimer.current)
      const to = TABS[index + (decision === 'next' ? 1 : -1)].to
      const track = trackRef.current
      if (reduced && track) {
        track.style.transition = `opacity ${FADE_MS}ms ease-out`
        track.style.opacity = '0'
      } else {
        moveTrack(decision === 'next' ? -window.innerWidth : window.innerWidth, SETTLE_MS)
      }
      commitTimer.current = window.setTimeout(() => {
        commitTimer.current = undefined
        scrollOnArrive.current = true
        setNeighbour(null)
        navigate(to)
      }, reduced ? FADE_MS : SETTLE_MS)
    },
  })

  if (!enabled) return <Outlet />

  const peer = neighbour && neighbour.from === pathname ? neighbour : null
  return (
    <div className="overflow-x-clip">
      <div ref={trackRef} className="relative">
        <Outlet />
        {peer && (
          <div aria-hidden="true" inert className="absolute w-full"
            style={{ top: peer.top, left: peer.dir * window.innerWidth }}>
            {renderTabPage(TABS[index + peer.dir].to)}
          </div>
        )}
      </div>
    </div>
  )
}

export default SwipeTabs
