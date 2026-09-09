import type { Analysis } from '../analytics/engine'
import { Table } from '../components/Table'
import { money, number, percent } from '../ui/format'
export function SupplyGaps({ gaps, currency }: { gaps: Analysis['supply_gaps']; currency: string }) {
  const rows = gaps.map((gap, i) => ({ ...gap, rank: i + 1 }))
  return <>
    <h2>Supply Gaps</h2><p className="section-intro">Supply-gap priority score is a prioritization heuristic, not a financial forecast.</p>
    <Table caption="Ranked recurring supply gaps" rows={rows} rowKey={r => JSON.stringify([r.lane, r.equipment_type])} columns={[
      { title: 'Rank', render: r => r.rank, numeric: true }, { title: 'Lane', render: r => <span className="lane">{r.lane}</span> },
      { title: 'Equipment', render: r => r.equipment_type },
      { title: 'Historical unfulfilled loads (30d)', render: r => r.historical_unfulfilled_30d, numeric: true },
      { title: 'Distinct gap days', render: r => r.gap_days_30d, numeric: true },
      { title: 'Upcoming expected unfulfilled load-equivalents', render: r => number(r.upcoming_expected_unfulfilled_7d), numeric: true },
      { title: 'Demand growth', render: r => percent(r.demand_growth_pct), numeric: true },
      { title: 'Top carrier share', render: r => percent(r.top_carrier_share), numeric: true },
      { title: 'Average sell rate', render: r => money(r.avg_sell_rate, currency), numeric: true },
      { title: 'Recurrence multiplier', render: r => number(r.recurrence_multiplier, 2), numeric: true },
      { title: 'Concentration multiplier', render: r => number(r.concentration_multiplier, 2), numeric: true },
      { title: 'Supply-gap priority score', render: r => number(r.structural_supply_gap_score, 0), numeric: true },
      { title: 'Explanation', render: r => <p className="explanation">{r.explanation}</p> },
    ]} />
  </>
}
