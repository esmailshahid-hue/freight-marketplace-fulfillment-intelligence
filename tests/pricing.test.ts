import { describe, it, expect } from 'vitest'
import { benchmark, acceptance, rateBand, searchRates } from '../src/analytics/pricing'
import { offerRow, AS_OF } from './helpers'
const offers = (n: number, overrides = {}) => Array.from({ length: n }, () => offerRow(overrides))
describe('accepted benchmarks and guarded fallback hierarchy', () => {
  it('uses the median, not the mean, and excludes rejected offers', () => {
    const rows = [800, 900, 1000, 1100, 9000].map(offered_buy_rate => offerRow({ offered_buy_rate }))
    rows.push(offerRow({ accepted: false, offered_buy_rate: 1 }))
    expect(benchmark(rows, 'a → b', 'flatbed', AS_OF)?.rate).toBe(1000)
  })
  it.each([
    [5, {}, 'lane_equipment'], [5, { equipment_type: 'reefer' }, 'lane'],
    [10, { lane: 'elsewhere' }, 'equipment'], [20, { lane: 'elsewhere', equipment_type: 'reefer' }, 'global'],
  ])('requires sufficient samples at level %s %j', (n, overrides, source) => {
    const rows = offers(n, overrides)
    expect(benchmark(rows, 'a → b', 'flatbed', AS_OF)?.source).toBe(source)
    expect(benchmark(rows.slice(1), 'a → b', 'flatbed', AS_OF)).toBeNull()
  })
  it('exhausts the 30-day hierarchy before trying 90 days', () => {
    const recent = offers(20, { lane: 'elsewhere', equipment_type: 'reefer', offered_buy_rate: 1200 })
    const old = offers(5, { date: '2026-07-15' })
    expect(benchmark([...recent, ...old], 'a → b', 'flatbed', AS_OF)?.source).toBe('global')
    expect(benchmark(old, 'a → b', 'flatbed', AS_OF)?.days).toBe(90)
    expect(benchmark(offers(30, { date: '2026-09-08' }), 'a → b', 'flatbed', AS_OF)).toBeNull()
    expect(benchmark(offers(30, { date: '2026-01-01' }), 'a → b', 'flatbed', AS_OF)).toBeNull()
  })
})
it.each([[.899999, 0], [.9, 1], [.969999, 1], [.97, 2], [1.029999, 2], [1.03, 3], [1.099999, 3], [1.10, 4]])('rate index %s is in band %s', (index, band) => expect(rateBand(index)).toBe(band))
it('uses segment acceptance for a thin band, then switches at ten offers', () => {
  const rows = [...offers(20), ...offers(9, { offered_buy_rate: 900, accepted: false })]
  const b = benchmark(rows, 'a → b', 'flatbed', AS_OF)
  expect(acceptance(rows, 'new', 900, b).source).toBe('segment_fallback')
  expect(acceptance(rows, 'new', 900, b).expected).toBeCloseTo(20 / 29)
  rows.push(offerRow({ offered_buy_rate: 900, accepted: false }))
  expect(acceptance(rows, 'new', 900, benchmark(rows, 'a → b', 'flatbed', AS_OF)).expected).toBe(.10)
})
it('guards and clamps carrier factors and fallback acceptance', () => {
  const rows = [...offers(10, { carrier_id: 'high' }), ...offers(90, { carrier_id: 'low', accepted: false })]
  const b = benchmark(rows, 'a → b', 'flatbed', AS_OF)
  expect(acceptance(rows, 'high', 1000, b).factor).toBe(1.25)
  expect(acceptance(rows, 'low', 1000, b).factor).toBe(.75)
  expect(acceptance(rows, 'unknown', 1000, b).factor).toBe(1)
  expect(acceptance(rows, 'high', 1000, null).expected).toBe(.98)
  expect(acceptance(rows, 'low', 1000, null).expected).toBe(.10)
  expect(acceptance([], 'unknown', 1000, null).expected).toBeNull()
  expect(acceptance(offers(10, { accepted: false }), 'c', 1000, null).factor).toBe(1)
})
describe('rate search', () => {
  const simulate = (rate: number) => ({ coverage: rate >= 1100 ? 1.05 : rate >= 1030 ? .9 : .75, acceptance: .8 })
  it('prefers the lowest restoring candidate over an earlier material improvement', () => {
    const s = searchRates(1000, 1500, .75, simulate)
    expect(s.candidates).toHaveLength(21)
    expect(s.recommendation?.increase).toBeCloseTo(.10)
    expect(s.candidates[20].buy_rate).toBe(1200)
  })
  it('returns partial improvement when no commercially valid restoring candidate exists', () => {
    const s = searchRates(1000, 1200, .75, simulate)
    expect(s.recommendation?.increase).toBeCloseTo(.03)
    expect(s.commercialConstraint).toBe(true)
  })
  it('does not classify a non-existent restoring candidate as a commercial constraint', () => {
    expect(searchRates(1000, 1500, .75, () => ({ coverage: .9, acceptance: .8 })).commercialConstraint).toBe(false)
  })
  it('does not recommend ineffective, negative-spread, or already fulfilled changes', () => {
    expect(searchRates(1000, 1500, .75, () => ({ coverage: .75, acceptance: .8 })).recommendation).toBeNull()
    expect(searchRates(1000, 900, .75, simulate).recommendation).toBeNull()
    expect(searchRates(1000, 1500, 1.05, simulate).recommendation).toBeNull()
  })
  it('keeps unrounded rates and accepts equality at the commercial floor', () => {
    const s = searchRates(1000, 1125, .7, rate => ({ coverage: rate >= 1010 ? 1 : .7, acceptance: .8 }), undefined)
    expect(s.recommendation?.buy_rate).toBe(1010)
    expect(searchRates(1000, 1125, .7, rate => ({ coverage: rate >= 1010 ? 1 : .7, acceptance: .8 }), { ...importConfig, COMMERCIAL_FLOOR: (1125 - 1010) / 1125 }).recommendation?.buy_rate).toBe(1010)
  })
})
import { DEFAULT_CONFIG as importConfig } from '../src/analytics/config'
