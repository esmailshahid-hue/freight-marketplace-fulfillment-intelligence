import type { PlanningBucket } from '../analytics/types'
import { Table } from '../components/Table'
import { RateScenario } from '../components/RateScenario'
import { dateLabel, label, money, number, percent, TAKE_RATE_HELP } from '../ui/format'
export function PricingEconomics({ buckets, currency, onBucket }: { currency: string; buckets: PlanningBucket[]; onBucket: (bucket: PlanningBucket) => void }) {
  return <>
    <h2>Pricing &amp; Economics</h2><p className="section-intro">Baseline · modeled acceptance based on historical rate/acceptance behavior. Rates are shown in {currency}.</p>
    <p className="muted">Gross take-rate proxy: {TAKE_RATE_HELP}</p>
    <Table caption="Pricing and economics by planning bucket" rows={buckets} rowKey={b => b.id} onSelect={onBucket} columns={[
      { title: 'Lane', render: b => <button className="text-button lane" onClick={e => { e.stopPropagation(); onBucket(b) }}>{b.lane}</button> },
      { title: 'Equipment', render: b => b.equipment_type }, { title: 'Pickup date', render: b => dateLabel(b.pickup_date) },
      { title: 'Weighted sell rate', render: b => money(b.avg_sell_rate, b.currency), numeric: true },
      { title: 'Current planned carrier buy rate', render: b => money(b.current_buy_rate, b.currency), numeric: true },
      { title: 'Median accepted historical buy-rate benchmark', render: b => money(b.benchmark?.rate, b.currency), numeric: true },
      { title: 'Benchmark source / confidence', render: b => b.benchmark ? <>{label(b.benchmark.source)} · {b.benchmark.days} days<br />{b.benchmark.confidence}<br />{b.benchmark.samples} accepted offers</> : 'Unavailable' },
      { title: 'Rate index', render: b => number(b.rate_index, 3), numeric: true },
      { title: 'Modeled carrier acceptance', render: b => percent(b.capacity.estimate_available ? b.capacity.weighted_acceptance : null), numeric: true },
      { title: 'Gross spread', render: b => <span className={b.negative_gross_spread ? 'negative' : undefined}>{money(b.gross_spread, b.currency)}{b.negative_gross_spread && <><br />Negative gross spread</>}</span>, numeric: true },
      { title: 'Gross take-rate proxy', render: b => percent(b.gross_take_rate_proxy), numeric: true },
      { title: 'Modeled rate scenario', render: b => b.rate_search?.recommendation ? <details onClick={e => e.stopPropagation()}><summary>View modeled rate scenario</summary><RateScenario bucket={b} /></details> : 'No modeled rate recommendation' },
    ]} />
  </>
}
