import type { PlanningBucket } from '../analytics/types'
import { coverage, money, percent, suggestedRate } from '../ui/format'
export function RateScenario({ bucket: b }: { bucket: PlanningBucket }) {
  const recommendation = b.rate_search?.recommendation
  if (!recommendation) return <p>No modeled rate recommendation for this bucket.</p>
  return <section className="rate-scenario" aria-label="Modeled rate scenario">
    <h3>Modeled rate scenario</h3>
    <p>{suggestedRate(recommendation.buy_rate, b.currency)} (+{percent(recommendation.increase)}). For operational review.</p>
    <dl className="detail-grid">
      <div><dt>Current carrier buy rate</dt><dd>{money(b.current_buy_rate, b.currency)}</dd></div>
      <div><dt>Modeled candidate rate (unrounded calculation)</dt><dd>{money(recommendation.buy_rate, b.currency)}</dd></div>
      <div><dt>Modeled acceptance · before → after</dt><dd>{percent(b.capacity.weighted_acceptance)} → {percent(recommendation.acceptance)}</dd></div>
      <div><dt>Effective coverage · before → after</dt><dd>{coverage(b.effective_capacity_coverage)} → {coverage(recommendation.coverage)}</dd></div>
      <div><dt>Gross take-rate proxy · before → after</dt><dd>{percent(b.gross_take_rate_proxy)} → {percent(recommendation.gross_take_rate_proxy)}</dd></div>
      <div><dt>Commercial floor</dt><dd>{percent(b.rate_search!.commercial_floor)}</dd></div>
    </dl>
    <p className="muted">Modeled acceptance based on historical rate/acceptance behavior. This is not an autonomous pricing decision.</p>
  </section>
}
