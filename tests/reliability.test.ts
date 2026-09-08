import { it, expect } from 'vitest'
import { performance, reliabilityFactor } from '../src/analytics/reliability'
import { historyRow } from './helpers'
it('calculates exact weighted service reliability and clamps', () => {
  expect(reliabilityFactor(.9, .8, .1)).toBeCloseTo(.87)
  expect(reliabilityFactor(2, 2, -1)).toBe(1)
  expect(reliabilityFactor(-1, -1, 2)).toBe(0)
})
it('excludes blank service metrics from their individual denominators', () => {
  const rows = [historyRow({ pickup_ontime: null, delivery_ontime: false }), historyRow({ pickup_ontime: true, delivery_ontime: null, cancelled: true })]
  const p = performance(rows, 'c', 'a → b')
  expect(p.pickup).toBe(1); expect(p.delivery).toBe(0); expect(p.cancellation).toBe(.5)
  expect(p.reliability).toBe(.6)
})
it('uses carrier-lane at five samples, then carrier overall, then marketplace', () => {
  const local = Array.from({ length: 5 }, () => historyRow())
  expect(performance(local, 'c', 'a → b').source).toBe('carrier_lane')
  expect(performance([...local.slice(1), historyRow({ lane: 'other' })], 'c', 'a → b').source).toBe('carrier_overall')
  expect(performance(local.slice(1), 'c', 'a → b').source).toBe('marketplace_fallback')
  expect(performance(local, 'new', 'a → b').confidence).toBe('Low confidence')
})
it('does not invent missing metrics or use unassigned loads for carrier cancellation', () => {
  expect(performance([], 'c', 'a → b').reliability).toBeNull()
  expect(performance([historyRow({ pickup_ontime: null })], 'c', 'a → b').reliability).toBeNull()
  const p = performance([historyRow(), historyRow({ carrier_id: null, cancelled: true })], 'c', 'a → b')
  expect(p.cancellation).toBe(0)
})
