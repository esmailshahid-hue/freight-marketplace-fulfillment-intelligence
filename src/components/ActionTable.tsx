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
    { title: 'Action', render: a => <button className="text-button action-name" title={a.recommended_action} onClick={event => { event.stopPropagation(); onSelect(a) }}>{label(a.action_type)}</button> },
    { title: 'Lane / equipment', render: a => <><span className="lane">{a.lane}</span><small>{a.equipment_type} · <time dateTime={a.pickup_date}>{dateLabel(a.pickup_date)}</time></small></> },
    { title: 'Reason', render: a => <div className="action-reason"><strong>{a.root_cause ? label(a.root_cause) : a.action_type === 'ACTIVATE_BACKUP_CARRIERS' ? 'Carrier concentration' : 'No fulfillment shortfall'}</strong><small>{(a.action_type === 'ACTIVATE_BACKUP_CARRIERS' ? a.evidence.slice(-1) : a.evidence.slice(0, 2)).join(' · ')}</small></div> },
    { title: 'Loads exposed', render: a => number(a.loads_exposed), numeric: true },
    { title: 'Modeled revenue exposure', render: a => money(a.modeled_revenue_exposure, currency), numeric: true },
    { title: 'Priority', render: a => number(a.action_priority_score), numeric: true },
  ]} />
}
