import { createContext, useContext } from 'react'

/** True inside the neighbour page drawn beside the current tab during a swipe. */
export const NeighbourContext = createContext(false)

export function useIsNeighbour(): boolean {
  return useContext(NeighbourContext)
}
