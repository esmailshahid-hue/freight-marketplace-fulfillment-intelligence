import type { Datasets, SampleMetadata } from './schemas'
import { addDays } from '../utils/dates'
export const SAMPLE_METADATA: SampleMetadata = { sample_as_of: '2026-09-07T08:00:00+03:00', currency: 'SAR', seed: 42 }
export const SAMPLE_LANES = [
  ['Jeddah Islamic Port', 'Riyadh', 'Flatbed', 'Ports', 'port'],
  ['Jubail', 'Tabuk', 'Lowbed', 'Projects', 'shortage'],
  ['Dammam', 'Riyadh', 'Reefer', 'Domestic', 'commercial'],
  ['Riyadh', 'Jeddah', 'Dry Van', 'Domestic', 'concentration'],
  ['Jeddah', 'Jubail', 'Flatbed', 'Domestic', 'service'],
  ['Riyadh', 'Dammam', 'Dry Van', 'Domestic', 'healthy'],
  ['Jeddah', 'Dammam', 'Reefer', 'Domestic', 'healthy'],
  ['Dammam', 'Jubail', 'Tanker', 'Domestic', 'healthy'],
  ['Jubail', 'Riyadh', 'Flatbed', 'Projects', 'healthy'],
  ['Riyadh', 'Generic Border Hub', 'Dry Van', 'Cross-Border', 'healthy'],
  ['Jeddah Islamic Port', 'Jubail', 'Flatbed', 'Ports', 'healthy'],
  ['Tabuk', 'NEOM Region', 'Lowbed', 'Projects', 'healthy'],
] as const
// Illustrative SAR economics, not live market quotes. Long-haul lowbed/project
// moves cost more than short domestic tanker work; border work includes a premium.
const LANE_BUY_BASES = [3200, 6500, 2400, 3000, 3800, 1800, 4600, 1200, 2200, 5100, 4100, 2700]
const SELL_MULTIPLIERS = [1.26, 1.23, 1.065, 1.19, 1.22, 1.18, 1.20, 1.15, 1.24, 1.27, 1.19, 1.24]
// Four home carriers plus a regional carrier from another lane. Most shared
// assignments use the same equipment family; tanker operators have mixed fleets.
const SHARED_CARRIER_HOME = [4, 11, 6, 5, 8, 9, 2, 10, 0, 3, 7, 1]
const carrierId = (index: number) => `C${String(index + 1).padStart(3, '0')}`
const roundRate = (rate: number) => Math.round(rate / 5) * 5

