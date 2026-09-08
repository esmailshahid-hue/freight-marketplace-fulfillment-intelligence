import type { HistoricalOffer } from '../data/schemas'
import { clamp, mean, median } from '../utils/math'
import { localDate, addDays, DEFAULT_TIME_ZONE } from '../utils/dates'
import { DEFAULT_CONFIG, type Config } from './config'
export const RATE_BANDS = ['< 0.90', '0.90–<0.97', '0.97–<1.03', '1.03–<1.10', '>= 1.10'] as const
export const rateBand = (index: number) => index < .90 ? 0 : index < .97 ? 1 : index < 1.03 ? 2 : index < 1.10 ? 3 : 4
export function benchmark(offers: HistoricalOffer[], lane: string, equipment: string, asOf: string, config: Config = DEFAULT_CONFIG, timeZone = DEFAULT_TIME_ZONE) {
  const end = localDate(asOf, timeZone)
  for (const days of [config.RATE_LOOKBACK_DAYS, config.RATE_FALLBACK_LOOKBACK_DAYS]) {
    const window = offers.filter(r => r.date >= addDays(end, -days) && r.date <= end)
    const segments = [window.filter(r => r.lane === lane && r.equipment_type === equipment), window.filter(r => r.lane === lane), window.filter(r => r.equipment_type === equipment), window]
    const minimums = [config.MIN_ACCEPTED_RATE_SAMPLES, config.MIN_ACCEPTED_RATE_SAMPLES, config.MIN_RATE_BAND_SAMPLES, config.MIN_GLOBAL_RATE_SAMPLES]
    for (let level = 0; level < segments.length; level++) {
      const rows = segments[level], accepted = rows.filter(r => r.accepted)
      if (accepted.length < minimums[level]) continue
      const rate = median(accepted.map(r => r.offered_buy_rate))!
      return { rate, source: ['lane_equipment', 'lane', 'equipment', 'global'][level], days, samples: accepted.length, rows,
        confidence: level >= 2 ? 'Low confidence' : level === 1 || days !== config.RATE_LOOKBACK_DAYS ? 'Medium confidence' : 'High confidence' }
    }
  }
  return null
}
export type Benchmark = ReturnType<typeof benchmark>
export function acceptance(offers: HistoricalOffer[], carrier: string, buyRate: number, bench: Benchmark, config: Config = DEFAULT_CONFIG) {
  const own = offers.filter(r => r.carrier_id === carrier), market = mean(offers.map(r => +r.accepted))
  const ownRate = own.length >= config.MIN_RATE_BAND_SAMPLES ? mean(own.map(r => +r.accepted)) : null
  const factor = ownRate !== null && market !== null && market > 0 ? clamp(ownRate / market, .75, 1.25) : 1
  if (!bench) {
    const rate = ownRate ?? market
    return { expected: rate === null ? null : clamp(rate, .10, .98), factor, source: 'fallback_no_rate_benchmark', confidence: rate === null ? 'Unavailable' : ownRate !== null ? 'Medium confidence' : 'Low confidence', band: null, samples: ownRate !== null ? own.length : offers.length }
  }
  const band = rateBand(buyRate / bench.rate), rows = bench.rows.filter(r => rateBand(r.offered_buy_rate / bench.rate) === band)
  const sufficient = rows.length >= config.MIN_RATE_BAND_SAMPLES
  const selected = sufficient ? rows : bench.rows
  return { expected: clamp(mean(selected.map(r => +r.accepted))! * factor, .10, .98), factor, source: sufficient ? 'rate_band' : 'segment_fallback', confidence: bench.confidence === 'Low confidence' ? 'Low confidence' : !sufficient || bench.confidence === 'Medium confidence' ? 'Medium confidence' : 'High confidence', band: RATE_BANDS[band], samples: selected.length }
}
export interface RateCandidate { buy_rate: number; increase: number; acceptance: number; coverage: number; gross_take_rate_proxy: number }
export function searchRates(currentBuy: number, sell: number, currentCoverage: number, simulate: (rate: number) => { coverage: number; acceptance: number }, config: Config = DEFAULT_CONFIG) {
  const candidates: RateCandidate[] = []
  const steps = Math.floor(config.RATE_RECOMMENDATION_MAX_INCREASE / config.RATE_SEARCH_INCREMENT + 1e-9)
  for (let i = 0; i <= steps; i++) {
    const increase = i * config.RATE_SEARCH_INCREMENT, buy_rate = currentBuy * (1 + increase)
    candidates.push({ buy_rate, increase, ...simulate(buy_rate), gross_take_rate_proxy: (sell - buy_rate) / sell })
  }
  const higher = candidates.filter(c => c.increase > 0)
  const valid = higher.filter(c => c.gross_take_rate_proxy >= config.COMMERCIAL_FLOOR)
  const recommendation = currentBuy > sell || currentCoverage >= 1 ? null : valid.find(c => c.coverage >= 1) ?? valid.find(c => c.coverage - currentCoverage >= config.MIN_MATERIAL_COVERAGE_IMPROVEMENT) ?? null
  const restoring = higher.filter(c => c.coverage >= 1)
  const commercialConstraint = higher.some(c => c.coverage - currentCoverage >= config.MIN_MATERIAL_COVERAGE_IMPROVEMENT) && restoring.length > 0 && restoring.every(c => c.gross_take_rate_proxy < config.COMMERCIAL_FLOOR)
  return { candidates, recommendation, commercialConstraint, validMaterialImprovement: valid.some(c => c.coverage - currentCoverage >= config.MIN_MATERIAL_COVERAGE_IMPROVEMENT), current: candidates[0], commercial_floor: config.COMMERCIAL_FLOOR }
}
export type RateSearch = ReturnType<typeof searchRates>
