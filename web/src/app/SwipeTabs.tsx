import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import { NeighbourContext } from './neighbour'
import { PullToRefresh, type PullToRefreshHandle } from './PullToRefresh'
import { renderTabPage } from './tabPages'
import { TABS, tabIndex } from './tabs'
import { dragOffset, releaseDecision, useTabSwipe } from './useTabSwipe'

export const SETTLE_MS = 250
const PULL_PATHS = new Set(['/', '/progress'])

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
  const pullRef = useRef<PullToRefreshHandle>(null)
  const pulls = enabled && PULL_PATHS.has(pathname)
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
      window.clearTimeout(snapTimer.current)
      const to = TABS[index + (decision === 'next' ? 1 : -1)].to
      // Reduced motion switches at once; the global reduced-motion CSS would turn any fade into a blank pause.
      if (reduced) {
        scrollOnArrive.current = true
        navigate(to)
        return
      }
      settling.current = true
      moveTrack(decision === 'next' ? -window.innerWidth : window.innerWidth, SETTLE_MS)
      commitTimer.current = window.setTimeout(() => {
        commitTimer.current = undefined
        scrollOnArrive.current = true
        setNeighbour(null)
        navigate(to)
      }, SETTLE_MS)
    },
    onPull: pulls ? (dy) => pullRef.current?.move(dy) : undefined,
    onPullEnd: pulls ? (dy) => pullRef.current?.release(dy) : undefined,
  })

  // One wrapper structure in every mode, so crossing the breakpoint never remounts the page.
  // On desktop the wrappers are `display: contents` and leave the layout alone.
  const peer = enabled && neighbour && neighbour.from === pathname ? neighbour : null
  return (
    <>
      <div className="max-md:flex max-md:flex-1 max-md:flex-col max-md:overflow-x-clip md:contents">
        <div ref={trackRef} className="relative max-md:flex-1 md:contents">
          <Outlet />
          {peer && (
            <div aria-hidden="true" inert className="absolute w-full"
              style={{ top: peer.top, left: peer.dir * window.innerWidth }}>
              <NeighbourContext value={true}>{renderTabPage(TABS[index + peer.dir].to)}</NeighbourContext>
            </div>
          )}
        </div>
      </div>
      {pulls && <PullToRefresh ref={pullRef} />}
    </>
  )
}

export default SwipeTabs
