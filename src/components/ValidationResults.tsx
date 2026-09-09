import { DisplayLabelContext, useDisplayLabels } from '../ui/displayLabels'
import { warningGroups } from '../ui/dataStatus'
import type { DataIssue } from '../data/validation'
import type { ValidationResult } from '../ui/uploadState'
import { DATASET_LABELS } from '../ui/uploadState'
import { Table } from './Table'

function Issues({ title, issues }: { title: string; issues: DataIssue[] }) {
  return <section className={title === 'Blocking errors' && issues.length ? 'validation-blocking' : undefined} aria-label={title}><h3>{title} ({issues.length})</h3>
    <Table caption={title} rows={issues} rowKey={issue => String(issues.indexOf(issue))} empty={`No ${title.toLowerCase()}.`} columns={[
      { title: 'Dataset', render: issue => DATASET_LABELS[issue.dataset] },
      { title: 'CSV row', render: issue => issue.row ?? '—' },
      { title: 'Field', render: issue => issue.field ?? '—' },
      { title: 'Message', render: issue => issue.message },
    ]} />
  </section>
}
function ExcludedRows({ title, rows }: { title: string; rows: object[] }) {
  const { laneLabel, equipmentLabel } = useDisplayLabels()
  if (!rows.length) return null
  return <details className="excluded-rows"><summary>{title} ({rows.length})</summary>
    <p>Retained for inspection; excluded from analytics and scenario KPIs.</p>
    <Table caption={title} rows={rows} rowKey={row => String(rows.indexOf(row))} columns={Object.keys(rows[0]).map(field => ({
      title: field, render: row => { const value = (row as Record<string, unknown>)[field]; return value == null ? '—' : field === 'lane' ? laneLabel(String(value)) : field === 'equipment_type' ? equipmentLabel(String(value)) : String(value) },
    }))} />
  </details>
}
export function ValidationResults({ result }: { result: ValidationResult }) {
  const { temporal, warnings } = warningGroups(result.warnings)
  return <DisplayLabelContext.Provider value={result.displayLabels}><div className="validation-results">
    <Issues title="Blocking errors" issues={result.errors} />
    <details className="validation-disclosure"><summary>Warnings ({warnings.length})</summary><Issues title="Warnings" issues={warnings} /></details>
    <details className="validation-disclosure" open={temporal.length > 0}><summary>Excluded rows / temporal issues ({temporal.length})</summary><Issues title="Excluded rows / temporal issues" issues={temporal} /></details>
    <ExcludedRows title="Upcoming rows outside the 7-day horizon" rows={result.outsideHorizon} />
    <ExcludedRows title="Past-due upcoming rows" rows={result.pastDue} />
    <ExcludedRows title="Future historical rows excluded" rows={result.futureHistorical} />
    <ExcludedRows title="Future offers excluded" rows={result.futureOffers} />
  </div></DisplayLabelContext.Provider>
}
