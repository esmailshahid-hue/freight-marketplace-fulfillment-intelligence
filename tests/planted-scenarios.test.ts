import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { FILE_NAMES, type DatasetName } from '../src/data/schemas'
import { validateCsv } from '../src/data/validation'
import { serializeDatasets } from '../src/data/sampleLoader'
import { analyze } from '../src/analytics/engine'
import { generateSynthetic, SAMPLE_METADATA, SAMPLE_LANES } from '../src/data/synthetic'
import { sum } from '../src/utils/math'
const files = Object.fromEntries((Object.keys(FILE_NAMES) as DatasetName[]).map(k => [k, readFileSync(new URL(`../public/sample-data/${FILE_NAMES[k]}`, import.meta.url), 'utf8')]))
const checked = validateCsv(files, SAMPLE_METADATA.sample_as_of)
if (!checked.data) throw new Error(JSON.stringify(checked.errors))
const result = analyze(checked.data, SAMPLE_METADATA.sample_as_of)
const groups = (i: number) => result.buckets.filter(b => b.lane === `${SAMPLE_LANES[i][0]} → ${SAMPLE_LANES[i][1]}`.toLowerCase())
const types = (i: number) => result.actions.filter(a => a.lane === groups(i)[0].lane).map(a => a.action_type)
describe('generated CSV operating scenarios (spec section 9.5 names)', () => {
  it('A: port demand spike and price-driven capacity problem', () => {
    for (const b of groups(0)) {
      expect(b.baseline.demand_growth_pct).toBeGreaterThanOrEqual(.30)
      expect(b.baseline.demand_growth_pct).toBeLessThanOrEqual(.40)
      expect(b.raw_capacity_coverage).toBeGreaterThanOrEqual(1)
      expect(b.effective_capacity_coverage).toBeLessThan(1)
      expect(b.capacity.weighted_acceptance).toBeLessThan(.70)
      expect(b.root_cause.primary).toBe('PRICE_COMPETITIVENESS')
      expect(b.rate_search?.recommendation?.coverage).toBeGreaterThanOrEqual(1)
      expect(b.rate_search?.recommendation?.gross_take_rate_proxy).toBeGreaterThanOrEqual(.1)
    }
    expect(types(0)).toContain('RAISE_BUY_RATE'); expect(types(0)).toContain('PREBOOK_CAPACITY')
  })
  it('B: true specialized physical supply shortage (user scenario C)', () => {
    const b = groups(1)[0]
    expect(b.raw_capacity_coverage).toBeLessThan(.75)
    expect(b.capacity.weighted_acceptance).toBeGreaterThanOrEqual(.9)
    expect(b.capacity.contributions.every(c => c.service.reliability! >= .85)).toBe(true)
    expect(b.root_cause.primary).toBe('SUPPLY_SHORTAGE')
    expect(types(1)).toContain('SECURE_CAPACITY'); expect(types(1)).not.toContain('RAISE_BUY_RATE')
    expect(result.supply_gaps[0].lane).toBe(b.lane)
  })
  it('C: commercial constraint (user scenario E)', () => {
    const b = groups(2)[0]
    expect(b.raw_capacity_coverage).toBeGreaterThanOrEqual(1)
    expect(b.effective_capacity_coverage).toBeLessThan(1)
    const restoring = b.rate_search!.candidates.filter(c => c.coverage >= 1)
    expect(restoring.length).toBeGreaterThan(0)
    expect(restoring.every(c => c.gross_take_rate_proxy < .1)).toBe(true)
    expect(b.root_cause.primary).toBe('COMMERCIAL_CONSTRAINT')
    expect(types(2)).toContain('ESCALATE_COMMERCIAL_CONSTRAINT'); expect(types(2)).not.toContain('RAISE_BUY_RATE')
  })
  it('D: carrier concentration remains a Watch warning on otherwise healthy capacity', () => {
    const b = groups(3)[0]
    expect(b.capacity.top_carrier_share).toBeGreaterThanOrEqual(.45)
    expect(b.capacity.top_carrier_share).toBeLessThanOrEqual(.55)
    expect(b.effective_capacity_coverage).toBeGreaterThanOrEqual(1.2)
    expect(b.concentration_status).toBe('High'); expect(b.concentration_warning).toBe('Watch')
    expect(b.expected_unfulfilled).toBe(0); expect(b.root_cause.primary).toBeNull()
    expect(types(3)).toContain('ACTIVATE_BACKUP_CARRIERS')
  })
  it('E: service-quality drag favors reliable capacity, not a rate increase', () => {
    const b = groups(4)[0]
    expect(b.raw_capacity_coverage).toBeGreaterThanOrEqual(1)
    expect(b.capacity.acceptance_adjusted_capacity / b.upcoming_loads).toBeGreaterThanOrEqual(1)
    expect(b.effective_capacity_coverage).toBeLessThan(1)
    expect(b.root_cause.primary).toBe('SERVICE_QUALITY')
    expect(types(4)).toContain('REVIEW_SERVICE_QUALITY'); expect(types(4)).not.toContain('RAISE_BUY_RATE')
  })
  it('F: at least 40% of demand is healthy control demand', () => {
    const healthy = result.buckets.filter(b => b.effective_capacity_coverage >= 1.2 && b.capacity.top_carrier_share < .45 && b.rate_index! >= .97 && b.rate_index! < 1.03 && ['Low', 'Medium'].includes(b.risk.band))
    expect(sum(healthy, b => b.upcoming_loads) / result.kpis.upcoming_loads).toBeGreaterThanOrEqual(.4)
    expect(healthy.length / result.buckets.length).toBeGreaterThanOrEqual(.5)
    for (let i = 5; i < 12; i++) expect(types(i)).toEqual([])
  })
})
it('sample scale, metadata, reproducibility, and all seven action types', () => {
  expect(checked.errors).toEqual([])
  expect(checked.data!.historical).toHaveLength(1200); expect(checked.data!.offers.length).toBeGreaterThanOrEqual(3500)
  expect(checked.data!.offers.length).toBeLessThanOrEqual(5000)
  expect(result.kpis.upcoming_loads).toBeGreaterThanOrEqual(140); expect(result.kpis.upcoming_loads).toBeLessThanOrEqual(180)
  expect(new Set(checked.data!.capacity.map(c => c.carrier_id)).size).toBe(48)
  expect(new Set(checked.data!.historical.map(c => c.lane)).size).toBe(12)
  expect(new Set(checked.data!.historical.map(c => c.equipment_type)).size).toBe(5)
  expect(new Set(checked.data!.historical.map(c => c.customer)).size).toBe(7)
  expect(new Set(checked.data!.historical.map(c => c.business_unit)).size).toBe(4)
  expect(JSON.parse(readFileSync(new URL('../public/sample-data/sample-metadata.json', import.meta.url), 'utf8'))).toEqual(SAMPLE_METADATA)
  const generated = serializeDatasets(generateSynthetic())
  for (const name of Object.keys(FILE_NAMES) as DatasetName[]) expect(files[name].trim()).toBe(generated[name]!.trim())
  expect(generateSynthetic(42)).toEqual(generateSynthetic(42)); expect(generateSynthetic(41)).not.toEqual(generateSynthetic(42))
  expect(new Set(result.actions.map(a => a.action_type)).size).toBe(7)
})
it('enforces all specification invariants on the real sample', () => {
  for (const b of result.buckets) {
    expect(b.capacity.effective).toBeLessThanOrEqual(b.capacity.raw)
    expect(b.projected_fulfilled).toBeLessThanOrEqual(b.upcoming_loads)
    expect(b.expected_unfulfilled).toBeGreaterThanOrEqual(0)
    expect(b.risk.score).toBeGreaterThanOrEqual(0); expect(b.risk.score).toBeLessThanOrEqual(100)
    for (const c of b.capacity.contributions) {
      expect(c.service.reliability).toBeGreaterThanOrEqual(0); expect(c.service.reliability).toBeLessThanOrEqual(1)
      expect(c.modeled.expected).toBeGreaterThanOrEqual(.10); expect(c.modeled.expected).toBeLessThanOrEqual(.98)
    }
  }
  for (const a of result.actions) { expect(a.action_priority_score).toBeGreaterThanOrEqual(0); expect(a.action_priority_score).toBeLessThanOrEqual(100) }
})