export function generateSynthetic(seed = 42): Datasets {
  let state = seed >>> 0
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296 }
  const between = (low: number, high: number) => low + random() * (high - low)
  const shuffle = <T>(values: T[]) => {
    const out = [...values]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
  // Stratified outcomes retain realistic small-sample service/acceptance rates
  // without accidental all-good/all-bad histories. Their order is seeded, not periodic.
  const outcomes = (count: number, rate: number) => {
    const successes = Math.round(count * rate)
    return shuffle(Array.from({ length: count }, (_, i) => i < successes))
  }
  const profiles = Array.from({ length: 48 }, (_, index) => ({
    carrier_id: carrierId(index), ratePremium: between(-.007, .007), acceptanceBias: between(-.035, .035),
    pickup: between(.925, .965), delivery: between(.895, .95), cancellation: between(.035, .065),
  }))
  const data: Datasets = { upcoming: [], capacity: [], historical: [], offers: [], payments: [] }
  SAMPLE_LANES.forEach(([origin, destination, equipment_type, business_unit, scenario], li) => {
    const lane = `${origin} → ${destination}`, baseBuy = LANE_BUY_BASES[li], baseSell = baseBuy * SELL_MULTIPLIERS[li]
    const carriers = [...profiles.slice(li * 4, li * 4 + 4), profiles[SHARED_CARRIER_HOME[li] * 4]]
    const historyCount = scenario === 'port' ? 240 : scenario === 'shortage' ? 120 : 84
    const services = carriers.map((carrier, ci) => {
      const count = Math.floor((historyCount - 1 - ci) / carriers.length) + 1
      return {
        pickup: outcomes(count, carrier.pickup - (scenario === 'service' ? .12 : 0)),
        delivery: outcomes(count, carrier.delivery - (scenario === 'service' ? .12 : 0)),
        cancelled: outcomes(count, carrier.cancellation + (scenario === 'service' ? .06 : 0)),
      }
    })
    // Preserve the weekly volume envelope (including the 35% port spike), but
    // randomize days within each complete week rather than evenly spacing all loads.
    for (let i = 0; i < historyCount; i++) {
      const ci = i % carriers.length, n = Math.floor(i / carriers.length), carrier = carriers[ci], service = services[ci]
      const nominalDay = scenario === 'port' ? i < 160 ? 1 + Math.floor(i * 56 / 160) : 57 + Math.floor((i - 160) * 34 / 80) : scenario === 'shortage' ? 1 + Math.floor(i * 90 / historyCount) : i === historyCount - 1 ? 90 : 1 + Math.floor(i * 56 / (historyCount - 1))
      const daysAgo = nominalDay === 90 ? 90 : Math.min(90, Math.floor((nominalDay - 1) / 7) * 7 + 1 + Math.floor(random() * 7))
      const cancelled = service.cancelled[n], unassigned = scenario === 'shortage' && !cancelled && random() < .30
      const failed = cancelled || unassigned
      data.historical.push({
        load_id: `H${li}-${i}`, date: addDays('2026-09-07', -daysAgo), customer: `Synthetic Customer ${1 + Math.floor(random() * 7)}`,
        business_unit, origin, destination, lane, equipment_type, carrier_id: unassigned ? null : carrier.carrier_id,
        sell_rate: roundRate(baseSell * between(.98, 1.025)),
        final_buy_rate: unassigned ? null : roundRate(baseBuy * (between(.965, 1.045) + carrier.ratePremium)),
        fulfilled: !failed, pickup_ontime: unassigned ? null : service.pickup[n], delivery_ontime: unassigned ? null : service.delivery[n],
        cancelled, failure_reason: unassigned ? 'No specialized equipment available' : cancelled ? 'Carrier cancellation' : null, currency: 'SAR',
      })
    }
    // Each carrier sees discounted, market-level and premium offers across the
    // full history window. Price levels and observed outcomes both vary by carrier.
    carriers.forEach(carrier => {
      const segments = [
        { count: 16, low: .91, high: .945, acceptance: .32 },
        { count: 32, low: .985, high: 1.02, acceptance: .95 },
        { count: 16, low: 1.045, high: 1.115, acceptance: .94 },
      ]
      let offerNumber = 0
      for (const segment of segments) {
        const accepted = outcomes(segment.count, segment.acceptance + carrier.acceptanceBias)
        for (let n = 0; n < segment.count; n++) {
          // Recent observations in every stratum, plus a long tail back to day 90.
          const daysAgo = n % 3 === 0 ? 31 + Math.floor(random() * 60) : 1 + Math.floor(random() * 29)
          data.offers.push({
            offer_id: `O${li}-${carrier.carrier_id}-${offerNumber++}`, load_id: null, date: addDays('2026-09-07', -daysAgo),
            lane, equipment_type, carrier_id: carrier.carrier_id,
            offered_buy_rate: roundRate(baseBuy * (between(segment.low, segment.high) + carrier.ratePremium)), accepted: accepted[n],
            sell_rate: roundRate(baseSell * between(.98, 1.025)), currency: 'SAR',
          })
        }
      }
    })
    const days = scenario === 'port' ? [0, 2, 4] : [1 + li % 6]
    for (const day of days) {
      const date = addDays('2026-09-07', day), count = scenario === 'port' ? 9 : scenario === 'service' || scenario === 'concentration' ? 10 : 12
      // Multiple commercially distinct batches within each daily planning bucket.
      const batchCounts = [Math.floor(count / 2), count - Math.floor(count / 2)]
      batchCounts.forEach((load_count, batch) => data.upcoming.push({
        load_id: `U${li}-${day}-${batch}`, customer: `Synthetic Customer ${1 + (li + batch) % 7}`, business_unit, origin, destination, lane, equipment_type,
        pickup_datetime: `${date}T20:00:00+03:00`, sell_rate: roundRate(baseSell * between(.995, 1.005)),
        planned_buy_rate: roundRate(baseBuy * ((scenario === 'port' || scenario === 'commercial' ? .925 : 1.005) + between(-.003, .003))),
        priority: scenario === 'shortage' ? 'Critical' : scenario === 'port' ? 'High' : 'Standard', load_count, currency: 'SAR',
      }))
      const trucks = scenario === 'port' ? [3, 2, 2, 2, 2] : scenario === 'shortage' ? [2, 2, 2, 1, 1] : scenario === 'commercial' ? [3, 3, 3, 3, 3] : scenario === 'service' ? [3, 3, 2, 2, 2] : scenario === 'concentration' ? [8, 2, 2, 2, 2] : [4, 4, 4, 3, 3]
      carriers.forEach((carrier, ci) => {
        // Two non-overlapping blocks from the dominant carrier exercise aggregation.
        const blocks = scenario === 'concentration' && ci === 0 ? [4, 4] : [trucks[ci]]
        blocks.forEach((available_trucks, block) => data.capacity.push({
          capacity_id: `K${li}-${day}-${ci}-${block}`, carrier_id: carrier.carrier_id, carrier_name: `Synthetic Carrier ${carrier.carrier_id}`,
          lane, equipment_type, capacity_date: date, available_trucks, deadhead_km_to_origin: 20 + Math.floor(random() * 100), active: true,
          contract_status: ci < 2 ? 'Preferred' : ci < 4 ? 'Contract' : 'Spot',
        }))
      })
    }
  })
  // One payment row per carrier, regardless of the number of lanes it serves.
  data.payments = profiles.map((carrier, index) => ({
    carrier_id: carrier.carrier_id, open_payable: Math.round(between(20000, 120000)), overdue_payable: index === 0 ? 18000 : 0,
    max_days_overdue: index === 0 ? 22 : 0, last_payment_date: addDays('2026-09-07', -Math.ceil(between(2, 14))),
    payment_status: index === 0 ? 'Overdue' : 'Current', currency: 'SAR',
  }))
  return data
}
