import type { RateSearch } from './pricing'
import { DEFAULT_CONFIG, type Config } from './config'
export type RootCause = 'COMMERCIAL_CONSTRAINT' | 'SUPPLY_SHORTAGE' | 'PRICE_COMPETITIVENESS' | 'SERVICE_QUALITY' | 'CARRIER_CONCENTRATION' | 'LATE_BOOKING' | 'MIXED'
export function classifyRootCause(raw: number, effective: number, adjusted: number, acceptance: number, share: number, hours: number, search: RateSearch | null, config: Config = DEFAULT_CONFIG) {
  const triggered: RootCause[] = []
  if (raw >= 1 && effective < 1 && search?.commercialConstraint) triggered.push('COMMERCIAL_CONSTRAINT')
  if (raw < 1) triggered.push('SUPPLY_SHORTAGE')
  if (raw >= 1 && effective < 1 && acceptance < .70 && search?.validMaterialImprovement) triggered.push('PRICE_COMPETITIVENESS')
  if (adjusted >= 1 && effective < 1) triggered.push('SERVICE_QUALITY')
  if (share >= config.CONCENTRATION_HIGH) triggered.push('CARRIER_CONCENTRATION')
  if (hours < 24) triggered.push('LATE_BOOKING')
  const primary = effective < 1 ? triggered[0] ?? 'MIXED' : null
  return { primary, secondary: triggered.filter(c => c !== primary) }
}
