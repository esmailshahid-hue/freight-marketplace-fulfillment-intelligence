import type { Analysis } from '../analytics/engine'
import type { Action, PlanningBucket } from '../analytics/types'
import { DEFAULT_CONFIG } from '../analytics/config'
import { ActionTable } from '../components/ActionTable'
import { Kpis } from '../components/Kpis'
import { Badge } from '../components/Badge'
import { dateLabel, number, percent } from '../ui/format'
export function OperationsQueue({ analysis, currency, onAction, onBucket }: {
  analysis: Analysis; currency: string; onAction: (action: Action) => void; onBucket: (bucket: PlanningBucket) => void;
}) {
  const spikes = [...new Map(analysis.buckets.filter(b => b.baseline.demand_growth_pct !== null && b.baseline.demand_growth_pct >= DEFAULT_CONFIG.DEMAND_SPIKE_THRESHOLD)
    .map(b => [JSON.stringify([b.lane, b.equipment_type]), b])).values()]
    .sort((a, b) => b.baseline.demand_growth_pct! - a.baseline.demand_growth_pct!).slice(0, 5)
  const concentrations = analysis.buckets.filter(b => ['Watch', 'High'].includes(b.concentration_status))
    .sort((a, b) => b.capacity.top_carrier_share - a.capacity.top_carrier_share).slice(0, 5)
  return <>
    <h2>Operations Queue</h2>
    <p className="section-intro">Baseline · next seven days. Select an action to inspect its evidence and carrier contributions.</p>
    <Kpis kpis={analysis.kpis} currency={currency} />
    <section className="panel"><h3>Prioritized action queue <span className="muted">({analysis.actions.length})</span></h3>
      <ActionTable actions={analysis.actions} currency={currency} onSelect={onAction} />
    </section>
    <div className="two-columns">
      <section className="panel"><h3>Top upcoming demand spikes</h3>
        {!spikes.length ? <p className="empty">No demand spikes detected.</p> : <ul className="summary-list">{spikes.map(b => <li key={b.id}>
          <button className="text-button" onClick={() => onBucket(b)}>{b.lane} · {b.equipment_type}</button>
          <p><strong>+{percent(b.baseline.demand_growth_pct)}</strong> · {number(b.baseline.upcoming_7d_loads)} upcoming vs {number(b.baseline.historical_avg_weekly_loads)} weekly baseline</p>
        </li>)}</ul>}
      </section>
      <section className="panel"><h3>Carrier concentration warnings</h3>
        {!concentrations.length ? <p className="empty">No concentration warnings.</p> : <ul className="summary-list">{concentrations.map(b => <li key={b.id}>
          <button className="text-button" onClick={() => onBucket(b)}>{b.lane} · {b.equipment_type}</button>
          <p><Badge value={b.concentration_warning ?? b.concentration_status} /> Largest carrier: <strong>{percent(b.capacity.top_carrier_share)}</strong> · {dateLabel(b.pickup_date)}</p>
          <p className="muted">Concentration: {b.concentration_status}. Capacity: {b.status}.</p>
        </li>)}</ul>}
      </section>
    </div>
  </>
}
