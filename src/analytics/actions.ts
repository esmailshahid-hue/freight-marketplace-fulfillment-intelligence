import type { CarrierPayment } from '../data/schemas'
import type { Action, ActionType, PlanningBucket } from './types'
import { DEFAULT_CONFIG, type Config } from './config'
import { key, normalize, clamp } from '../utils/math'
import { riskBand } from './risk'
const pct = (n: number) => `${(n * 100).toFixed(1)}%`
export function prioritizeActions(actions: Action[], config: Config = DEFAULT_CONFIG): Action[] {
  return actions.map(a => {
    const score = clamp(.40 * normalize(a.loads_exposed, actions.map(x => x.loads_exposed)) + .25 * a.pickup_urgency + .20 * normalize(a.modeled_revenue_exposure, actions.map(x => x.modeled_revenue_exposure)) + .15 * a.risk_score, 0, 100)
    return { ...a, action_priority_score: score, severity: riskBand(score, config) }
  }).sort((a, b) => b.action_priority_score - a.action_priority_score || a.action_id.localeCompare(b.action_id))
}
export function generateActions(buckets: PlanningBucket[], payments?: CarrierPayment[], config: Config = DEFAULT_CONFIG) {
  const actions: Action[] = [], prebooked = new Set<string>()
  for (const b of [...buckets].sort((a, z) => a.pickup_date.localeCompare(z.pickup_date))) {
    const add = (type: ActionType, text: string, extra: string[] = [], carrier?: string) => actions.push({
      action_id: key(type, type === 'PREBOOK_CAPACITY' ? key(b.lane, b.equipment_type) : b.id, carrier ?? ''),
      action_type: type, severity: 'Low', lane: b.lane, equipment_type: b.equipment_type, pickup_date: b.pickup_date,
      loads_exposed: b.expected_unfulfilled, risk_score: b.risk.score, root_cause: b.root_cause.primary,
      modeled_revenue_exposure: b.modeled_revenue_exposure, evidence: [
        `Raw coverage ${pct(b.raw_capacity_coverage)}`, `Effective coverage ${pct(b.effective_capacity_coverage)}`,
        `Modeled acceptance ${pct(b.capacity.weighted_acceptance)}`, `Gross take-rate proxy ${pct(b.gross_take_rate_proxy)}`, ...extra,
      ], recommended_action: text, action_priority_score: 0, pickup_urgency: b.risk.components.urgency, ...(carrier ? { carrier_id: carrier } : {}),
    })
    const rec = b.rate_search?.recommendation
    // Commercial root-cause prohibition is explicit in planted scenario C.
    if (b.effective_capacity_coverage < 1 && b.raw_capacity_coverage >= 1 && b.root_cause.primary !== 'COMMERCIAL_CONSTRAINT' && rec && (rec.coverage >= 1 || rec.coverage - b.effective_capacity_coverage >= config.MIN_MATERIAL_COVERAGE_IMPROVEMENT))
      add('RAISE_BUY_RATE', `Model a carrier buy-rate increase from ${b.currency} ${b.current_buy_rate.toFixed(0)} to approximately ${b.currency} ${Math.round(rec.buy_rate / 25) * 25}. Historical rate/acceptance behavior suggests modeled acceptance could move from ${pct(b.capacity.weighted_acceptance)} to ${pct(rec.acceptance)}, improving effective capacity coverage from ${pct(b.effective_capacity_coverage)} to ${pct(rec.coverage)} while keeping the gross take-rate proxy above the configured floor.`, [`Candidate gross take-rate proxy ${pct(rec.gross_take_rate_proxy)}`, `Commercial floor ${pct(config.COMMERCIAL_FLOOR)}`])
    if (b.raw_capacity_coverage < 1) add('SECURE_CAPACITY', `Secure approximately ${Math.ceil(b.upcoming_loads - b.capacity.raw)} additional qualified trucks for this lane/equipment/date. Current physical capacity covers only ${pct(b.raw_capacity_coverage)} of upcoming demand, so price changes alone cannot close the gap.`)
    if (b.capacity.top_carrier_share >= config.CONCENTRATION_HIGH && b.upcoming_loads >= 5) add('ACTIVATE_BACKUP_CARRIERS', `Activate backup carrier capacity. The largest carrier represents ${pct(b.capacity.top_carrier_share)} of modeled effective capacity for ${b.upcoming_loads} upcoming loads.`, [`Top carrier share ${pct(b.capacity.top_carrier_share)}`])
    if (b.root_cause.primary === 'COMMERCIAL_CONSTRAINT') add('ESCALATE_COMMERCIAL_CONSTRAINT', 'Escalate the commercial trade-off. The rate increase needed to restore modeled coverage would push the gross take-rate proxy below the configured floor. Review shipper pricing, service commitment, or alternate capacity rather than raising carrier rates automatically.')
    const pair = key(b.lane, b.equipment_type)
    if (!prebooked.has(pair) && b.baseline.demand_growth_pct !== null && b.baseline.demand_growth_pct >= config.DEMAND_SPIKE_THRESHOLD && b.baseline.upcoming_7d_loads >= 5) {
      add('PREBOOK_CAPACITY', `Pre-book incremental carrier capacity. Upcoming 7-day demand is ${pct(b.baseline.demand_growth_pct)} above the recent weekly baseline on this lane/equipment combination.`, [`Weekly demand ${b.baseline.upcoming_7d_loads}`, `Weekly baseline ${b.baseline.historical_avg_weekly_loads}`])
      prebooked.add(pair)
    }
    if (b.root_cause.primary === 'SERVICE_QUALITY') add('REVIEW_SERVICE_QUALITY', 'Shift planned volume toward more reliable qualified carriers or secure backup capacity. Physical supply is adequate before service reliability is applied, but reliability-adjusted capacity falls below demand.')
    if (b.effective_capacity_coverage < 1) {
      for (const p of payments ?? []) {
        const share = b.capacity.contributions.filter(r => r.carrier_id === p.carrier_id).reduce((n, r) => n + r.effective_share, 0)
        if (p.payment_status === 'Overdue' && p.overdue_payable > 0 && share >= .15) add('REVIEW_PAYMENT_EXPOSURE', `Review payment exposure for Carrier ${p.carrier_id}. It contributes ${pct(share)} of modeled effective capacity on an at-risk lane and currently has ${p.currency} ${p.overdue_payable} overdue. This is an operational relationship flag only; v1 does not assume payment status causes capacity loss.`, [`Carrier share ${pct(share)}`, `Overdue payable ${p.overdue_payable}`], p.carrier_id)
      }
    }
  }
  return prioritizeActions(actions, config)
}
