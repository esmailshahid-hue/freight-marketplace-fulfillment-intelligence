import type { Action } from '../analytics/types'
import { Table } from './Table'
import { Badge } from './Badge'
import { dateLabel, label, money, number } from '../ui/format'
export function ActionTable({ actions, currency, onSelect, caption = 'Prioritized action queue', empty = 'No actions for the current analysis.' }: {
  actions: Action[]; currency: string; onSelect: (action: Action) => void; caption?: string; empty?: string;
}) {
  // The engine already sorts and scores actions; preserve its order.
  return <Table caption={caption} rows={actions} rowKey={a => a.action_id} onSelect={onSelect} empty={empty} columns={[
    { title: 'Severity', render: a => <Badge value={a.severity} /> },
    { title: 'Recommended action / action type', render: a => <button className="text-button" title={a.recommended_action} onClick={event => { event.stopPropagation(); onSelect(a) }}>{label(a.action_type)}</button> },
    { title: 'Lane', render: a => <span className="lane">{a.lane}</span> },
    { title: 'Equipment', render: a => a.equipment_type },
    { title: 'Pickup date', render: a => <time dateTime={a.pickup_date}>{dateLabel(a.pickup_date)}</time> },
    { title: 'Loads exposed', render: a => number(a.loads_exposed), numeric: true },
    { title: 'Root cause', render: a => label(a.root_cause) },
    { title: 'Modeled revenue exposure', render: a => money(a.modeled_revenue_exposure, currency), numeric: true },
    { title: 'Action priority score', render: a => number(a.action_priority_score), numeric: true },
  ]} />
}
