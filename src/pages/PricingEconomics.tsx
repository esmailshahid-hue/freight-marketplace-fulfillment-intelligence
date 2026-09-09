import type { PlanningBucket } from '../analytics/types'
import { Table } from '../components/Table'
import { RateScenario } from '../components/RateScenario'
import { dateLabel, label, money, number, percent, TAKE_RATE_HELP } from '../ui/format'
export function PricingEconomics({ buckets, currency, onBucket }: { currency: string; buckets: PlanningBucket[]; onBucket: (bucket: PlanningBucket) => void }) {
  return <>
    <h2>Pricing &amp; Economics</h2><p className="section-intro">What rate improves fulfillment while protecting the commercial floor? Rates are shown in {currency}.</p>
    <details className="inline-help"><summary>How to interpret these rates</summary><p>Modeled acceptance is based on historical rate/acceptance behavior. {TAKE_RATE_HELP}</p></details>
    <Table caption="Pricing and economics by planning bucket" rows={buckets} rowKey={b => b.id} onSelect={onBucket} columns={[
      { title: 'Lane', render: b => <><button className="text-button lane" onClick={e => { e.stopPropagation(); onBucket(b) }}>{b.lane}</button><small>{b.equipment_type} · {dateLabel(b.pickup_date)}</small></> },
      { title: 'Current carrier buy rate', render: b => money(b.current_buy_rate, b.currency), numeric: true },
      { title: 'Accepted benchmark', render: b => money(b.benchmark?.rate, b.currency), numeric: true },
      { title: 'Rate index', render: b => number(b.rate_index, 3), numeric: true },
      { title: 'Modeled carrier acceptance', render: b => percent(b.capacity.estimate_available ? b.capacity.weighted_acceptance : null), numeric: true },
      { title: 'Gross take-rate proxy', render: b => <span className={b.negative_gross_spread ? 'negative' : undefined}>{percent(b.gross_take_rate_proxy)}{b.negative_gross_spread && <small>Negative gross spread</small>}</span>, numeric: true },
      { title: 'Modeled rate scenario', render: b => b.rate_search?.recommendation ? <details onClick={e => e.stopPropagation()}><summary>View modeled rate scenario</summary><RateScenario bucket={b} /></details> : 'No modeled rate recommendation' },
      { title: 'Supporting detail', render: b => <details onClick={e => e.stopPropagation()}><summary>Benchmark &amp; economics</summary><dl className="cell-detail">
        <dt>Benchmark source</dt><dd>{b.benchmark ? `${label(b.benchmark.source)} · ${b.benchmark.days} days · ${b.benchmark.samples} accepted offers · ${b.benchmark.confidence}` : 'Unavailable'}</dd>
        <dt>Weighted sell rate</dt><dd>{money(b.avg_sell_rate, b.currency)}</dd><dt>Gross spread</dt><dd>{money(b.gross_spread, b.currency)}</dd>
      </dl></details> },
    ]} />
  </>
}
