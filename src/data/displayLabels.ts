import { normalizeKey, normalizeLane } from './mapping.js'
export interface DisplayLabels { lanes: Record<string, string>; equipment: Record<string, string> }
export const emptyDisplayLabels = (): DisplayLabels => ({ lanes: Object.create(null), equipment: Object.create(null) })
export function rememberDisplayLabels(labels: DisplayLabels, lane: string, equipment: string) {
  // First valid source row wins; canonical keys and CSV records remain separate.
  if (lane) { const key = normalizeLane(lane); if (!Object.hasOwn(labels.lanes, key)) labels.lanes[key] = lane.trim().replace(/\s*(?:→|->)\s*/g, ' → ') }
  if (equipment) { const key = normalizeKey(equipment); if (!Object.hasOwn(labels.equipment, key)) labels.equipment[key] = equipment.trim() }
}
export const displayLane = (labels: DisplayLabels, key: string) => Object.hasOwn(labels.lanes, normalizeLane(key)) ? labels.lanes[normalizeLane(key)] : key
export const displayEquipment = (labels: DisplayLabels, key: string) => Object.hasOwn(labels.equipment, normalizeKey(key)) ? labels.equipment[normalizeKey(key)] : key
