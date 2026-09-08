import { readFile } from 'node:fs/promises'
import { FILE_NAMES, type DatasetName } from '../src/data/schemas'
import { validateCsv } from '../src/data/validation'
import { analyze } from '../src/analytics/engine'
import { SAMPLE_METADATA } from '../src/data/synthetic'
const files = Object.fromEntries(await Promise.all((Object.keys(FILE_NAMES) as DatasetName[]).map(async k => [k, await readFile(new URL(`../public/sample-data/${FILE_NAMES[k]}`, import.meta.url), 'utf8')])))
const checked = validateCsv(files, SAMPLE_METADATA.sample_as_of)
if (!checked.data) throw new Error(JSON.stringify(checked.errors))
const result = analyze(checked.data, SAMPLE_METADATA.sample_as_of)
console.table(result.buckets.map(b => ({ lane: b.lane, raw: b.raw_capacity_coverage.toFixed(3), effective: b.effective_capacity_coverage.toFixed(3), acceptance: b.capacity.weighted_acceptance.toFixed(3), growth: b.baseline.demand_growth_pct?.toFixed(3), root: b.root_cause.primary, actions: result.actions.filter(a => a.lane === b.lane).map(a => a.action_type).join(', ') })))
console.log(JSON.stringify(result.kpis, null, 2))
console.log('Supply-gap ranking:', result.supply_gaps.slice(0, 3).map(r => r.lane))
