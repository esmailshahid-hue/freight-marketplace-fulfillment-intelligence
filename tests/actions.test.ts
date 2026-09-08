import { it, expect } from 'vitest'
import { analyze } from '../src/analytics/engine'
import { generateActions, prioritizeActions } from '../src/analytics/actions'
import { normalize } from '../src/utils/math'
import { fixture, AS_OF } from './helpers'
it('handles equal normalization values and exact priority weights', () => {
  expect(normalize(5, [5, 5])).toBe(50); expect(normalize(0, [0, 0])).toBe(0)
  expect(normalize(7, [2, 12])).toBe(50)
  const d = fixture(); d.capacity = []
  const action = analyze(d, AS_OF).actions[0]
  expect(action.action_type).toBe('SECURE_CAPACITY')
  expect(action.action_priority_score).toBeCloseTo(.4 * 50 + .25 * 80 + .2 * 50 + .15 * action.risk_score)
  expect(prioritizeActions([])).toEqual([])
})
it('triggers concentration at five loads but not below, without creating a fulfillment crisis', () => {
  const d = fixture(); d.capacity[0].available_trucks = 20; d.upcoming[0].load_count = 5
  const a = analyze(d, AS_OF)
  expect(a.buckets[0].capacity.top_carrier_share).toBe(1)
  expect(a.buckets[0].concentration_warning).toBe('Watch')
  expect(a.buckets[0].expected_unfulfilled).toBe(0)
  expect(a.actions.map(x => x.action_type)).toContain('ACTIVATE_BACKUP_CARRIERS')
  d.upcoming[0].load_count = 4.99
  expect(analyze(d, AS_OF).actions).toHaveLength(0)
})
it('payment is only an exposure overlay, uses at least 15% and never changes capacity', () => {
  const d = fixture(), baseline = analyze(d, AS_OF)
  d.payments = [{ carrier_id: 'c', open_payable: 100, overdue_payable: 10, max_days_overdue: 1, last_payment_date: null, payment_status: 'Overdue', currency: 'SAR' }]
  const paid = analyze(d, AS_OF)
  expect(paid.kpis.expected_unfulfilled).toBe(baseline.kpis.expected_unfulfilled)
  expect(paid.buckets[0].capacity).toEqual(baseline.buckets[0].capacity)
  expect(paid.actions.map(a => a.action_type)).toContain('REVIEW_PAYMENT_EXPOSURE')
  d.payments[0].overdue_payable = 0
  expect(analyze(d, AS_OF).actions.map(a => a.action_type)).not.toContain('REVIEW_PAYMENT_EXPOSURE')
  const bucket = structuredClone(paid.buckets[0]); bucket.capacity.contributions[0].effective_share = .15
  expect(generateActions([bucket], [{ ...d.payments[0], overdue_payable: 1 }]).map(a => a.action_type)).toContain('REVIEW_PAYMENT_EXPOSURE')
  bucket.capacity.contributions[0].effective_share = .14999
  expect(generateActions([bucket], [{ ...d.payments[0], overdue_payable: 1 }]).map(a => a.action_type)).not.toContain('REVIEW_PAYMENT_EXPOSURE')
})
it('prebooks once per pair at exact growth and demand boundaries', () => {
  const b = analyze(fixture(), AS_OF).buckets[0]
  b.baseline.demand_growth_pct = .25; b.baseline.upcoming_7d_loads = 5
  expect(generateActions([b, { ...b, id: 'second', pickup_date: '2026-09-08' }]).filter(a => a.action_type === 'PREBOOK_CAPACITY')).toHaveLength(1)
  b.baseline.demand_growth_pct = .24999
  expect(generateActions([b]).some(a => a.action_type === 'PREBOOK_CAPACITY')).toBe(false)
})
