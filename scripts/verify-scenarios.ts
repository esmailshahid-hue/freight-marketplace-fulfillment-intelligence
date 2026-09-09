import { readFile } from 'node:fs/promises'
import { FILE_NAMES, type DatasetName } from '../src/data/schemas'
import { validateCsv } from '../src/data/validation'
import { analyze } from '../src/analytics/engine'
import { SAMPLE_METADATA } from '../src/data/synthetic'
const files = Object.fromEntries(await Promise.all((Object.keys(FILE_NAMES) as DatasetName[]).map(async k => [k, await readFile(new URL(`../public/sample-data/${FILE_NAMES[k]}`, import.meta.url), 'utf8')])))
const checked = validateCsv(files, SAMPLE_METADATA.sample_as_of)
if (!checked.data) throw new Error(JSON.stringify(checked.errors))
const result = analyze(checked.data, SAMPLE_METADATA.sample_as_of)
const percent = (value: number) => +(value * 100).toFixed(2)
console.table(result.buckets.map(b => ({
  lane: b.lane, date: b.pickup_date, demand: b.upcoming_loads,
  raw_coverage: +b.raw_capacity_coverage.toFixed(4), effective_coverage: +b.effective_capacity_coverage.toFixed(4),
  acceptance_pct: percent(b.capacity.weighted_acceptance), top_carrier_pct: percent(b.capacity.top_carrier_share),
  unfulfilled: +b.expected_unfulfilled.toFixed(3), risk: +b.risk.score.toFixed(2), root: b.root_cause.primary,
})))
console.table(result.buckets.map(b => {
  const restoring = b.rate_search?.candidates.find(c => c.coverage >= 1)
  return {
    lane: b.lane, date: b.pickup_date, current_buy: +b.current_buy_rate.toFixed(2), sell: +b.avg_sell_rate.toFixed(2),
    benchmark: b.benchmark?.rate, take_rate_proxy_pct: percent(b.gross_take_rate_proxy),
    recommended_buy: b.rate_search?.recommendation?.buy_rate,
    restoring_buy: restoring?.buy_rate, restoring_coverage: restoring?.coverage,
    restoring_take_rate_proxy_pct: restoring ? percent(restoring.gross_take_rate_proxy) : null,
    actions: result.actions.filter(a => a.lane === b.lane && a.pickup_date === b.pickup_date).map(a => a.action_type).join(', '),
  }
}))
console.log(JSON.stringify(result.kpis, null, 2))
console.log('Supply-gap ranking:', result.supply_gaps.slice(0, 3).map(r => ({ lane: r.lane, score: r.structural_supply_gap_score })))
const carriers = [...new Set(checked.data.capacity.map(c => c.carrier_id))]
const healthy = result.buckets.filter(b => b.effective_capacity_coverage >= 1.2 && b.capacity.top_carrier_share < .45 && b.rate_index! >= .97 && b.rate_index! < 1.03 && ['Low', 'Medium'].includes(b.risk.band))
console.log('Sample summary:', {
  historical_loads: checked.data.historical.length, offers: checked.data.offers.length,
  carriers: carriers.length,
  multi_lane_carriers: carriers.filter(id => new Set(checked.data!.capacity.filter(c => c.carrier_id === id).map(c => c.lane)).size > 1).length,
  distinct_offered_rates: new Set(checked.data.offers.map(o => o.offered_buy_rate)).size,
  distinct_final_buy_rates: new Set(checked.data.historical.flatMap(h => h.final_buy_rate === null ? [] : [h.final_buy_rate])).size,
  healthy_demand_pct: percent(healthy.reduce((n, b) => n + b.upcoming_loads, 0) / result.kpis.upcoming_loads),
  port_demand_growth_pct: percent(result.buckets[0].baseline.demand_growth_pct!),
})
