import { clamp } from '../utils/math'
import { DEFAULT_CONFIG, type Config } from './config'
export const urgency = (hours: number) => hours < 12 ? 100 : hours < 24 ? 80 : hours < 48 ? 60 : hours < 72 ? 35 : 10
export const concentrationRisk = (share: number) => share < .25 ? 10 : share < .35 ? 30 : share < .45 ? 60 : 90
export const riskBand = (score: number, config: Config = DEFAULT_CONFIG): 'Critical' | 'High' | 'Medium' | 'Low' => score >= config.CRITICAL_RISK ? 'Critical' : score >= config.HIGH_RISK ? 'High' : score >= config.MEDIUM_RISK ? 'Medium' : 'Low'
export function calculateRisk(coverage: number, hours: number, acceptance: number, topShare: number, pricingAvailable: boolean, config: Config = DEFAULT_CONFIG) {
  const components = { capacity: clamp(((1.20 - coverage) / .70) * 100, 0, 100), urgency: urgency(hours), rate: clamp(100 * (1 - acceptance), 0, 100), concentration: concentrationRisk(topShare) }
  const score = clamp(.45 * components.capacity + .20 * components.urgency + .20 * components.rate + .15 * components.concentration, 0, 100), band = riskBand(score, config)
  const factors = [
    { score: .45 * components.capacity, text: `effective capacity covers ${(coverage * 100).toFixed(1)}% of demand` },
    { score: .20 * components.urgency, text: `pickup is in ${hours.toFixed(1)} hours` },
    { score: .20 * components.rate, text: `modeled acceptance is ${(acceptance * 100).toFixed(1)}%` },
    { score: .15 * components.concentration, text: `largest carrier represents ${(topShare * 100).toFixed(1)}% of effective capacity` },
  ].sort((a, b) => b.score - a.score)
  return { score, band, components, reason: `${band} risk: ${factors.slice(0, 3).map(f => f.text).join('; ')}.${pricingAvailable ? '' : ' Limited pricing history; rate benchmark unavailable.'}` }
}
