import type { Datasets } from '../data/schemas'
import { dataStatusIssues } from '../ui/dataStatus'
import type { ValidationResult } from '../ui/uploadState'
import { ValidationResults } from './ValidationResults'

export function DataStatus({ data, validation, source }: { data: Datasets; validation: ValidationResult; source: 'sample' | 'upload' }) {
  const { notes, warnings } = dataStatusIssues(validation.warnings, source)
  // This display projection leaves the original validation events and snapshot intact.
  const display = { ...validation, warnings }
  return <details className={`data-status ${validation.pastDue.length ? 'needs-attention' : ''}`}>
    <summary>Data status: {source === 'sample' ? 'sample loaded' : 'uploaded data loaded'}{(warnings.length > 0 || source === 'upload') && ` · ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}`}{validation.pastDue.length > 0 && ` · ${validation.pastDue.length} past-due rows excluded`}</summary>
    {notes.length > 0 && <section aria-label="Data notes"><h3>{notes.length} data {notes.length === 1 ? 'note' : 'notes'}</h3><p>Sample contains intentional additive capacity blocks used to demonstrate carrier-level concentration.</p></section>}
    <p>{data.upcoming.length} upcoming rows · {data.historical.length} historical loads · {data.offers.length} offers · {data.capacity.length} capacity blocks · {data.payments?.length ?? 0} carrier payment rows. {source === 'sample' ? 'Dates shifted to this analysis snapshot.' : 'Uploaded dates have not been shifted.'}</p>
    {!data.payments && <p>Carrier payments not provided. Payment exposure actions are unavailable.</p>}
    <ValidationResults result={display} />
  </details>
}
