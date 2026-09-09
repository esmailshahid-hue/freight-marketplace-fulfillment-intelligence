import { useEffect, useRef } from 'react'
import type { Action, PlanningBucket } from '../analytics/types'
import { Badge } from './Badge'
import { Table } from './Table'
import { RateScenario } from './RateScenario'
import { actionsForBucket } from '../ui/selectors'
import { coverage, dateLabel, label, money, number, percent, TAKE_RATE_HELP } from '../ui/format'
export interface BucketSelection { bucket: PlanningBucket; actions: Action[]; context: 'Baseline' | 'Scenario'; actionId?: string }
export function BucketDrawer({ selection, onClose }: { selection: BucketSelection; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!, previous = document.activeElement as HTMLElement | null
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [])
  const b = selection.bucket, actions = actionsForBucket(b, selection.actions)
  const metrics = [
    ['Upcoming demand', number(b.upcoming_loads)], ['Raw qualified capacity', number(b.capacity.raw)],
    ['Effective capacity', b.capacity.estimate_available ? number(b.capacity.effective) : 'Unavailable'],
    ['Raw capacity coverage', coverage(b.raw_capacity_coverage)], ['Effective capacity coverage', coverage(b.effective_capacity_coverage)],
    ['Expected unfulfilled load-equivalents', number(b.expected_unfulfilled)], ['Risk score / band', `${number(b.risk.score)} · ${b.risk.band}`],
    ['Primary root cause', label(b.root_cause.primary)], ['Top carrier share', percent(b.capacity.top_carrier_share)],
    ['Weighted sell rate', money(b.avg_sell_rate, b.currency)], ['Current planned carrier buy rate', money(b.current_buy_rate, b.currency)],
    ['Sell revenue', money(b.group_sell_revenue, b.currency)], ['Planned carrier buy cost', money(b.group_planned_buy_cost, b.currency)],
    ['Gross spread', money(b.gross_spread, b.currency)], ['Gross take-rate proxy', percent(b.gross_take_rate_proxy)],
    ['Modeled revenue exposure', money(b.modeled_revenue_exposure, b.currency)],
  ]
  return <dialog className="drawer" ref={ref} aria-labelledby="bucket-title" onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="drawer-content">
      <header className="drawer-header"><div><p className="eyebrow">{selection.context} · Planning bucket</p>
        <h2 id="bucket-title">{b.lane}</h2><p>{b.equipment_type} · {dateLabel(b.pickup_date)} · <Badge value={b.status} /></p>
      </div><button onClick={onClose} autoFocus aria-label="Close drilldown">Close</button></header>
      <section><h3>Capacity &amp; commercial economics</h3>
        {b.negative_gross_spread && <p className="notice danger">Negative gross spread: planned carrier buy cost exceeds sell revenue.</p>}
        <dl className="detail-grid">{metrics.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
        <p className="muted">{TAKE_RATE_HELP}</p>
      </section>
      <section><h3>Risk &amp; root-cause evidence</h3><p>{b.risk.reason}</p>
        <p><strong>Primary root cause:</strong> {label(b.root_cause.primary)}</p>
        <p><strong>Secondary contributors:</strong> {b.root_cause.secondary.length ? b.root_cause.secondary.map(label).join(', ') : 'None'}</p>
        <p><strong>Pricing benchmark:</strong> {money(b.benchmark?.rate, b.currency)} · {b.benchmark ? `${label(b.benchmark.source)}, ${b.benchmark.days} days, ${b.benchmark.confidence}` : 'Unavailable'}</p>
        <p><strong>Rate index:</strong> {number(b.rate_index, 3)}</p>
        <h4>Warnings &amp; fallback information</h4>
        {b.warnings.length ? <ul>{b.warnings.map((warning, i) => <li key={`${i}-${warning}`}>{warning}</li>)}</ul> : <p>No bucket warnings or fallbacks.</p>}
      </section>
      <section><h3>Carrier-level totals</h3><p className="muted">Each carrier includes all its qualified additive blocks in this bucket. Concentration uses these totals.</p>
        <Table caption="Carrier-level effective capacity totals" rows={b.capacity.carriers} rowKey={c => c.carrier_id} empty="No qualified carrier capacity." columns={[
          { title: 'Carrier', render: c => <>{c.carrier_name}<br /><span className="muted">{c.carrier_id}</span></> },
          { title: 'Total effective contribution', render: c => number(c.effective), numeric: true },
          { title: 'Carrier effective share', render: c => percent(c.effective_share), numeric: true },
          { title: 'Capacity blocks', render: c => c.capacity_ids.join(', ') },
        ]} />
      </section>
      <section><h3>Individual capacity blocks</h3>
        <Table caption="Individual qualified and excluded capacity blocks" rows={b.capacity.contributions} rowKey={c => c.capacity_id} empty="No matching capacity blocks for this lane, equipment and date." columns={[
          { title: 'Capacity ID / carrier', render: c => <>{c.capacity_id}<br />{c.carrier_id}</> },
          { title: 'Physical trucks', render: c => number(c.available_trucks), numeric: true },
          { title: 'Deadhead (km)', render: c => number(c.deadhead_km_to_origin, 0), numeric: true },
          { title: 'Contract status', render: c => c.contract_status },
          { title: 'Qualified / excluded', render: c => <><Badge value={c.qualified ? 'Qualified' : 'Excluded'} />{c.exclusion && <p>{c.exclusion}</p>}</> },
          { title: 'Reliability', render: c => <>{percent(c.service.reliability)}<br />{label(c.service.source)}<br />{c.service.confidence}<br />{c.service.samples} assignments</> },
          { title: 'Modeled acceptance', render: c => <>{percent(c.modeled.expected)}<br />{label(c.modeled.source)}<br />{c.modeled.confidence}{c.modeled.band && <><br />Band: {c.modeled.band}</>}</> },
          { title: 'Effective contribution', render: c => c.qualified && c.modeled.expected === null ? 'Unavailable' : number(c.effective), numeric: true },
          { title: 'Individual row share', render: c => percent(c.effective_share), numeric: true },
        ]} />
      </section>
      {b.rate_search?.recommendation && <RateScenario bucket={b} />}
      <section><h3>Deterministic recommended actions &amp; evidence</h3>
        {!actions.length ? <p>No actions generated for this bucket.</p> : actions.map(a => <article className={`action-detail ${selection.actionId === a.action_id ? 'selected-action' : ''}`} key={a.action_id}>
          <h4>{label(a.action_type)} <Badge value={a.severity} /></h4>
          <p className="muted">Priority score: {number(a.action_priority_score)} · {selection.actionId === a.action_id ? 'Selected action' : selection.context}</p>
          <p>{a.recommended_action}</p><ul>{a.evidence.map((e, i) => <li key={`${i}-${e}`}>{e}</li>)}</ul>
        </article>)}
      </section>
    </div>
  </dialog>
}
