import type { HistoricalLoad } from '../data/schemas'
import { clamp, mean } from '../utils/math'
import { DEFAULT_CONFIG, type Config } from './config'
export function reliabilityFactor(pickup: number, delivery: number, cancellation: number) { return clamp(0.50 * pickup + 0.30 * delivery + 0.20 * (1 - cancellation)) }
export function performance(history: HistoricalLoad[], carrier: string, lane: string, config: Config = DEFAULT_CONFIG) {
  const assigned = history.filter(r => r.carrier_id), own = assigned.filter(r => r.carrier_id === carrier), local = own.filter(r => r.lane === lane)
  const source = local.length >= config.MIN_PERFORMANCE_SAMPLES ? 'carrier_lane' : own.length >= config.MIN_PERFORMANCE_SAMPLES ? 'carrier_overall' : 'marketplace_fallback'
  const rows = source === 'carrier_lane' ? local : source === 'carrier_overall' ? own : assigned
  const pickup = mean(rows.flatMap(r => r.pickup_ontime === null ? [] : [+r.pickup_ontime]))
  const delivery = mean(rows.flatMap(r => r.delivery_ontime === null ? [] : [+r.delivery_ontime]))
  const cancellation = mean(rows.map(r => +r.cancelled))
  const reliability = pickup === null || delivery === null || cancellation === null ? null : reliabilityFactor(pickup, delivery, cancellation)
  return { source, samples: rows.length, pickup, delivery, cancellation, reliability,
    confidence: reliability === null ? 'Unavailable' : source === 'carrier_lane' ? 'High confidence' : source === 'carrier_overall' ? 'Medium confidence' : 'Low confidence' }
}
export type Performance = ReturnType<typeof performance>
