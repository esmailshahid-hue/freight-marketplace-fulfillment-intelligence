import { useDisplayLabels } from '../ui/displayLabels'
import type { Analysis } from '../analytics/engine'
import { Table } from '../components/Table'
import { money, number, percent } from '../ui/format'
export function SupplyGaps({ gaps, currency }: { gaps: Analysis['supply_gaps']; currency: string }) {
  const { laneLabel, equipmentLabel } = useDisplayLabels()
  const rows = gaps.map((gap, i) => ({ ...gap, rank: i + 1 }))
  return <>
    <h2>Supply Gaps</h2><p className="section-intro">Where to build carrier supply.</p>
    <div className="supply-leaders">{rows.slice(0, 3).map(r => <article key={r.rank}>
      <div className="attention-top"><span className="rank-label">{String(r.rank).padStart(2, '0')}</span><span className="muted">{equipmentLabel(r.equipment_type)}</span></div>
      <h3 className="lane-title">{laneLabel(r.lane)}</h3><strong className="supply-score">{number(r.structural_supply_gap_score, 0)}</strong><small>Supply-gap priority score</small>
      <div className="score-track" aria-hidden="true"><span style={{ width: `${rows[0].structural_supply_gap_score > 0 ? Math.max(0, r.structural_supply_gap_score / rows[0].structural_supply_gap_score) * 100 : 0}%` }} /></div>
      <p><strong>{number(r.upcoming_expected_unfulfilled_7d)}</strong> loads at risk · next 7 days</p><p className="muted">{r.historical_unfulfilled_30d} unfulfilled across {r.gap_days_30d} days · last 30 days</p>
    </article>)}</div>
    <p className="section-intro">Supply-gap priority score is a prioritization heuristic, not a financial forecast. Bars compare each score with the highest priority.</p>
    <h3>Full supply ranking</h3>
    <Table caption="Ranked recurring supply gaps" rows={rows} rowKey={r => JSON.stringify([r.lane, r.equipment_type])} columns={[
      { title: 'Rank', render: r => r.rank, numeric: true }, { title: 'Lane', render: r => <span className="lane">{laneLabel(r.lane)}</span> },
      { title: 'Equipment', render: r => equipmentLabel(r.equipment_type) },
      { title: 'Upcoming exposure', render: r => number(r.upcoming_expected_unfulfilled_7d), numeric: true },
      { title: 'Recurring gaps · 30 days', render: r => <>{r.historical_unfulfilled_30d} unfulfilled<small>{r.gap_days_30d} distinct days</small></>, numeric: true },
      { title: 'Demand growth', render: r => percent(r.demand_growth_pct), numeric: true },
      { title: 'Top carrier share', render: r => percent(r.top_carrier_share), numeric: true },
      { title: 'Supply-gap priority score', render: r => number(r.structural_supply_gap_score, 0), numeric: true },
      { title: 'Supporting detail', render: r => <details><summary>Why this priority</summary><p className="explanation">{r.explanation}</p><dl className="cell-detail"><dt>Average sell rate</dt><dd>{money(r.avg_sell_rate, currency)}</dd><dt>Recurrence multiplier</dt><dd>{number(r.recurrence_multiplier, 2)}</dd><dt>Concentration multiplier</dt><dd>{number(r.concentration_multiplier, 2)}</dd></dl></details> },
    ]} />
  </>
}
