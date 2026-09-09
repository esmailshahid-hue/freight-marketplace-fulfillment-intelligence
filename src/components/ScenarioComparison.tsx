import type { Analysis } from '../analytics/engine'
import { money, moneyChange, moneyDigits, number, percent } from '../ui/format'
import { changeLabel, displayedChange } from '../ui/comparison'

export function ScenarioComparison({ baseline, scenario, currency }: { baseline: Analysis['kpis']; scenario: Analysis['kpis']; currency: string }) {
  const metrics = [
    { name: 'Modeled fulfillment', before: baseline.projected_fulfillment_pct, after: scenario.projected_fulfillment_pct, format: percent, scale: 100, unit: ' pp', better: 1 },
    { name: 'Loads at risk', before: baseline.expected_unfulfilled, after: scenario.expected_unfulfilled, format: number, scale: 1, unit: ' loads', better: -1 },
    { name: 'Modeled revenue exposure', before: baseline.modeled_revenue_exposure, after: scenario.modeled_revenue_exposure, format: (v: number | null) => money(v, currency), scale: 1, unit: ` ${currency}`, better: -1 },
  ]
  return <div className="scenario-comparison">{metrics.map(m => {
    const digits = m.unit === ` ${currency}` ? moneyDigits(currency) : 1
    const displayed = displayedChange(m.before, m.after, m.scale, digits)
    return <article key={m.name}><h4>{m.name}</h4><p className="comparison-values"><span>{m.format(m.before)}<small>Baseline</small></span><span aria-hidden="true">→</span><strong>{m.format(m.after)}<small>Scenario</small></strong></p>
      <p title={m.unit === ' pp' ? 'Change in percentage points' : undefined} className={`metric-delta ${displayed === null || displayed === 0 ? 'muted' : displayed * m.better > 0 ? 'improving' : 'negative'}`}>{m.unit === ` ${currency}` ? moneyChange(m.before, m.after, currency) : changeLabel(m.before, m.after, m.unit, m.scale, digits)}</p>
    </article>
  })}</div>
}
