import type { DataIssue } from '../data/validation'
import type { ValidationResult } from '../ui/uploadState'
import { DATASET_LABELS } from '../ui/uploadState'
import { Table } from './Table'

function Issues({ title, issues }: { title: string; issues: DataIssue[] }) {
  return <section aria-label={title}><h3>{title} ({issues.length})</h3>
    <Table caption={title} rows={issues} rowKey={issue => String(issues.indexOf(issue))} empty={`No ${title.toLowerCase()}.`} columns={[
      { title: 'Dataset', render: issue => DATASET_LABELS[issue.dataset] },
      { title: 'CSV row', render: issue => issue.row ?? '—' },
      { title: 'Field', render: issue => issue.field ?? '—' },
      { title: 'Message', render: issue => issue.message },
    ]} />
  </section>
}
function ExcludedRows({ title, rows }: { title: string; rows: object[] }) {
  if (!rows.length) return null
  return <details className="excluded-rows"><summary>{title} ({rows.length})</summary>
    <p>Retained for inspection; excluded from analytics and scenario KPIs.</p>
    <Table caption={title} rows={rows} rowKey={row => String(rows.indexOf(row))} columns={Object.keys(rows[0]).map(field => ({
      title: field, render: row => { const value = (row as Record<string, unknown>)[field]; return value == null ? '—' : String(value) },
    }))} />
  </details>
}
export function ValidationResults({ result }: { result: ValidationResult }) {
  const temporal = result.warnings.filter(issue => issue.message.startsWith('Past Due:') || issue.message.startsWith('Future historical row excluded:'))
  return <div className="validation-results">
    <Issues title="Blocking errors" issues={result.errors} />
    <Issues title="Warnings" issues={result.warnings.filter(issue => !temporal.includes(issue))} />
    <Issues title="Excluded rows / temporal issues" issues={temporal} />
    <ExcludedRows title="Past-due upcoming rows" rows={result.pastDue} />
    <ExcludedRows title="Future historical rows excluded" rows={result.futureHistorical} />
    <ExcludedRows title="Future offers excluded" rows={result.futureOffers} />
  </div>
}
