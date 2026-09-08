import type { Datasets } from '../data/schemas'
import type { Config } from './config'
import { analyze } from './engine'
import { normalizeKey, normalizeLane } from '../data/mapping'
import { DEFAULT_TIME_ZONE } from '../utils/dates'
interface Adjustments { demand?: number; capacity?: number; rate?: number }
export interface Scenario extends Adjustments { thresholds?: Partial<Config>; lane?: Adjustments & { lane: string; equipment_type: string } }
export function runScenario(data: Datasets, asOf: string, scenario: Scenario, config: Partial<Config> = {}, timeZone = DEFAULT_TIME_ZONE) {
  const matches = (r: { lane: string; equipment_type: string }) => scenario.lane && normalizeLane(r.lane) === normalizeLane(scenario.lane.lane) && normalizeKey(r.equipment_type) === normalizeKey(scenario.lane.equipment_type)
  const multiplier = (r: { lane: string; equipment_type: string }, field: keyof Adjustments) => Math.max(0, 1 + (scenario[field] ?? 0)) * Math.max(0, 1 + (matches(r) ? scenario.lane?.[field] ?? 0 : 0))
  const adjusted: Datasets = { ...data, upcoming: data.upcoming.map(r => ({ ...r, load_count: r.load_count * multiplier(r, 'demand'), planned_buy_rate: r.planned_buy_rate * multiplier(r, 'rate') })), capacity: data.capacity.map(r => ({ ...r, available_trucks: r.available_trucks * multiplier(r, 'capacity') })) }
  const baseline = analyze(data, asOf, config, timeZone), result = analyze(adjusted, asOf, { ...config, ...scenario.thresholds }, timeZone)
  const old = new Map(baseline.actions.map(a => [a.action_id, a])), next = new Map(result.actions.map(a => [a.action_id, a]))
  const rank = { Low: 0, Medium: 1, High: 2, Critical: 3 }
  return { baseline, scenario: result, adjusted, deltas: {
    new: result.actions.filter(a => !old.has(a.action_id)), resolved: baseline.actions.filter(a => !next.has(a.action_id)),
    increased: result.actions.filter(a => old.has(a.action_id) && rank[a.severity] > rank[old.get(a.action_id)!.severity]),
    decreased: result.actions.filter(a => old.has(a.action_id) && rank[a.severity] < rank[old.get(a.action_id)!.severity]),
  } }
}
