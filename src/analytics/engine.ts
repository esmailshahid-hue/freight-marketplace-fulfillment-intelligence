import type { Datasets, UpcomingLoad } from '../data/schemas'
import { normalizeLane, normalizeKey } from '../data/mapping'
import { DEFAULT_CONFIG, type Config } from './config'
import { timestamp, DEFAULT_TIME_ZONE, localDate, DAY } from '../utils/dates'
import { key, sum } from '../utils/math'
import { benchmark, searchRates } from './pricing'
import { calculateCapacity } from './capacity'
import { economics, fulfillment, capacityStatus } from './fulfillment'
import { calculateRisk } from './risk'
import { classifyRootCause } from './rootCause'
import { demandBaseline } from './history'
import { generateActions } from './actions'
import { supplyGaps } from './supplyGaps'
import type { PlanningBucket } from './types'
export function analyze(input: Datasets, asOf: string, overrides: Partial<Config> = {}, timeZone = DEFAULT_TIME_ZONE) {
  const config = { ...DEFAULT_CONFIG, ...overrides }, now = timestamp(asOf, timeZone)
  if (!Number.isFinite(now)) throw new Error('Invalid analysis time')
  if (config.RATE_SEARCH_INCREMENT <= 0 || config.RATE_RECOMMENDATION_MAX_INCREASE < 0) throw new Error('Invalid rate search configuration')
  const normalized = <T extends { lane: string; equipment_type: string }>(r: T): T => ({ ...r, lane: normalizeLane(r.lane), equipment_type: normalizeKey(r.equipment_type) })
  const today = localDate(asOf, timeZone)
  const data: Datasets = { upcoming: input.upcoming.filter(r => r.load_count > 0 && timestamp(r.pickup_datetime, timeZone) >= now && timestamp(r.pickup_datetime, timeZone) <= now + 7 * DAY).map(normalized),
    capacity: input.capacity.map(normalized), historical: input.historical.filter(r => r.date <= today).map(normalized), offers: input.offers.filter(r => r.date <= today).map(normalized), payments: input.payments }
  const groups = new Map<string, UpcomingLoad[]>()
  for (const row of data.upcoming) {
    const id = key(row.lane, row.equipment_type, localDate(row.pickup_datetime, timeZone))
    groups.set(id, [...(groups.get(id) ?? []), row])
  }
  const buckets: PlanningBucket[] = [...groups].map(([id, rows]) => {
    const { lane, equipment_type, currency } = rows[0], pickup_date = localDate(rows[0].pickup_datetime, timeZone)
    const econ = economics(rows), bench = benchmark(data.offers, lane, equipment_type, asOf, config, timeZone)
    const compute = (rate: number) => calculateCapacity(data.capacity, data.historical, data.offers, lane, equipment_type, pickup_date, rate, bench, config)
    const capacity = compute(econ.current_buy_rate), fill = fulfillment(econ.upcoming_loads, capacity.raw, capacity.effective)
    const rate_search = bench && capacity.raw > 0 ? searchRates(econ.current_buy_rate, econ.avg_sell_rate, fill.effective_capacity_coverage, rate => { const c = compute(rate); return { coverage: c.effective / econ.upcoming_loads, acceptance: c.weighted_acceptance } }, config) : null
    const hours_to_pickup = (Math.min(...rows.map(r => timestamp(r.pickup_datetime, timeZone))) - now) / 3_600_000
    const risk = calculateRisk(fill.effective_capacity_coverage, hours_to_pickup, capacity.weighted_acceptance, capacity.top_carrier_share, bench !== null, config)
    const warnings: string[] = []
    if (!bench) warnings.push('Rate benchmark unavailable')
    else if (bench.confidence !== 'High confidence') warnings.push(`Pricing fallback: ${bench.source}, ${bench.days} days`)
    for (const c of capacity.contributions) {
      if (c.service.source !== 'carrier_lane') warnings.push(`${c.carrier_id}: performance fallback ${c.service.source}`)
      if (c.service.reliability === null) warnings.push(`${c.carrier_id}: reliability unavailable; excluded`)
      if (c.modeled.source !== 'rate_band') warnings.push(`${c.carrier_id}: acceptance fallback ${c.modeled.source}`)
      if (c.modeled.expected === null) warnings.push(`${c.carrier_id}: acceptance unavailable; contribution unquantifiable`)
    }
    return { id, lane, equipment_type, pickup_date, currency, hours_to_pickup, ...econ, ...fill, capacity, benchmark: bench, rate_index: bench ? econ.current_buy_rate / bench.rate : null, rate_search, risk,
      root_cause: classifyRootCause(fill.raw_capacity_coverage, fill.effective_capacity_coverage, capacity.acceptance_adjusted_capacity / econ.upcoming_loads, capacity.weighted_acceptance, capacity.top_carrier_share, hours_to_pickup, rate_search, config),
      baseline: demandBaseline(data.historical, data.upcoming, lane, equipment_type, asOf, timeZone), status: capacityStatus(fill.effective_capacity_coverage, config),
      concentration_status: capacity.effective === 0 ? 'No effective capacity' : capacity.top_carrier_share >= config.CONCENTRATION_HIGH ? 'High' : capacity.top_carrier_share >= config.CONCENTRATION_WARNING ? 'Watch' : 'Normal',
      concentration_warning: fill.effective_capacity_coverage >= 1 && capacity.top_carrier_share >= config.CONCENTRATION_WARNING ? 'Watch' : null,
      modeled_revenue_exposure: fill.expected_unfulfilled * econ.avg_sell_rate, warnings }
  })
  const actions = generateActions(buckets, data.payments, config), demand = sum(buckets, b => b.upcoming_loads), revenue = sum(buckets, b => b.group_sell_revenue)
  return { buckets, actions, supply_gaps: supplyGaps(data, buckets, asOf, timeZone), kpis: {
    upcoming_loads: demand, projected_fulfillment_pct: demand ? sum(buckets, b => b.projected_fulfilled) / demand : null,
    effective_capacity_coverage: demand ? sum(buckets, b => b.capacity.effective) / demand : null,
    expected_unfulfilled: sum(buckets, b => b.expected_unfulfilled), modeled_revenue_exposure: sum(buckets, b => b.modeled_revenue_exposure),
    gross_take_rate_proxy: revenue ? sum(buckets, b => b.gross_spread) / revenue : null,
    high_critical_buckets: buckets.filter(b => ['High', 'Critical'].includes(b.risk.band)).length, action_count: actions.length,
  } }
}
export type Analysis = ReturnType<typeof analyze>
