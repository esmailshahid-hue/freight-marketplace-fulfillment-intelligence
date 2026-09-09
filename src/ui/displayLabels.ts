import { createContext, useContext } from 'react'
import { displayLane, displayEquipment, emptyDisplayLabels } from '../data/displayLabels'
export const DisplayLabelContext = createContext(emptyDisplayLabels())
export function useDisplayLabels() {
  const labels = useContext(DisplayLabelContext)
  return { labels, laneLabel: (key: string) => displayLane(labels, key), equipmentLabel: (key: string) => displayEquipment(labels, key) }
}
