import type { Dispatch } from 'react'
import { SCHEMAS } from '../data/schemas'
import type { DatasetName } from '../data/schemas'
import { DATASETS, DATASET_LABELS, inspectUpload, missingMappings, readyToValidate, type UploadEvent, type UploadState } from '../ui/uploadState'
import { Badge } from './Badge'
import { ValidationResults } from './ValidationResults'

export function UploadWorkflow({ state, dispatch }: { state: UploadState; dispatch: Dispatch<UploadEvent> }) {
  async function readFile(dataset: DatasetName, file: File) {
    const token = crypto.randomUUID()
    dispatch({ type: 'start', dataset, token, name: file.name, size: file.size })
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Select a CSV file (.csv). Excel and other file types are not supported.')
      const csv = await file.text()
      dispatch({ type: 'loaded', dataset, token, file: inspectUpload(dataset, file.name, file.size, csv) })
    } catch (error) {
      dispatch({ type: 'failed', dataset, token, message: error instanceof Error ? error.message : 'Unable to read this file. Select it again.' })
    }
  }
  const result = state.validation?.result
  const ready = readyToValidate(state)
  return <main id="main-content">
    <h2>Upload data</h2>
    <ol className="workflow-steps" aria-label="Upload workflow"><li>Upload</li><li>Map columns</li><li>Validate</li><li>Analyze</li></ol>
    <p>Add four required CSVs. Carrier payments are optional.</p>
    <section className="panel" aria-labelledby="upload-files-heading"><h3 id="upload-files-heading">1. Upload</h3>
      <div className="upload-files">{DATASETS.map(dataset => {
        const slot = state.slots[dataset]
        const mappingReady = slot?.status === 'ready' && !missingMappings(dataset, slot.file).length
        const errors = result?.errors.filter(issue => issue.dataset === dataset)
        const warnings = result?.warnings.filter(issue => issue.dataset === dataset)
        const status = !slot ? 'Not uploaded' : slot.status === 'error' || errors?.length ? 'Blocking error' : slot.status === 'reading' ? 'Reading…' : !mappingReady ? 'Mapping required' : result ? 'Validation passed' : 'Uploaded · Ready'
        return <fieldset key={dataset} className={slot?.status === 'error' || errors?.length ? 'file-error' : mappingReady ? 'file-ready' : slot?.status === 'ready' ? 'file-attention' : undefined}><legend>{DATASET_LABELS[dataset]} · {dataset === 'payments' ? 'Optional' : 'Required'}</legend>
          <label htmlFor={`file-${dataset}`}>{slot ? 'Replace CSV file' : 'Choose CSV file'}</label>
          <input id={`file-${dataset}`} type="file" accept=".csv,text/csv" onChange={e => {
            const file = e.currentTarget.files?.[0]
            e.currentTarget.value = ''
            if (file) void readFile(dataset, file)
          }} />
          {slot ? <>
            <p className="filename">{slot.name} · {slot.size.toLocaleString()} bytes</p>
            <p>{slot.status === 'ready' ? `${slot.file.rowCount.toLocaleString()} ${slot.file.rowCount === 1 ? 'row' : 'rows'}` : slot.status === 'reading' ? 'Reading file…' : 'Row count unavailable'}</p>
            <p><Badge value={status} /></p>
            <p className="muted">Validation: {!result ? 'Not validated' : errors?.length ? `${errors.length} blocking ${errors.length === 1 ? 'error' : 'errors'}` : warnings?.length ? `Passed with ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}` : 'Passed'}</p>
            {slot.status === 'error' && <p role="alert" className="negative">{slot.message}</p>}
            <button onClick={() => dispatch({ type: 'remove', dataset })}>Remove {DATASET_LABELS[dataset].toLowerCase()}</button>
          </> : <><p><Badge value={status} /></p><p>{dataset === 'payments' ? 'Enables payment exposure review.' : 'Required to analyze.'}</p></>}
        </fieldset>
      })}</div>
    </section>
    <section className="panel" aria-labelledby="mapping-heading"><h3 id="mapping-heading">2. Map columns</h3>
      <p>Check the column matches. Resolve required fields before validating. Unmap a column before assigning it elsewhere.</p>
      {DATASETS.map(dataset => {
        const slot = state.slots[dataset]
        if (slot?.status !== 'ready') return null
        const { file } = slot
        const missing = missingMappings(dataset, file)
        return <details key={dataset} className="mapping-panel" open={missing.length > 0 ? true : undefined}>
          <summary>{DATASET_LABELS[dataset]} mappings · {missing.length ? `${missing.length} required ${missing.length === 1 ? 'field' : 'fields'} to map` : 'Ready'}</summary>
          <div className="table-scroll" role="region" aria-label={`${DATASET_LABELS[dataset]} column mappings`} tabIndex={0}>
            <table><caption className="sr-only">{DATASET_LABELS[dataset]} column mappings</caption>
              <thead><tr><th scope="col">Application field</th><th scope="col">Requirement</th><th scope="col">Automatically detected</th><th scope="col">Uploaded column</th></tr></thead>
              <tbody>{Object.entries(SCHEMAS[dataset]).map(([field, rule]) => <tr key={field}>
                <th scope="row">{field}</th><td>{rule.optional ? 'Optional' : 'Required'}</td><td>{file.automatic[field] ?? 'No unique match'}</td>
                <td><label className="sr-only" htmlFor={`map-${dataset}-${field}`}>{DATASET_LABELS[dataset]}: {field}</label>
                  <select id={`map-${dataset}-${field}`} value={file.mapping[field] ?? ''} aria-invalid={missing.includes(field)} onChange={e => dispatch({ type: 'map', dataset, field, header: e.target.value || null })}>
                    <option value="">{rule.optional ? 'Unmapped (optional)' : 'Select required column'}</option>
                    {file.headers.map(header => <option key={header} value={header} disabled={Object.entries(file.mapping).some(([other, used]) => other !== field && used === header)}>{header || '(blank header)'}</option>)}
                  </select>
                  {missing.includes(field) && <p className="negative">Required field needs attention.</p>}
                  {field === 'lane' && rule.optional && !file.mapping[field] && <p>Computed from origin → destination.</p>}
                </td>
              </tr>)}</tbody>
            </table>
          </div>
        </details>
      })}
    </section>
    <section className="panel" aria-labelledby="validation-heading"><h3 id="validation-heading">3. Validate</h3>
      <p>Uploaded dates stay unchanged. Validation sets the analysis time.</p>
      <button className="primary-button" disabled={!ready} onClick={() => dispatch({ type: 'validate', asOf: new Date().toISOString() })}>Validate data</button>
      {!ready && <p role="status">Add the required files and resolve column mappings.</p>}
      {state.validation && <><p role="status">{result?.data ? 'Validation passed. Ready to analyze.' : 'Fix the blocking errors, then validate again.'} Analysis timestamp: <time dateTime={state.validation.asOf}>{state.validation.asOf}</time></p>
        <ValidationResults result={state.validation.result} /></>}
    </section>
    <section className="panel" aria-labelledby="analyze-heading"><h3 id="analyze-heading">4. Analyze</h3>
      <button className="primary-button" disabled={!ready || !result?.data} onClick={() => dispatch({ type: 'analyze' })}>Analyze Data</button>
      <p>File or mapping changes require revalidation.</p>
    </section>
  </main>
}
