import type { Analysis } from '../analytics/engine'
import { coverage, money, number, percent, TAKE_RATE_HELP } from '../ui/format'
export function Kpis({ kpis, currency }: { kpis: Analysis['kpis']; currency: string }) {
  const metrics = [
    ['Modeled fulfillment', percent(kpis.projected_fulfillment_pct), 'Surplus capacity on one lane does not fulfill another lane.'],
    ['Loads at risk', number(kpis.expected_unfulfilled), 'Fractional load-equivalents retained in the planning model.'],
    ['Effective capacity coverage', coverage(kpis.effective_capacity_coverage), 'Modeled effective capacity divided by demand.'],
    ['Modeled revenue exposure', money(kpis.modeled_revenue_exposure, currency), 'Expected unfulfilled load-equivalents weighted by sell rate; not lost revenue.'],
    ['Gross take-rate proxy', percent(kpis.gross_take_rate_proxy), TAKE_RATE_HELP],
  ]
  return <dl className="kpi-grid">{metrics.map(([name, value, help]) => <div className="kpi" key={name} title={help}>
    <dt>{name}</dt><dd>{value}</dd>
  </div>)}</dl>
}
