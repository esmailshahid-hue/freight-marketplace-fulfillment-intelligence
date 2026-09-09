import { it, expect } from 'vitest'
import { generateSynthetic, SAMPLE_METADATA } from '../src/data/synthetic'
import { analyze } from '../src/analytics/engine'
import { median, mean } from '../src/utils/math'
import { serializeDatasets } from '../src/data/sampleLoader'
import { validateCsv } from '../src/data/validation'

const data = generateSynthetic()
const result = analyze(data, SAMPLE_METADATA.sample_as_of)

it('gives a meaningful carrier subset real cross-lane history, offers and declared capacity', () => {
  const carriers = new Set(data.capacity.map(c => c.carrier_id))
  const shared = [...carriers].filter(id => new Set(data.capacity.filter(c => c.carrier_id === id).map(c => c.lane)).size > 1)
  expect(shared.length).toBeGreaterThanOrEqual(12)
  expect(shared.length / carriers.size).toBeGreaterThanOrEqual(.25)
  for (const id of shared) {
    const lanes = [...new Set(data.capacity.filter(c => c.carrier_id === id).map(c => c.lane))]
    for (const lane of lanes) {
      expect(data.historical.filter(h => h.carrier_id === id && h.lane === lane).length).toBeGreaterThanOrEqual(5)
      expect(data.offers.filter(o => o.carrier_id === id && o.lane === lane).length).toBeGreaterThanOrEqual(10)
    }
  }
  expect(data.payments).toHaveLength(carriers.size)
  expect(new Set(data.payments!.map(p => p.carrier_id)).size).toBe(carriers.size)
})

it('varies lane economics and offers/final buys within every lane with bounded dispersion', () => {
  const buyMedians: number[] = [], sellMedians: number[] = []
  for (const lane of new Set(data.historical.map(h => h.lane))) {
    const history = data.historical.filter(h => h.lane === lane)
    const offers = data.offers.filter(o => o.lane === lane)
    const finalBuys = history.flatMap(h => h.final_buy_rate === null ? [] : [h.final_buy_rate])
    const base = median(finalBuys)!
    buyMedians.push(base); sellMedians.push(median(history.map(h => h.sell_rate))!)
    expect(new Set(offers.map(o => o.offered_buy_rate)).size).toBeGreaterThanOrEqual(25)
    expect(new Set(finalBuys).size).toBeGreaterThanOrEqual(10)
    expect(new Set(history.map(h => h.sell_rate)).size).toBeGreaterThanOrEqual(6)
    // Wide enough to contain discounts/premiums, narrow enough to catch arbitrary prices.
    expect(offers.every(o => o.offered_buy_rate / base >= .85 && o.offered_buy_rate / base <= 1.2)).toBe(true)
    expect(finalBuys.every(rate => rate / base >= .9 && rate / base <= 1.1)).toBe(true)
    expect(history.every(h => !h.fulfilled || !h.cancelled)).toBe(true)
  }
  expect(new Set(buyMedians).size).toBe(12)
  expect(new Set(sellMedians).size).toBe(12)
  expect(Math.max(...buyMedians) / Math.min(...buyMedians)).toBeGreaterThan(4)
})

it('preserves carrier variation and a predominantly healthy historical baseline', () => {
  const carriers = [...new Set(data.offers.map(o => o.carrier_id))]
  const acceptance = carriers.map(id => mean(data.offers.filter(o => o.carrier_id === id).map(o => +o.accepted))!)
  expect(new Set(acceptance).size).toBeGreaterThanOrEqual(4)
  expect(Math.max(...acceptance) - Math.min(...acceptance)).toBeGreaterThan(.02)
  const services = result.buckets.flatMap(b => b.capacity.carriers.map(c => b.capacity.contributions.find(r => r.carrier_id === c.carrier_id)!.service.reliability))
  expect(new Set(services).size).toBeGreaterThanOrEqual(6)
  const healthyLanes = result.buckets.filter(b => b.effective_capacity_coverage >= 1.2).map(b => b.lane)
  const healthyHistory = data.historical.filter(h => healthyLanes.includes(h.lane.toLowerCase()))
  expect(healthyHistory.length).toBeGreaterThan(500)
  expect(mean(healthyHistory.map(h => +h.fulfilled))).toBeGreaterThanOrEqual(.90)
  expect(mean(healthyHistory.map(h => +h.fulfilled))).toBeLessThanOrEqual(.96)
  expect(new Set(data.historical.map(h => h.date)).size).toBeGreaterThanOrEqual(70)
  expect(new Set(data.offers.map(o => o.date)).size).toBeGreaterThanOrEqual(80)
  expect(validateCsv(serializeDatasets(data), SAMPLE_METADATA.sample_as_of).errors).toEqual([])
})

it('plants dominant carrier blocks that require aggregation rather than a single large row', () => {
  const b = result.buckets.find(b => b.lane === 'riyadh → jeddah')!
  expect(Math.max(...b.capacity.contributions.map(c => c.effective_share))).toBeLessThan(.45)
  expect(b.capacity.top_carrier_share).toBeGreaterThanOrEqual(.45)
  expect(b.capacity.carriers.some(c => c.capacity_ids.length === 2)).toBe(true)
})
