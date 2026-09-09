import type { Action, PlanningBucket } from '../analytics/types'
import { number, percent } from './format'
import { restoringCandidate } from './ratePresentation'
import { suggestedRate } from '../utils/money'
export function actionReason(action: Action, bucket?: PlanningBucket) {
  const evidence = (...prefixes: string[]) => action.evidence.filter(e => prefixes.some(p => e.startsWith(p))).join(' · ')
  switch (action.action_type) {
    case 'PREBOOK_CAPACITY': return { title: 'Demand growth', detail: `${bucket ? `${percent(bucket.baseline.demand_growth_pct)} growth · ` : ''}${evidence('Weekly demand', 'Weekly baseline')}` }
    case 'REVIEW_PAYMENT_EXPOSURE': return { title: 'Payment exposure', detail: evidence('Carrier share', 'Overdue payable') }
    case 'SECURE_CAPACITY': return { title: 'Physical supply shortage', detail: bucket ? `${number(bucket.capacity.raw)} qualified trucks / ${number(bucket.upcoming_loads)} demand · ${evidence('Raw coverage')}` : evidence('Raw coverage') }
    case 'RAISE_BUY_RATE': {
      const rec = bucket?.rate_search?.recommendation
      return { title: 'Pricing competitiveness', detail: rec ? `Acceptance ${percent(bucket!.capacity.weighted_acceptance)} → ${percent(rec.acceptance)} · Gross take-rate proxy ${percent(rec.gross_take_rate_proxy)} / floor ${percent(bucket!.rate_search!.commercial_floor)}` : evidence('Modeled acceptance', 'Candidate gross', 'Commercial floor') }
    }
    case 'ACTIVATE_BACKUP_CARRIERS': return { title: 'Carrier concentration', detail: evidence('Top carrier share') }
    case 'REVIEW_SERVICE_QUALITY': return { title: 'Service reliability', detail: bucket ? `${number(bucket.capacity.acceptance_adjusted_capacity)} capacity before reliability → ${number(bucket.capacity.effective)} effective / ${number(bucket.upcoming_loads)} demand` : evidence('Effective coverage') }
    case 'ESCALATE_COMMERCIAL_CONSTRAINT': {
      const restoring = bucket && restoringCandidate(bucket)
      return { title: 'Commercial floor', detail: restoring ? `${suggestedRate(restoring.buy_rate, bucket!.currency)} restores coverage · Gross take-rate proxy ${percent(restoring.gross_take_rate_proxy)}, below ${percent(bucket!.rate_search!.commercial_floor)} floor` : action.recommended_action }
    }
  }
}
