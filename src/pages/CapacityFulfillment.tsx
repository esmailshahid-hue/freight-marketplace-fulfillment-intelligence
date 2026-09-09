import { useDisplayLabels } from '../ui/displayLabels'
import { useState } from 'react'
import type { PlanningBucket } from '../analytics/types'
import { Table } from '../components/Table'
import { CoverageBar } from '../components/CoverageBar'
import { Badge } from '../components/Badge'
import { coverage, dateLabel, label, number, percent } from '../ui/format'
import { EMPTY_FILTERS, filterBuckets } from '../ui/selectors'
export function CapacityFulfillment({ buckets, onBucket }: { buckets: PlanningBucket[]; onBucket: (bucket: PlanningBucket) => void }) {
  const { laneLabel, equipmentLabel } = useDisplayLabels()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [detail, setDetail] = useState(false)
  const rows = filterBuckets(buckets, filters).sort((a, b) => b.risk.score - a.risk.score)
  const options = [
    { field: 'lane' as const, label: 'Lane', values: [...new Set(buckets.map(b => b.lane))].sort() },
    { field: 'equipment' as const, label: 'Equipment type', values: [...new Set(buckets.map(b => b.equipment_type))].sort() },
    { field: 'date' as const, label: 'Pickup date', values: [...new Set(buckets.map(b => b.pickup_date))].sort() },
    { field: 'status' as const, label: 'Capacity status', values: ['Healthy', 'Watch', 'At Risk', 'Critical'] },
  ]
  return <>
    <h2>Capacity &amp; Fulfillment</h2><p className="section-intro">Can available carrier supply cover demand?</p>
    <div className="filters">{options.map(o => <label key={o.field}>{o.label}<select value={filters[o.field]} onChange={e => setFilters({ ...filters, [o.field]: e.target.value })}>
      <option value="">All</option>{o.values.map(value => <option key={value} value={value}>{o.field === 'date' ? dateLabel(value) : o.field === 'lane' ? laneLabel(value) : o.field === 'equipment' ? equipmentLabel(value) : value}</option>)}
    </select></label>)}<button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button></div>
    <div className="table-toolbar"><p role="status" className="muted">{rows.length} of {buckets.length} planning buckets</p><label className="checkbox"><input type="checkbox" checked={detail} onChange={e => setDetail(e.target.checked)} />Show raw capacity &amp; concentration</label></div>
    <Table caption="Capacity and fulfillment planning buckets" rows={rows} rowKey={b => b.id} onSelect={onBucket} empty="No planning buckets match these filters." columns={[
      { title: 'Lane', render: b => <button className="text-button lane" onClick={e => { e.stopPropagation(); onBucket(b) }}>{laneLabel(b.lane)}</button> },
      { title: 'Equipment', render: b => equipmentLabel(b.equipment_type) },
      { title: 'Pickup date', render: b => dateLabel(b.pickup_date) },
      { title: 'Demand', render: b => number(b.upcoming_loads), numeric: true },
      { title: 'Effective capacity', render: b => b.capacity.estimate_available ? number(b.capacity.effective) : 'Unavailable', numeric: true },
      { title: 'Effective coverage', render: b => <CoverageBar value={b.effective_capacity_coverage} />, numeric: true },
      { title: 'Loads at risk', render: b => number(b.expected_unfulfilled), numeric: true },
      { title: 'Capacity status', render: b => <Badge value={b.status} /> },
      { title: 'Risk', render: b => <>{number(b.risk.score)} <Badge value={b.risk.band} /></> },
      { title: 'Root cause', render: b => label(b.root_cause.primary) },
      ...(detail ? [
        { title: 'Raw qualified capacity', render: (b: PlanningBucket) => number(b.capacity.raw), numeric: true },
        { title: 'Raw capacity coverage', render: (b: PlanningBucket) => coverage(b.raw_capacity_coverage), numeric: true },
        { title: 'Top carrier share', render: (b: PlanningBucket) => percent(b.capacity.top_carrier_share), numeric: true },
      ] : []),
    ]} />
  </>
}
