import { it, expect } from 'vitest'
import { demandBaseline } from '../src/analytics/history'
import { supplyGaps } from '../src/analytics/supplyGaps'
import { analyze } from '../src/analytics/engine'
import { fixture, AS_OF, historyRow } from './helpers'
import { addDays } from '../src/utils/dates'
it('uses eight complete Monday–Sunday weeks, including zero-demand weeks', () => {
  const d = fixture(); d.historical = Array.from({ length: 70 }, (_, i) => historyRow({ date: addDays('2026-09-07', -i - 1) }))
  const b = demandBaseline(d.historical, d.upcoming, 'a → b', 'flatbed', AS_OF)
  expect(b.complete_weeks).toBe(8); expect(b.historical_avg_weekly_loads).toBe(7)
  expect(b.demand_growth_pct).toBeCloseTo(10 / 7 - 1)
})
it('requires two complete weeks and excludes the current week', () => {
  const rows = Array.from({ length: 14 }, (_, i) => historyRow({ date: addDays('2026-09-07', -i - 1) }))
  expect(demandBaseline(rows, [], 'a → b', 'flatbed', AS_OF).historical_avg_weekly_loads).toBe(7)
  expect(demandBaseline(rows.slice(0, 13), [], 'a → b', 'flatbed', AS_OF).historical_avg_weekly_loads).toBeNull()
  expect(demandBaseline([...rows, historyRow({ date: '2026-09-07' })], [], 'a → b', 'flatbed', AS_OF).historical_avg_weekly_loads).toBe(7)
})
it('calculates recurrence, weighted upcoming sell rate, concentration and structural score', () => {
  const d = fixture(); d.historical = [historyRow({ fulfilled: false }), historyRow({ date: '2026-09-05', fulfilled: false }), historyRow({ fulfilled: true, cancelled: true }), historyRow({ date: '2026-01-01', fulfilled: false })]
  const b = analyze(fixture(), AS_OF).buckets[0]
  b.expected_unfulfilled = 3; b.capacity.top_carrier_share = .5
  const gap = supplyGaps(d, [b], AS_OF)[0]
  expect(gap.historical_unfulfilled_30d).toBe(2); expect(gap.gap_days_30d).toBe(2)
  expect(gap.recurrence_multiplier).toBe(1.2); expect(gap.concentration_multiplier).toBe(1.15)
  expect(gap.structural_supply_gap_score).toBeCloseTo(5 * 1400 * 1.2 * 1.15)
  d.upcoming = []
  expect(supplyGaps(d, [], AS_OF)[0].avg_sell_rate).toBe(1400)
})
