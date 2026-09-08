import { it, expect } from 'vitest'
import { analyze } from '../src/analytics/engine'
import { capacityStatus, economics, fulfillment } from '../src/analytics/fulfillment'
import { fixture, AS_OF, capacityRow, upcomingRow } from './helpers'
it('enforces each capacity qualification rule and retains exclusions', () => {
  const d = fixture()
  d.capacity.push(capacityRow({ capacity_id: 'inactive', active: false }), capacityRow({ capacity_id: 'far', deadhead_km_to_origin: 151 }), capacityRow({ capacity_id: 'lane', lane: 'other' }), capacityRow({ capacity_id: 'equipment', equipment_type: 'other' }), capacityRow({ capacity_id: 'date', capacity_date: '2026-09-08' }))
  const b = analyze(d, AS_OF).buckets[0]
  expect(b.capacity.raw).toBe(10); expect(b.capacity.effective).toBe(9.8)
  expect(b.capacity.contributions.filter(r => !r.qualified)).toHaveLength(2)
})
it('excludes failed reliability and respects equality at the threshold', () => {
  const d = fixture(); d.historical.forEach((r, i) => { r.pickup_ontime = i < 5 })
  expect(analyze(d, AS_OF).buckets[0].capacity.raw).toBe(10)
  expect(analyze(d, AS_OF, { MIN_RELIABILITY: .751 }).buckets[0].capacity.raw).toBe(0)
})
it('keeps blocks additive and implements the specified per-row concentration formula', () => {
  const d = fixture(); d.capacity.push(capacityRow({ capacity_id: 'second' }))
  const b = analyze(d, AS_OF).buckets[0]
  expect(b.capacity.raw).toBe(20); expect(b.capacity.top_carrier_share).toBe(.5)
  expect(b.expected_unfulfilled).toBe(0); expect(b.projected_fulfilled).toBe(10)
})
it('handles no capacity, no benchmark, and no historical performance honestly', () => {
  const d = fixture(); d.capacity = []
  let b = analyze(d, AS_OF).buckets[0]
  expect(b.raw_capacity_coverage).toBe(0); expect(b.effective_capacity_coverage).toBe(0)
  expect(b.expected_unfulfilled).toBe(10); expect(b.rate_search).toBeNull()
  expect(b.root_cause.primary).toBe('SUPPLY_SHORTAGE')
  d.capacity = [capacityRow()]; d.offers = d.offers.slice(0, 3)
  b = analyze(d, AS_OF).buckets[0]
  expect(b.capacity.raw).toBe(10); expect(b.capacity.effective).toBe(9.8)
  expect(b.rate_index).toBeNull(); expect(b.rate_search).toBeNull(); expect(b.risk.reason).toContain('Limited pricing history')
  d.historical = []
  expect(analyze(d, AS_OF).buckets[0].capacity.contributions[0].exclusion).toBe('Reliability unavailable')
})
it('retains raw capacity but flags unquantifiable acceptance when no offers exist', () => {
  const d = fixture(); d.offers = []
  const b = analyze(d, AS_OF).buckets[0]
  expect(b.capacity.raw).toBe(10); expect(b.capacity.estimate_available).toBe(false)
  expect(b.warnings.join(' ')).toContain('acceptance unavailable')
})
it('weights all economics by load count and allows negative spread', () => {
  const e = economics([upcomingRow({ load_count: 2, sell_rate: 1000, planned_buy_rate: 1200 }), upcomingRow({ load_count: 1, sell_rate: 2000, planned_buy_rate: 2000 })])
  expect(e.group_sell_revenue).toBe(4000); expect(e.group_planned_buy_cost).toBe(4400)
  expect(e.gross_spread).toBe(-400); expect(e.gross_take_rate_proxy).toBe(-.1)
  expect(e.current_buy_rate).toBeCloseTo(4400 / 3)
  expect(fulfillment(10, 15, 12)).toEqual({ raw_capacity_coverage: 1.5, effective_capacity_coverage: 1.2, projected_fulfilled: 10, expected_unfulfilled: 0 })
})
it.each([[1.2, 'Healthy'], [1, 'Watch'], [.75, 'At Risk'], [.7499, 'Critical']])('coverage boundary %s', (coverage, status) => expect(capacityStatus(Number(coverage))).toBe(status))
it('does not create zero-demand buckets or include past/future-outside-horizon loads', () => {
  const d = fixture(); d.upcoming = [upcomingRow({ load_count: 0 }), upcomingRow({ pickup_datetime: '2026-09-07T07:00:00+03:00' }), upcomingRow({ pickup_datetime: '2026-10-01T08:00:00+03:00' })]
  expect(analyze(d, AS_OF).buckets).toEqual([])
  expect(analyze(d, AS_OF).kpis.projected_fulfillment_pct).toBeNull()
})
