import type { Datasets } from '../data/schemas'
import { dataStatusIssues, warningGroups } from '../ui/dataStatus'
import type { ValidationResult } from '../ui/uploadState'
import { ValidationResults } from './ValidationResults'

export function DataStatus({ data, validation, source }: { data: Datasets; validation: ValidationResult; source: 'sample' | 'upload' }) {
  const { notes, warnings: events } = dataStatusIssues(validation.warnings, source)
  const { warnings } = warningGroups(events)
  // This display projection leaves the original validation events and snapshot intact.
  const display = { ...validation, warnings: events }
  return <details className={`data-status ${validation.pastDue.length ? 'needs-attention' : ''}`}>
    <summary>Data status: {source === 'sample' ? 'sample loaded' : 'uploaded data loaded'}{(warnings.length > 0 || source === 'upload') && ` · ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}`}{validation.pastDue.length > 0 && ` · ${validation.pastDue.length} past-due rows excluded`}{validation.futureHistorical.length > 0 && ` · ${validation.futureHistorical.length} future historical rows excluded`}{validation.futureOffers.length > 0 && ` · ${validation.futureOffers.length} future offers excluded`}</summary>
    {notes.length > 0 && <section aria-label="Data notes"><h3>{notes.length} data {notes.length === 1 ? 'note' : 'notes'}</h3><p>Sample contains intentional additive capacity blocks used to demonstrate carrier-level concentration.</p></section>}
    {validation.outsideHorizon.length > 0 && <p>{validation.outsideHorizon.length} upcoming rows outside the 7-day horizon</p>}
    <p>{data.upcoming.length} upcoming rows · {data.historical.length} historical loads · {data.offers.length} offers · {data.capacity.length} capacity blocks · {data.payments?.length ?? 0} carrier payment rows. {source === 'sample' ? 'Dates shifted to this analysis snapshot.' : 'Uploaded dates have not been shifted.'}</p>
    {!data.payments && <p>Carrier payments not provided. Payment exposure actions are unavailable.</p>}
    <ValidationResults result={display} />
  </details>
}
