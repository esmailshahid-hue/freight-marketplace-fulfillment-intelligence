import { it, expect } from 'vitest'
import { number, percent, coverage, money, label, dateLabel, suggestedRate } from '../src/ui/format'
import { actionsForBucket, bucketForAction, filterBuckets, EMPTY_FILTERS, uniquePairs } from '../src/ui/selectors'
import { initialControls, toScenario } from '../src/ui/scenarioControls'
import { analyze } from '../src/analytics/engine'
import { runScenario } from '../src/analytics/scenarios'
import { fixture, AS_OF } from './helpers'
it('distinguishes unavailable numbers from zero and preserves signed economics', () => {
  expect(number(null)).toBe('Unavailable'); expect(percent(undefined)).toBe('Unavailable')
  expect(coverage(NaN)).toBe('Unavailable'); expect(money(Infinity)).toBe('Unavailable')
  expect(percent(0)).toBe('0.0%'); expect(coverage(0)).toBe('0.00×')
  expect(number(15.625)).toBe('15.6'); expect(percent(-.125)).toBe('-12.5%')
  expect(money(-200)).toBe('SAR -200.00'); expect(suggestedRate(3137.6, 'SAR')).toBe('Approximately SAR 3,150.00')
})
it('formats calendar dates without a host-timezone day shift and labels enum values', () => {
  expect(dateLabel('2026-09-07')).toBe('07 Sept 2026')
  expect(label('RAISE_BUY_RATE')).toBe('Raise buy rate'); expect(label(null)).toBe('None')
})
it('filters existing buckets without mutating or recomputing metrics', () => {
  const a = analyze(fixture(), AS_OF), b = a.buckets[0], snapshot = structuredClone(a)
  expect(filterBuckets(a.buckets, { ...EMPTY_FILTERS, lane: b.lane, equipment: b.equipment_type, date: b.pickup_date, status: b.status })).toEqual([b])
  for (const field of ['lane', 'equipment', 'date', 'status']) expect(filterBuckets(a.buckets, { ...EMPTY_FILTERS, [field]: 'no-match' })).toEqual([])
  expect(a).toEqual(snapshot)
})
it('maps actions to exact lane/equipment/date buckets and keeps pair choices unique', () => {
  const a = analyze(fixture(), AS_OF), action = a.actions[0], b = a.buckets[0]
  expect(bucketForAction(action, a.buckets)).toBe(b)
  expect(bucketForAction({ ...action, equipment_type: 'other' }, a.buckets)).toBeUndefined()
  expect(bucketForAction({ ...action, pickup_date: '2026-09-08' }, a.buckets)).toBeUndefined()
  expect(actionsForBucket(b, a.actions)).toEqual(a.actions)
  expect(uniquePairs([b, { ...b, pickup_date: '2026-09-08' }])).toEqual([{ lane: b.lane, equipment_type: b.equipment_type }])
})
it('converts percent controls to existing scenario inputs, including optional lane and thresholds', () => {
  const d = fixture(), original = structuredClone(d), defaults = initialControls('a → b', 'flatbed')
  expect(toScenario(defaults)).toEqual({ demand: 0, capacity: 0, rate: 0, thresholds: { MAX_DEADHEAD_KM: 150, MIN_RELIABILITY: .75, COMMERCIAL_FLOOR: .10 } })
  const input = toScenario({ ...defaults, demand: 25, rate: -20, minReliability: 90, maxDeadhead: 50, commercialFloor: 30, overrideEnabled: true, overrideDemand: -50, overrideCapacity: 50, overrideRate: 10 })
  expect(input).toEqual({ demand: .25, capacity: 0, rate: -.20, thresholds: { MAX_DEADHEAD_KM: 50, MIN_RELIABILITY: .90, COMMERCIAL_FLOOR: .30 }, lane: { lane: 'a → b', equipment_type: 'flatbed', demand: -.5, capacity: .5, rate: .1 } })
  expect(runScenario(d, AS_OF, input).adjusted.upcoming[0].load_count).toBe(6.25)
  expect(d).toEqual(original)
  expect(runScenario(d, AS_OF, toScenario(defaults)).scenario).toEqual(analyze(d, AS_OF))
})
