import { DEFAULT_CONFIG } from '../analytics/config'
import type { Scenario } from '../analytics/scenarios'
export interface ScenarioControls {
  demand: number; capacity: number; rate: number;
  maxDeadhead: number; minReliability: number; commercialFloor: number;
  overrideEnabled: boolean; lane: string; equipment: string;
  overrideDemand: number; overrideCapacity: number; overrideRate: number;
}
export const initialControls = (lane: string, equipment: string): ScenarioControls => ({
  demand: 0, capacity: 0, rate: 0, maxDeadhead: DEFAULT_CONFIG.MAX_DEADHEAD_KM,
  minReliability: DEFAULT_CONFIG.MIN_RELIABILITY * 100, commercialFloor: DEFAULT_CONFIG.COMMERCIAL_FLOOR * 100,
  overrideEnabled: false, lane, equipment, overrideDemand: 0, overrideCapacity: 0, overrideRate: 0,
})
// Convert display units only. All scenario calculations remain in runScenario().
export function toScenario(c: ScenarioControls): Scenario {
  return {
    demand: c.demand / 100, capacity: c.capacity / 100, rate: c.rate / 100,
    thresholds: { MAX_DEADHEAD_KM: c.maxDeadhead, MIN_RELIABILITY: c.minReliability / 100, COMMERCIAL_FLOOR: c.commercialFloor / 100 },
    ...(c.overrideEnabled ? { lane: { lane: c.lane, equipment_type: c.equipment, demand: c.overrideDemand / 100, capacity: c.overrideCapacity / 100, rate: c.overrideRate / 100 } } : {}),
  }
}
