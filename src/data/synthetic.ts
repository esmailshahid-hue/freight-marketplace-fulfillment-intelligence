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
export function generateSynthetic(seed = 42): Datasets {
  let state = seed >>> 0
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296 }
  const data: Datasets = { upcoming: [], capacity: [], historical: [], offers: [], payments: [] }
  SAMPLE_LANES.forEach(([origin, destination, equipment_type, business_unit, scenario], li) => {
    const lane = `${origin} → ${destination}`, sell = scenario === 'shortage' ? 4000 : scenario === 'commercial' ? 1050 : 1400
    const carriers = Array.from({ length: 4 }, (_, c) => `C${String(li * 4 + c + 1).padStart(3, '0')}`)
    const historyCount = scenario === 'port' ? 240 : scenario === 'shortage' ? 120 : 84
    for (let i = 0; i < historyCount; i++) {
      const ci = i % 4, n = Math.floor(i / 4)
      const daysAgo = scenario === 'port' ? i < 160 ? 1 + Math.floor(i * 56 / 160) : 57 + Math.floor((i - 160) * 34 / 80) : scenario === 'shortage' ? 1 + Math.floor(i * 90 / historyCount) : i === historyCount - 1 ? 90 : 1 + Math.floor(i * 56 / (historyCount - 1))
      const cancelled = scenario === 'service' ? n % 7 === 0 : n % 25 === 0
      const failed = cancelled || (scenario === 'shortage' && i % 3 === 0)
      data.historical.push({ load_id: `H${li}-${i}`, date: addDays('2026-09-07', -daysAgo), customer: `Synthetic Customer ${1 + i % 7}`, business_unit, origin, destination, lane, equipment_type, carrier_id: carriers[ci], sell_rate: sell, final_buy_rate: 1000, fulfilled: !failed,
        pickup_ontime: scenario === 'service' ? n % 5 !== 0 : n % 25 !== 0,
        delivery_ontime: scenario === 'service' ? n % 5 !== 0 : n % 25 > 1,
        cancelled, failure_reason: failed ? scenario === 'shortage' ? 'Unfilled specialized capacity' : 'Cancelled' : null, currency: 'SAR' })
    }
    for (let ci = 0; ci < 4; ci++) for (let n = 0; n < 80; n++) {
      const weak = n < 40
      data.offers.push({ offer_id: `O${li}-${ci}-${n}`, load_id: null, date: addDays('2026-09-07', -(n < 60 ? 1 + n % 29 : 31 + Math.floor((n - 60) * 59 / 19))), lane, equipment_type, carrier_id: carriers[ci], offered_buy_rate: weak ? 900 : 1000,
        accepted: weak ? n % 10 < 3 : n % 25 !== 0, sell_rate: sell, currency: 'SAR' })
    }
    const days = scenario === 'port' ? [0, 2, 4] : [1 + li % 6]
    for (const day of days) {
      const date = addDays('2026-09-07', day), count = scenario === 'port' ? 9 : scenario === 'service' || scenario === 'concentration' ? 10 : 12
      data.upcoming.push({ load_id: `U${li}-${day}`, customer: `Synthetic Customer ${1 + li % 7}`, business_unit, origin, destination, lane, equipment_type, pickup_datetime: `${date}T20:00:00+03:00`, sell_rate: sell, planned_buy_rate: scenario === 'port' || scenario === 'commercial' ? 900 : 1000, priority: scenario === 'shortage' ? 'Critical' : scenario === 'port' ? 'High' : 'Standard', load_count: count, currency: 'SAR' })
      const trucks = scenario === 'port' ? [3, 3, 3, 2] : scenario === 'shortage' ? [2, 2, 2, 2] : scenario === 'commercial' ? [4, 4, 4, 3] : scenario === 'service' ? [3, 3, 3, 3] : scenario === 'concentration' ? [8, 3, 3, 2] : [5, 5, 4, 4]
      carriers.forEach((carrier_id, ci) => data.capacity.push({ capacity_id: `K${li}-${day}-${ci}`, carrier_id, carrier_name: `Synthetic Carrier ${carrier_id}`, lane, equipment_type, capacity_date: date, available_trucks: trucks[ci], deadhead_km_to_origin: 20 + Math.floor(random() * 100), active: true, contract_status: ci === 0 ? 'Preferred' : ci === 1 ? 'Contract' : 'Spot' }))
    }
    carriers.forEach((carrier_id, ci) => data.payments!.push({ carrier_id, open_payable: 20000 + Math.floor(random() * 40000), overdue_payable: scenario === 'port' && ci === 0 ? 12000 : 0, max_days_overdue: scenario === 'port' && ci === 0 ? 22 : 0, last_payment_date: addDays('2026-09-07', -7), payment_status: scenario === 'port' && ci === 0 ? 'Overdue' : 'Current', currency: 'SAR' }))
  })
  return data
}
