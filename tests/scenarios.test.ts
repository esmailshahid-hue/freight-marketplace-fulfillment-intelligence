import { it, expect } from 'vitest'
import { generateSynthetic, SAMPLE_METADATA } from '../src/data/synthetic'
import { runScenario } from '../src/analytics/scenarios'
import { fixture, AS_OF } from './helpers'
import { loadSample, serializeDatasets, shiftSampleDates } from '../src/data/sampleLoader'
import { analyze } from '../src/analytics/engine'
const port = { lane: 'Jeddah Islamic Port → Riyadh', equipment_type: 'Flatbed' }
it('propagates +25% demand through the same engine and creates physical capacity actions', () => {
  const data = generateSynthetic(), snapshot = structuredClone(data)
  const r = runScenario(data, AS_OF, { lane: { ...port, demand: .25 } })
  expect(data).toEqual(snapshot)
  for (const b of r.scenario.buckets) {
    const base = r.baseline.buckets.find(a => a.id === b.id)!
    expect(b.effective_capacity_coverage).toBeLessThanOrEqual(base.effective_capacity_coverage)
    expect(b.projected_fulfilled / b.upcoming_loads).toBeLessThanOrEqual(base.projected_fulfilled / base.upcoming_loads)
  }
  expect(r.deltas.new.some(a => a.action_type === 'SECURE_CAPACITY' && a.lane === port.lane.toLowerCase())).toBe(true)
})
it('increasing capacity and lowering reliability threshold cannot reduce raw coverage', () => {
  const data = generateSynthetic()
  for (const settings of [{ capacity: .25 }, { thresholds: { MIN_RELIABILITY: .5 } }]) {
    const r = runScenario(data, AS_OF, settings)
    r.scenario.buckets.forEach((b, i) => expect(b.raw_capacity_coverage).toBeGreaterThanOrEqual(r.baseline.buckets[i].raw_capacity_coverage))
  }
  const r = runScenario(data, AS_OF, { thresholds: { MIN_RELIABILITY: .95 } })
  r.scenario.buckets.forEach((b, i) => expect(b.raw_capacity_coverage).toBeLessThanOrEqual(r.baseline.buckets[i].raw_capacity_coverage))
})
it('crossing a stronger band updates acceptance, fulfillment, economics, and resolved actions', () => {
  const r = runScenario(generateSynthetic(), AS_OF, { lane: { ...port, rate: .10 } })
  const base = r.baseline.buckets[0], next = r.scenario.buckets[0]
  expect(next.capacity.weighted_acceptance).toBeGreaterThan(base.capacity.weighted_acceptance)
  expect(next.capacity.effective).toBeGreaterThan(base.capacity.effective)
  expect(next.gross_take_rate_proxy).toBeLessThan(base.gross_take_rate_proxy)
  expect(r.deltas.resolved.some(a => a.action_type === 'RAISE_BUY_RATE')).toBe(true)
})
it('never raises rates on a floor-breaching bucket', () => {
  const r = runScenario(generateSynthetic(), AS_OF, { rate: .2, thresholds: { COMMERCIAL_FLOOR: .3 } })
  for (const b of r.scenario.buckets.filter(b => b.gross_take_rate_proxy < .3)) expect(r.scenario.actions.some(a => a.action_type === 'RAISE_BUY_RATE' && a.lane === b.lane && a.pickup_date === b.pickup_date)).toBe(false)
})
it('applies lane changes after global changes, preserves decimals, clamps negatives, and resets', () => {
  const d = fixture(), lane = { lane: d.upcoming[0].lane, equipment_type: 'flatbed', demand: .25, capacity: .25 }
  const r = runScenario(d, AS_OF, { demand: .25, capacity: .25, lane })
  expect(r.adjusted.upcoming[0].load_count).toBe(15.625); expect(r.adjusted.capacity[0].available_trucks).toBe(15.625)
  expect(runScenario(d, AS_OF, { demand: -2, capacity: -2 }).scenario.buckets).toEqual([])
  expect(runScenario(d, AS_OF, {}).scenario).toEqual(analyze(d, AS_OF))
})
it.each(['2027-01-01T23:50:00+03:00', '2028-02-29T01:00:00Z', '2026-09-07T08:00:00+03:00'])('shifts built-in dates coherently at %s without shifting uploaded data', asOf => {
  const d = generateSynthetic(), snapshot = structuredClone(d)
  const loaded = loadSample(serializeDatasets(d), SAMPLE_METADATA, asOf)
  expect(loaded.errors).toEqual([]); expect(loaded.pastDue).toEqual([])
  expect(loaded.futureHistorical).toEqual([]); expect(loaded.futureOffers).toEqual([])
  const result = analyze(loaded.data!, asOf)
  expect(result.kpis.upcoming_loads).toBe(155)
  expect(result.buckets.every(b => b.capacity.raw > 0)).toBe(true)
  expect(result.buckets[0].root_cause.primary).toBe('PRICE_COMPETITIVENESS')
  expect(result.buckets.find(b => b.lane === 'dammam → riyadh')!.root_cause.primary).toBe('COMMERCIAL_CONSTRAINT')
  expect(d).toEqual(snapshot)
  const shifted = shiftSampleDates(d, SAMPLE_METADATA, asOf)
  expect(Date.parse(shifted.upcoming[0].pickup_datetime) - Date.parse(asOf)).toBe(Date.parse(d.upcoming[0].pickup_datetime) - Date.parse(AS_OF))
})
