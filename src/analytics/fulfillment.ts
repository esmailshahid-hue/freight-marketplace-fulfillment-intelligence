import type { UpcomingLoad } from '../data/schemas'
import { sum } from '../utils/math'
import { DEFAULT_CONFIG, type Config } from './config'
export function fulfillment(demand: number, raw: number, effective: number) {
  return { raw_capacity_coverage: raw / demand, effective_capacity_coverage: effective / demand, projected_fulfilled: Math.min(demand, effective), expected_unfulfilled: Math.max(demand - effective, 0) }
}
export function economics(rows: UpcomingLoad[]) {
  const demand = sum(rows, r => r.load_count), revenue = sum(rows, r => r.sell_rate * r.load_count), buy = sum(rows, r => r.planned_buy_rate * r.load_count)
  return { upcoming_loads: demand, group_sell_revenue: revenue, group_planned_buy_cost: buy, gross_spread: revenue - buy, gross_take_rate_proxy: (revenue - buy) / revenue, avg_sell_rate: revenue / demand, current_buy_rate: buy / demand, negative_gross_spread: buy > revenue }
}
export function capacityStatus(coverage: number, config: Config = DEFAULT_CONFIG) {
  return coverage >= config.HEALTHY_COVERAGE ? 'Healthy' : coverage >= config.WATCH_COVERAGE ? 'Watch' : coverage >= config.AT_RISK_COVERAGE ? 'At Risk' : 'Critical'
}
