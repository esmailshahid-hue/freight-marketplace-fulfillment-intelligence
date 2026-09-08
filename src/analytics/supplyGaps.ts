import type { Datasets } from '../data/schemas'
import type { PlanningBucket } from './types'
import { timestamp, localDate, addDays, DAY, DEFAULT_TIME_ZONE } from '../utils/dates'
import { key, sum } from '../utils/math'
import { demandBaseline } from './history'
export function supplyGaps(data: Datasets, buckets: PlanningBucket[], asOf: string, timeZone = DEFAULT_TIME_ZONE) {
  const end = localDate(asOf, timeZone), start = addDays(end, -30)
  const pairs = new Map([...data.historical, ...data.upcoming].map(r => [key(r.lane, r.equipment_type), [r.lane, r.equipment_type]]))
  return [...pairs.values()].map(([lane, equipment_type]) => {
    const history = data.historical.filter(r => r.lane === lane && r.equipment_type === equipment_type && r.date >= start && r.date <= end)
    const upcoming = data.upcoming.filter(r => r.lane === lane && r.equipment_type === equipment_type && timestamp(r.pickup_datetime, timeZone) >= timestamp(asOf, timeZone) && timestamp(r.pickup_datetime, timeZone) <= timestamp(asOf, timeZone) + 7 * DAY)
    const groups = buckets.filter(b => b.lane === lane && b.equipment_type === equipment_type)
    const failed = history.filter(r => !r.fulfilled), gap_days_30d = new Set(failed.map(r => r.date)).size
    const avg_sell_rate = upcoming.length ? sum(upcoming, r => r.sell_rate * r.load_count) / sum(upcoming, r => r.load_count) : history.length ? sum(history, r => r.sell_rate) / history.length : 0
    const top_carrier_share = Math.max(0, ...groups.map(b => b.capacity.top_carrier_share))
    const upcoming_expected_unfulfilled_7d = sum(groups, b => b.expected_unfulfilled)
    const recurrence_multiplier = 1 + Math.min(gap_days_30d / 10, 1), concentration_multiplier = 1 + Math.max(top_carrier_share - .35, 0)
    const structural_supply_gap_score = (failed.length + upcoming_expected_unfulfilled_7d) * avg_sell_rate * recurrence_multiplier * concentration_multiplier
    return { lane, equipment_type, historical_unfulfilled_30d: failed.length, gap_days_30d, upcoming_expected_unfulfilled_7d, avg_sell_rate, top_carrier_share, recurrence_multiplier, concentration_multiplier, structural_supply_gap_score,
      demand_growth_pct: demandBaseline(data.historical, data.upcoming, lane, equipment_type, asOf, timeZone).demand_growth_pct,
      explanation: `${failed.length} historical unfulfilled loads across ${gap_days_30d} days; approximately ${Math.round(upcoming_expected_unfulfilled_7d)} upcoming load-equivalents exposed. Supply-gap priority score is a prioritization heuristic, not a financial forecast.` }
  }).sort((a, b) => b.structural_supply_gap_score - a.structural_supply_gap_score || a.lane.localeCompare(b.lane))
}
