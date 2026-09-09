import type { CarrierCapacity, HistoricalLoad, HistoricalOffer } from '../data/schemas'
import { performance } from './reliability'
import { acceptance, type Benchmark } from './pricing'
import { DEFAULT_CONFIG, type Config } from './config'
import { sum } from '../utils/math'
export function calculateCapacity(rows: CarrierCapacity[], history: HistoricalLoad[], offers: HistoricalOffer[], lane: string, equipment: string, date: string, buyRate: number, bench: Benchmark, config: Config = DEFAULT_CONFIG) {
  const contributions = rows.filter(r => r.lane === lane && r.equipment_type === equipment && r.capacity_date === date).map(row => {
    const service = performance(history, row.carrier_id, lane, config), modeled = acceptance(offers, row.carrier_id, buyRate, bench, config)
    const exclusion = !row.active ? 'Inactive' : row.deadhead_km_to_origin > config.MAX_DEADHEAD_KM ? 'Deadhead exceeds threshold' : service.reliability === null ? 'Reliability unavailable' : service.reliability < config.MIN_RELIABILITY ? 'Failed reliability threshold' : null
    const qualified = exclusion === null
    return { ...row, service, modeled, qualified, exclusion, effective: qualified && modeled.expected !== null ? row.available_trucks * modeled.expected * service.reliability! : 0 }
  })
  const qualified = contributions.filter(r => r.qualified)
  const raw = sum(qualified, r => r.available_trucks), effective = sum(qualified, r => r.effective)
  const adjusted = sum(qualified, r => r.available_trucks * (r.modeled.expected ?? 0))
  // Capacity blocks remain additive; concentration measures the carrier relationship.
  const totals = new Map<string, { carrier_id: string; carrier_name: string; effective: number; capacity_ids: string[] }>()
  for (const row of qualified) {
    const carrier = totals.get(row.carrier_id) ?? { carrier_id: row.carrier_id, carrier_name: row.carrier_name, effective: 0, capacity_ids: [] }
    carrier.effective += row.effective
    carrier.capacity_ids.push(row.capacity_id)
    totals.set(row.carrier_id, carrier)
  }
  const carriers = [...totals.values()].map(c => ({ ...c, effective_share: effective ? c.effective / effective : 0 }))
  return { raw, effective, acceptance_adjusted_capacity: adjusted, weighted_acceptance: raw ? adjusted / raw : 0,
    estimate_available: qualified.every(r => r.modeled.expected !== null),
    top_carrier_share: Math.max(0, ...carriers.map(c => c.effective_share)), carriers,
    contributions: contributions.map(r => ({ ...r, effective_share: effective ? r.effective / effective : 0 })) }
}
export type Capacity = ReturnType<typeof calculateCapacity>
