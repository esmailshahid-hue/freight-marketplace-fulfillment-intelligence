import { useEffect, useReducer, useState } from 'react'
import { analyze } from './analytics/engine'
import type { Action, PlanningBucket } from './analytics/types'
import { fetchSample } from './data/sampleLoader'
import { DEFAULT_TIME_ZONE } from './utils/dates'
import { bucketForAction } from './ui/selectors'
import { BucketDrawer, type BucketSelection } from './components/BucketDrawer'
import { OperationsQueue } from './pages/OperationsQueue'
import { CapacityFulfillment } from './pages/CapacityFulfillment'
import { PricingEconomics } from './pages/PricingEconomics'
import { SupplyGaps } from './pages/SupplyGaps'
import { ScenarioLab } from './pages/ScenarioLab'
import { initialUploadState, uploadReducer, type Snapshot } from './ui/uploadState'
import { UploadWorkflow } from './components/UploadWorkflow'
import { ValidationResults } from './components/ValidationResults'
import './App.css'
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; snapshot: Snapshot }
const TABS = ['Operations Queue', 'Capacity & Fulfillment', 'Pricing & Economics', 'Supply Gaps', 'Scenario Lab'] as const
function Workspace({ snapshot, source }: { snapshot: Snapshot; source: 'sample' | 'upload' }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Operations Queue')
  const [selection, setSelection] = useState<BucketSelection | null>(null)
  const [scenarioVisited, setScenarioVisited] = useState(false)
  const { analysis, data, asOf, validation } = snapshot
  const { warnings } = validation
  const currency = data.upcoming[0]?.currency ?? validation.pastDue[0]?.currency ?? data.historical[0]?.currency ?? data.offers[0]?.currency ?? data.payments?.[0]?.currency ?? 'SAR'
  const openBucket = (bucket: PlanningBucket) => setSelection({ bucket, actions: analysis.actions, context: 'Baseline' })
  const openAction = (action: Action) => {
    const bucket = bucketForAction(action, analysis.buckets)
    if (bucket) setSelection({ bucket, actions: analysis.actions, context: 'Baseline', actionId: action.action_id })
  }
  const activateTab = (next: (typeof TABS)[number]) => { setTab(next); if (next === 'Scenario Lab') setScenarioVisited(true) }
  return <>
    <div className="data-context"><p><strong>{source === 'sample' ? 'Built-in synthetic sample' : 'Uploaded data'}</strong> · Seven-day baseline · {currency}</p>
      <p>Analysis time: <time dateTime={asOf}>{new Intl.DateTimeFormat('en-GB', { timeZone: DEFAULT_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(asOf))}</time> · {DEFAULT_TIME_ZONE}</p>
    </div>
    <details className="data-status"><summary>Data status: {source === 'sample' ? 'sample loaded' : 'uploaded data loaded'} · {warnings.length} validation warnings</summary>
      <p>{data.upcoming.length} upcoming rows · {data.historical.length} historical loads · {data.offers.length} offers · {data.capacity.length} capacity blocks · {data.payments?.length ?? 0} carrier payment rows. {source === 'sample' ? 'Dates shifted to this analysis snapshot.' : 'Uploaded dates have not been shifted.'}</p>
      {!data.payments && <p>Carrier payments not provided. Payment exposure actions are unavailable.</p>}
      <ValidationResults result={validation} />
    </details>
    <div className="tabs" role="tablist" aria-label="Operations views">{TABS.map((name, i) => <button key={name} role="tab" id={`tab-${i}`} aria-controls={`panel-${i}`} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1}
      onClick={() => activateTab(name)} onKeyDown={e => {
        const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : null
        if (next !== null) { e.preventDefault(); activateTab(TABS[next]); document.getElementById(`tab-${next}`)?.focus() }
      }}>{name}</button>)}</div>
    <main id="main-content">{TABS.map((name, i) => <div role="tabpanel" id={`panel-${i}`} aria-labelledby={`tab-${i}`} hidden={tab !== name} key={name}>
      {name === 'Operations Queue' && <OperationsQueue analysis={analysis} currency={currency} onAction={openAction} onBucket={openBucket} />}
      {name === 'Capacity & Fulfillment' && <CapacityFulfillment buckets={analysis.buckets} onBucket={openBucket} />}
      {name === 'Pricing & Economics' && <PricingEconomics currency={currency} buckets={analysis.buckets} onBucket={openBucket} />}
      {name === 'Supply Gaps' && <SupplyGaps gaps={analysis.supply_gaps} currency={currency} />}
      {name === 'Scenario Lab' && scenarioVisited && <ScenarioLab data={data} analysis={analysis} asOf={asOf} currency={currency} onInspect={setSelection} />}
    </div>)}</main>
    {selection && <BucketDrawer selection={selection} onClose={() => setSelection(null)} />}
  </>
}
function SampleWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    const asOf = new Date().toISOString()
    async function load() {
      try {
        const loaded = await fetchSample(asOf)
        if (!active) return
        if (!loaded.data) throw new Error(loaded.errors.map(e => `${e.dataset}${e.row ? ` row ${e.row}` : ''}: ${e.message}`).join('; '))
        const analysis = analyze(loaded.data, asOf)
        setState({ status: 'ready', snapshot: { data: loaded.data, analysis, asOf, validation: loaded } })
      } catch (error) {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load sample data.' })
      }
    }
    void load()
    return () => { active = false }
  }, [attempt])
  return <>
    {state.status === 'loading' && <main id="main-content"><p className="notice" role="status">Loading built-in synthetic sample and calculating baseline…</p></main>}
    {state.status === 'error' && <main id="main-content"><div className="notice danger" role="alert"><h2>Sample could not be loaded</h2><p>{state.message}</p>
      <button onClick={() => { setState({ status: 'loading' }); setAttempt(n => n + 1) }}>Retry sample loading</button>
    </div></main>}
    {state.status === 'ready' && <Workspace snapshot={state.snapshot} source="sample" />}
  </>
}
export default function App() {
  const [uploads, dispatch] = useReducer(uploadReducer, undefined, initialUploadState)
  const [sampleVersion, setSampleVersion] = useState(0)
  const reset = () => { dispatch({ type: 'reset' }); setSampleVersion(n => n + 1) }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="app-header"><p className="eyebrow">Operations workspace</p>
      <h1>Freight Marketplace Fulfillment &amp; Capacity Intelligence</h1>
      <p>Anticipates fulfillment risk across upcoming freight demand and recommends capacity, pricing and carrier actions.</p>
    </header>
    <div className="source-controls" role="group" aria-label="Data source">
      {uploads.snapshot ? <><strong>Uploaded data</strong><button onClick={() => dispatch({ type: 'manage' })}>Manage uploaded data</button></> : <>
        <button aria-pressed={uploads.mode === 'sample'} onClick={reset}>Built-in synthetic sample</button>
        <button aria-pressed={uploads.mode === 'upload'} onClick={() => { if (uploads.mode !== 'upload') dispatch({ type: 'upload' }) }}>Upload own data</button>
      </>}
      <button onClick={reset}>Reset to sample data</button>
    </div>
    {uploads.mode === 'sample' ? <>
      <p className="synthetic-notice">This demo uses synthetic freight-marketplace data. It does not represent any company's actual network or operations.</p>
      <SampleWorkspace key={sampleVersion} />
    </> : <>
      <p className="synthetic-notice">Your CSV files are analyzed in this browser session only. They are not uploaded or stored.</p>
      {uploads.snapshot ? <Workspace snapshot={uploads.snapshot} source="upload" /> : <UploadWorkflow state={uploads} dispatch={dispatch} />}
    </>}
    <footer>Browser memory only. Refreshing starts a new sample analysis. Effective capacity is a planning model, not live dispatch availability.</footer>
  </div>
}
