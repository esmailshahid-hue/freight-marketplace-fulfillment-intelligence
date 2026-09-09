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
    <p>Complete each step below. All four required datasets must come from your files. Filenames can be anything ending in .csv.</p>
    <section className="panel" aria-labelledby="upload-files-heading"><h3 id="upload-files-heading">1. Upload</h3>
      <div className="upload-files">{DATASETS.map(dataset => {
        const slot = state.slots[dataset]
        const mappingReady = slot?.status === 'ready' && !missingMappings(dataset, slot.file).length
        const errors = result?.errors.filter(issue => issue.dataset === dataset)
        const warnings = result?.warnings.filter(issue => issue.dataset === dataset)
        return <fieldset key={dataset} className={slot?.status === 'error' || errors?.length ? 'file-error' : mappingReady ? 'file-ready' : slot?.status === 'ready' ? 'file-attention' : undefined}><legend>{DATASET_LABELS[dataset]} · {dataset === 'payments' ? 'Optional' : 'Required'}</legend>
          <label htmlFor={`file-${dataset}`}>{slot ? 'Replace CSV file' : 'Choose CSV file'}</label>
          <input id={`file-${dataset}`} type="file" accept=".csv,text/csv" onChange={e => {
            const file = e.currentTarget.files?.[0]
            e.currentTarget.value = ''
            if (file) void readFile(dataset, file)
          }} />
          {slot ? <>
            <p className="filename">{slot.name} · {slot.size.toLocaleString()} bytes</p>
            <p>{slot.status === 'ready' ? `${slot.file.rowCount.toLocaleString()} detected rows` : slot.status === 'reading' ? 'Reading file…' : 'Row count unavailable'}</p>
            <p>Mapping: <Badge value={slot.status !== 'ready' ? 'Pending' : mappingReady ? 'Ready for review' : 'Requires attention'} /></p>
            <p>Validation: {!result ? 'Not validated' : errors?.length ? `${errors.length} blocking errors` : warnings?.length ? `Passed with ${warnings.length} warnings` : 'Passed'}</p>
            {slot.status === 'error' && <p role="alert" className="negative">{slot.message}</p>}
            <button onClick={() => dispatch({ type: 'remove', dataset })}>Remove {DATASET_LABELS[dataset].toLowerCase()}</button>
          </> : <p>{dataset === 'payments' ? 'Not provided. Payment exposure actions will be unavailable.' : 'Required file not provided.'}</p>}
        </fieldset>
      })}</div>
    </section>
    <section className="panel" aria-labelledby="mapping-heading"><h3 id="mapping-heading">2. Map columns</h3>
      <p>Matches use exact names and supported synonyms. Choose a column for every required field. To move a column between fields, first unmap it from its current field.</p>
      {DATASETS.map(dataset => {
        const slot = state.slots[dataset]
        if (slot?.status !== 'ready') return null
        const { file } = slot
        const missing = missingMappings(dataset, file)
        return <details key={dataset} className="mapping-panel" open={missing.length > 0 ? true : undefined}>
          <summary>{DATASET_LABELS[dataset]} mappings · {missing.length ? `${missing.length} required fields need attention` : 'Ready for review'}</summary>
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
      <p>Validation captures the analysis timestamp for this session. Uploaded dates remain unchanged.</p>
      <button className="primary-button" disabled={!ready} onClick={() => dispatch({ type: 'validate', asOf: new Date().toISOString() })}>Validate data</button>
      {!ready && <p role="status">Provide all required files and resolve required mappings before validation.</p>}
      {state.validation && <><p role="status">{result?.data ? 'Validation passed. Data is ready to analyze.' : 'Analysis blocked. Resolve the errors below and validate again.'} Analysis timestamp: <time dateTime={state.validation.asOf}>{state.validation.asOf}</time></p>
        <ValidationResults result={state.validation.result} /></>}
    </section>
    <section className="panel" aria-labelledby="analyze-heading"><h3 id="analyze-heading">4. Analyze</h3>
      <button className="primary-button" disabled={!ready || !result?.data} onClick={() => dispatch({ type: 'analyze' })}>Analyze Data</button>
      <p>Changing any file or mapping clears previous validation and analysis.</p>
    </section>
  </main>
}
