import { it, expect } from 'vitest'
import { analyze } from '../src/analytics/engine'
import { fixture, AS_OF, capacityRow, historyRow, offerRow } from './helpers'

function splitCarrierFixture() {
  const data = fixture()
  data.upcoming[0].load_count = 101
  data.historical = ['A', 'B', 'C'].flatMap(carrier_id => Array.from({ length: 10 }, (_, i) => historyRow({ load_id: `${carrier_id}-h${i}`, carrier_id })))
  data.offers = ['A', 'B', 'C'].flatMap(carrier_id => Array.from({ length: 20 }, (_, i) => offerRow({ offer_id: `${carrier_id}-o${i}`, carrier_id })))
  // Perfect reliability and the specified .98 acceptance clamp produce exactly
  // the requested 30 + 25 + 25 + 20 effective units. Decimal trucks are valid scenario math.
  data.capacity = [['A', 30], ['A', 25], ['B', 25], ['C', 20]].map(([carrier, units], i) => capacityRow({
    capacity_id: `block-${i}`, carrier_id: String(carrier), available_trucks: Number(units) / .98,
  }))
  data.payments = [{ carrier_id: 'A', open_payable: 1000, overdue_payable: 100, max_days_overdue: 5, last_payment_date: null, payment_status: 'Overdue', currency: 'SAR' }]
  return data
}

it('aggregates 30+25 effective units into a 55% carrier share and propagates it to every rule', () => {
  const result = analyze(splitCarrierFixture(), AS_OF), b = result.buckets[0]
  expect(b.capacity.contributions.map(c => c.effective)).toEqual([30, 25, 25, 20])
  expect(b.capacity.carriers.find(c => c.carrier_id === 'A')).toMatchObject({ effective: 55, effective_share: .55, capacity_ids: ['block-0', 'block-1'] })
  expect(b.capacity.top_carrier_share).toBe(.55)
  expect(b.capacity.contributions[0].effective_share).toBe(.30)
  expect(b.risk.components.concentration).toBe(90)
  expect(b.risk.reason).toContain('largest carrier represents 55.0%')
  expect(b.root_cause.primary).toBe('CARRIER_CONCENTRATION')
  expect(b.concentration_status).toBe('High')
  expect(result.actions.find(a => a.action_type === 'ACTIVATE_BACKUP_CARRIERS')?.recommended_action).toContain('55.0%')
  expect(result.actions.find(a => a.action_type === 'REVIEW_PAYMENT_EXPOSURE')?.recommended_action).toContain('55.0%')
  expect(result.supply_gaps[0].top_carrier_share).toBe(.55)
  expect(result.supply_gaps[0].concentration_multiplier).toBeCloseTo(1.2)
})

it('retains healthy Watch warnings and is invariant to splitting a carrier into additive blocks', () => {
  const data = splitCarrierFixture(); data.upcoming[0].load_count = 80
  const split = analyze(data, AS_OF)
  expect(split.buckets[0].concentration_warning).toBe('Watch')
  expect(split.buckets[0].expected_unfulfilled).toBe(0)
  data.capacity = [capacityRow({ capacity_id: 'A-combined', carrier_id: 'A', available_trucks: 55 / .98 }), ...data.capacity.slice(2)]
  const combined = analyze(data, AS_OF)
  expect(combined.kpis).toEqual(split.kpis)
  expect(combined.buckets[0].risk).toEqual(split.buckets[0].risk)
  expect(combined.buckets[0].root_cause).toEqual(split.buckets[0].root_cause)
  expect(combined.actions).toEqual(split.actions)
  expect(combined.supply_gaps).toEqual(split.supply_gaps)
})

it('excludes inactive/unmatched blocks from carrier totals and handles zero effective capacity', () => {
  const data = splitCarrierFixture()
  data.capacity.push(capacityRow({ capacity_id: 'inactive', carrier_id: 'B', available_trucks: 1000, active: false }), capacityRow({ capacity_id: 'other-date', carrier_id: 'C', available_trucks: 1000, capacity_date: '2026-09-08' }))
  const b = analyze(data, AS_OF).buckets[0]
  expect(b.capacity.top_carrier_share).toBe(.55)
  expect(b.capacity.carriers.find(c => c.carrier_id === 'B')!.capacity_ids).toEqual(['block-2'])
  expect(b.capacity.contributions.some(c => c.capacity_id === 'inactive' && !c.qualified)).toBe(true)
  data.capacity.forEach(c => { c.active = false })
  const zero = analyze(data, AS_OF).buckets[0]
  expect(zero.capacity.top_carrier_share).toBe(0)
  expect(zero.capacity.carriers).toEqual([])
  expect(zero.concentration_status).toBe('No effective capacity')
})

it('payment exposure combines small blocks which individually fall below 15%', () => {
  const data = splitCarrierFixture()
  data.capacity = [capacityRow({ capacity_id: 'a1', carrier_id: 'A', available_trucks: 8 / .98 }), capacityRow({ capacity_id: 'a2', carrier_id: 'A', available_trucks: 8 / .98 }), capacityRow({ capacity_id: 'b', carrier_id: 'B', available_trucks: 84 / .98 })]
  const result = analyze(data, AS_OF)
  expect(result.actions.find(a => a.action_type === 'REVIEW_PAYMENT_EXPOSURE')?.recommended_action).toContain('16.0%')
})
