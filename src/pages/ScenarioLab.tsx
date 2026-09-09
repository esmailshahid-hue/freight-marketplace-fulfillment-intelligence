import { useDeferredValue, useMemo, useState } from 'react'
import { runScenario } from '../analytics/scenarios'
import type { Analysis } from '../analytics/engine'
import type { Datasets } from '../data/schemas'
import type { BucketSelection } from '../components/BucketDrawer'
import { ActionTable } from '../components/ActionTable'
import { Table } from '../components/Table'
import { coverage, money, number, percent, signedPercent } from '../ui/format'
import { bucketForAction, uniquePairs } from '../ui/selectors'
import { initialControls, toScenario, type ScenarioControls } from '../ui/scenarioControls'
import type { Action } from '../analytics/types'
function Slider({ name, value, min, max, step, onChange, format = signedPercent }: {
  name: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; format?: (value: number) => string;
}) {
  return <label className="slider"><span>{name} <strong>{format(value)}</strong></span>
    <input type="range" aria-label={name} min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.valueAsNumber)} aria-valuetext={format(value)} />
    <span className="range-limits"><span>{format(min)}</span><span>{format(max)}</span></span>
  </label>
}
export function ScenarioLab({ data, analysis, asOf, currency, onInspect }: {
  data: Datasets; analysis: Analysis; asOf: string; currency: string; onInspect: (selection: BucketSelection) => void;
}) {
  const pairs = useMemo(() => uniquePairs(analysis.buckets), [analysis.buckets])
  const [controls, setControls] = useState(() => initialControls(pairs[0]?.lane ?? '', pairs[0]?.equipment_type ?? ''))
  const deferred = useDeferredValue(controls)
  const result = useMemo(() => runScenario(data, asOf, toScenario(deferred)), [data, asOf, deferred])
  const pending = controls !== deferred
  const update = <K extends keyof ScenarioControls>(key: K, value: ScenarioControls[K]) => setControls(c => ({ ...c, [key]: value }))
  const metricRows = [
    { name: 'Projected fulfillment based on current modeled capacity', baseline: percent(result.baseline.kpis.projected_fulfillment_pct), scenario: percent(result.scenario.kpis.projected_fulfillment_pct) },
    { name: 'Effective capacity coverage', baseline: coverage(result.baseline.kpis.effective_capacity_coverage), scenario: coverage(result.scenario.kpis.effective_capacity_coverage) },
    { name: 'Expected unfulfilled load-equivalents', baseline: number(result.baseline.kpis.expected_unfulfilled), scenario: number(result.scenario.kpis.expected_unfulfilled) },
    { name: 'Modeled revenue exposure', baseline: money(result.baseline.kpis.modeled_revenue_exposure, currency), scenario: money(result.scenario.kpis.modeled_revenue_exposure, currency) },
    { name: 'Gross take-rate proxy', baseline: percent(result.baseline.kpis.gross_take_rate_proxy), scenario: percent(result.scenario.kpis.gross_take_rate_proxy) },
    { name: 'High / Critical planning buckets', baseline: number(result.baseline.kpis.high_critical_buckets, 0), scenario: number(result.scenario.kpis.high_critical_buckets, 0) },
    { name: 'Number of actions', baseline: number(result.baseline.kpis.action_count, 0), scenario: number(result.scenario.kpis.action_count, 0) },
  ]
  const inspect = (action: Action, context: 'Baseline' | 'Scenario') => {
    const source = context === 'Baseline' ? result.baseline : result.scenario
    const bucket = bucketForAction(action, source.buckets)
    if (bucket) onInspect({ bucket, actions: source.actions, context, actionId: action.action_id })
  }
  return <>
    <div className="section-heading"><div><h2>Scenario Lab</h2><p className="section-intro">What happens if demand, capacity or carrier rates change? Compare the outcome before making a decision.</p></div>
      <button onClick={() => setControls(initialControls(pairs[0]?.lane ?? '', pairs[0]?.equipment_type ?? ''))}>Reset Scenario</button>
    </div>
    <div className="scenario-layout">
      <div className="scenario-controls">
        <fieldset><legend>Global adjustments</legend>
          <Slider name="Global demand change" value={controls.demand} min={-50} max={50} step={5} onChange={v => update('demand', v)} />
          <Slider name="Global carrier capacity change" value={controls.capacity} min={-50} max={50} step={5} onChange={v => update('capacity', v)} />
          <Slider name="Global carrier buy-rate change" value={controls.rate} min={-20} max={20} step={1} onChange={v => update('rate', v)} />
        </fieldset>
        <details className="threshold-controls"><summary>Operating thresholds</summary><fieldset><legend className="sr-only">Operating thresholds</legend>
          <Slider name="Maximum deadhead km" value={controls.maxDeadhead} min={50} max={500} step={25} onChange={v => update('maxDeadhead', v)} format={v => `${v} km`} />
          <Slider name="Minimum reliability" value={controls.minReliability} min={50} max={95} step={5} onChange={v => update('minReliability', v)} format={v => `${v}%`} />
          <Slider name="Commercial floor" value={controls.commercialFloor} min={0} max={30} step={1} onChange={v => update('commercialFloor', v)} format={v => `${v}%`} />
        </fieldset></details>
        <fieldset><legend>Lane &amp; equipment override</legend>
          <label className="checkbox"><input type="checkbox" checked={controls.overrideEnabled} onChange={e => update('overrideEnabled', e.target.checked)} disabled={!pairs.length} />Enable lane override</label>
          <p className="muted">Applied after global changes, only to the selected lane and equipment.</p>
          {controls.overrideEnabled && <>
            <label>Override lane<select value={controls.lane} onChange={e => setControls(c => ({ ...c, lane: e.target.value, equipment: pairs.find(p => p.lane === e.target.value)!.equipment_type }))}>
              {[...new Set(pairs.map(p => p.lane))].map(lane => <option key={lane} value={lane}>{lane}</option>)}
            </select></label>
            <label>Override equipment<select value={controls.equipment} onChange={e => update('equipment', e.target.value)}>
              {pairs.filter(p => p.lane === controls.lane).map(p => <option key={p.equipment_type} value={p.equipment_type}>{p.equipment_type}</option>)}
            </select></label>
            <Slider name="Lane demand change" value={controls.overrideDemand} min={-50} max={50} step={5} onChange={v => update('overrideDemand', v)} />
            <Slider name="Lane carrier capacity change" value={controls.overrideCapacity} min={-50} max={50} step={5} onChange={v => update('overrideCapacity', v)} />
            <Slider name="Lane carrier buy-rate change" value={controls.overrideRate} min={-20} max={20} step={1} onChange={v => update('overrideRate', v)} />
          </>}
        </fieldset>
      </div>
      <div className="scenario-results" aria-busy={pending}>
        <p role="status">{pending ? 'Recalculating scenario… Results below reflect the previous settings until complete.' : 'Scenario results up to date.'}</p>
        <h3>Baseline vs Scenario</h3><p className="muted">Other views keep the baseline. Only this comparison uses your changed assumptions.</p>
        <Table caption="Baseline vs Scenario comparison" rows={metricRows} rowKey={r => r.name} columns={[
          { title: 'Metric', render: r => r.name }, { title: 'Baseline', render: r => r.baseline, numeric: true }, { title: 'Scenario', render: r => r.scenario, numeric: true },
        ]} />
        {([
          ['Newly created actions', result.deltas.new, 'Scenario'], ['Resolved actions', result.deltas.resolved, 'Baseline'],
          ['Actions whose severity increased', result.deltas.increased, 'Scenario'], ['Actions whose severity decreased', result.deltas.decreased, 'Scenario'],
        ] as const).map(([title, actions, context]) => <details className="panel action-delta" key={title} open={actions.length > 0}>
          <summary>{title} <span className="count">{actions.length}</span></summary><ActionTable caption={title} actions={actions} currency={currency} onSelect={a => inspect(a, context)} empty="No action changes in this category." />
        </details>)}
        <details className="panel"><summary>Inspect all scenario planning buckets</summary>
          <Table caption="Scenario planning buckets" rows={result.scenario.buckets} rowKey={b => b.id} onSelect={bucket => onInspect({ bucket, actions: result.scenario.actions, context: 'Scenario' })} columns={[
            { title: 'Lane', render: bucket => <button className="text-button lane" onClick={e => { e.stopPropagation(); onInspect({ bucket, actions: result.scenario.actions, context: 'Scenario' }) }}>{bucket.lane}</button> },
            { title: 'Equipment', render: b => b.equipment_type }, { title: 'Pickup date', render: b => b.pickup_date },
            { title: 'Effective capacity coverage', render: b => coverage(b.effective_capacity_coverage), numeric: true },
          ]} />
        </details>
      </div>
    </div>
  </>
}
