import { useDisplayLabels } from '../ui/displayLabels'
import type { Analysis } from '../analytics/engine'
import type { Action } from '../analytics/types'
import { actionsForBucket, bucketForAction } from '../ui/selectors'
import { dateLabel, label, money, number } from '../ui/format'
import { Badge } from './Badge'
import { CoverageBar } from './CoverageBar'

export function NeedsAttention({ analysis, onAction }: { analysis: Analysis; onAction: (action: Action) => void }) {
  const { laneLabel, equipmentLabel } = useDisplayLabels()
  // First appearance in the engine's action order determines group order. Never add action exposures together.
  const groups = [...new Map(analysis.actions.map(a => bucketForAction(a, analysis.buckets)).filter(b => b !== undefined).map(b => [b.id, b])).values()]
  return <section className="attention" aria-labelledby="attention-title">
    <div className="section-heading"><h3 id="attention-title">Needs attention</h3><span className="muted">{groups.length > 3 ? `First 3 of ${groups.length} lane / date groups · action priority order` : `${groups.length} lane / date groups`}</span></div>
    {!groups.length ? <p className="empty">No actions needed.</p> : <div className="attention-grid">{groups.slice(0, 3).map((b, i) => {
      const actions = actionsForBucket(b, analysis.actions)
      return <article className={`attention-card urgency-${b.risk.band.toLowerCase()}`} key={b.id}>
        <div className="attention-top"><span className="rank-label">{String(i + 1).padStart(2, '0')}</span><span className="risk-label">Risk <Badge value={b.risk.band} /></span></div>
        <h4 className="lane-title">{laneLabel(b.lane)}</h4><p className="muted">{equipmentLabel(b.equipment_type)} · {dateLabel(b.pickup_date)}</p>
        <p className="problem-label">{b.root_cause.primary ? label(b.root_cause.primary) : b.concentration_warning ? 'Carrier concentration' : label(actions[0].action_type)}</p>
        <div className="exposure-line"><strong>{number(b.expected_unfulfilled)} <small>loads at risk</small></strong><span title="Modeled revenue exposure">{money(b.modeled_revenue_exposure, b.currency)}<small>Modeled revenue exposure</small></span></div>
        <div className="capacity-comparison"><span>{b.capacity.estimate_available ? number(b.capacity.effective) : 'Unavailable'} effective / {number(b.upcoming_loads)} demand</span><CoverageBar value={b.effective_capacity_coverage} /></div>
        <div className="group-actions"><span className="eyebrow">Recommended actions</span>{actions.map(a => <button className="text-button" key={a.action_id} title={a.recommended_action} onClick={() => onAction(a)}>{label(a.action_type)} <span aria-hidden="true">↗</span></button>)}</div>
      </article>
    })}</div>}
  </section>
}
