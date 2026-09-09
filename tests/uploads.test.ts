import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { analyze } from '../src/analytics/engine'
import { runScenario } from '../src/analytics/scenarios'
import { FILE_NAMES, type DatasetName } from '../src/data/schemas'
import { fetchSample, loadSample, serializeDatasets } from '../src/data/sampleLoader'
import { validateCsv, type CsvFiles } from '../src/data/validation'
import { ValidationResults } from '../src/components/ValidationResults'
import { UploadWorkflow } from '../src/components/UploadWorkflow'
import { DATASETS, initialUploadState, inspectUpload, readyToValidate, uploadReducer, type UploadState } from '../src/ui/uploadState'
import { AS_OF, fixture, historyRow, offerRow, upcomingRow } from './helpers'

function put(state: UploadState, dataset: DatasetName, csv: string, token = dataset): UploadState {
  const name = `My ${dataset} export.csv`
  state = uploadReducer(state, { type: 'start', dataset, token, name, size: csv.length })
  return uploadReducer(state, { type: 'loaded', dataset, token, file: inspectUpload(dataset, name, csv.length, csv) })
}
function uploaded(files: CsvFiles = serializeDatasets(fixture())) {
  let state = uploadReducer(initialUploadState(), { type: 'upload' })
  for (const dataset of DATASETS) if (files[dataset] !== undefined) state = put(state, dataset, files[dataset]!)
  return state
}
const validate = (state: UploadState) => uploadReducer(state, { type: 'validate', asOf: AS_OF })
const complete = (state: UploadState = uploaded()) => uploadReducer(validate(state), { type: 'analyze' })
function changeUpcoming(transform: (row: Record<string, unknown>) => Record<string, unknown>) {
  const files = serializeDatasets(fixture())
  files.upcoming = Papa.unparse(fixture().upcoming.map(row => transform({ ...row })))
  return files
}

describe('upload lifecycle and validation boundary', () => {
  it('requires explicit validation and Analyze Data with all four required files', () => {
    const state = uploaded()
    expect(readyToValidate(state)).toBe(true)
    expect(uploadReducer(state, { type: 'analyze' }).snapshot).toBeNull()
    const valid = validate(state)
    expect(valid.validation?.result.errors).toEqual([])
    expect(valid.snapshot).toBeNull()
    expect(uploadReducer(valid, { type: 'analyze' }).snapshot?.analysis).toEqual(analyze(fixture(), AS_OF))
  })
  it.each(['upcoming', 'capacity', 'historical', 'offers'] as DatasetName[])('blocks a missing required %s file', dataset => {
    const files = serializeDatasets(fixture()); delete files[dataset]
    const state = complete(uploaded(files))
    expect(readyToValidate(state)).toBe(false)
    expect(state.snapshot).toBeNull()
  })
  it('allows missing payments, warns, and produces no payment actions', () => {
    const state = complete()
    expect(state.snapshot?.data.payments).toBeUndefined()
    expect(state.validation?.result.warnings).toContainEqual({ dataset: 'payments', message: 'Missing payments file' })
    expect(state.snapshot?.analysis.actions.some(action => action.action_type === 'REVIEW_PAYMENT_EXPOSURE')).toBe(false)
  })
  it('detects exact headers, original name, size and record count including quoted newlines', () => {
    const files = changeUpcoming(row => ({ ...row, customer: 'Shipper, "A"\nDivision' }))
    const file = inspectUpload('upcoming', 'anything.CSV', 1234, files.upcoming!)
    expect(file.mapping.load_id).toBe('load_id')
    expect(file.mapping.customer).toBe('customer')
    expect(file.name).toBe('anything.CSV'); expect(file.size).toBe(1234); expect(file.rowCount).toBe(1)
    expect(complete(uploaded(files)).snapshot?.data.upcoming[0].customer).toBe('Shipper, "A"\nDivision')
  })
  it('automatically maps only supported synonyms and normalized headers', () => {
    const files = changeUpcoming(row => {
      const { equipment_type, customer, load_count, planned_buy_rate, ...rest } = row
      return { ...rest, ' Truck-Type ': equipment_type, shipper: customer, qty: load_count, carrier_rate: planned_buy_rate }
    })
    const state = complete(uploaded(files))
    expect(state.snapshot?.data.upcoming).toEqual(fixture().upcoming)
    expect(inspectUpload('offers', 'x.csv', 0, 'vendor_id,buy_price\nc,1000').mapping).toMatchObject({ carrier_id: 'vendor_id', offered_buy_rate: 'buy_price' })
  })
  it('blocks ambiguity until explicit user resolution and respects that choice', () => {
    const files = changeUpcoming(row => ({ ...row, buy_price: 1100 }))
    let state = uploaded(files)
    expect(readyToValidate(state)).toBe(false)
    expect(complete(state).snapshot).toBeNull()
    state = uploadReducer(state, { type: 'map', dataset: 'upcoming', field: 'planned_buy_rate', header: 'buy_price' })
    expect(complete(state).snapshot?.data.upcoming[0].planned_buy_rate).toBe(1100)
    expect(state.slots.upcoming?.status === 'ready' && state.slots.upcoming.file.csv).toBe(files.upcoming)
  })
  it('allows overriding high-confidence automatic selections', () => {
    let state = uploaded(changeUpcoming(row => ({ ...row, negotiated: 1150 })))
    state = uploadReducer(state, { type: 'map', dataset: 'upcoming', field: 'planned_buy_rate', header: 'negotiated' })
    expect(complete(state).snapshot?.data.upcoming[0].planned_buy_rate).toBe(1150)
  })
  it('blocks required unmapping even after previously successful analysis', () => {
    const state = uploadReducer(complete(), { type: 'map', dataset: 'upcoming', field: 'customer', header: null })
    expect(state.validation).toBeNull(); expect(state.snapshot).toBeNull()
    expect(readyToValidate(state)).toBe(false)
    expect(validateCsv(serializeDatasets(fixture()), AS_OF, undefined, { upcoming: { customer: null } }).data).toBeNull()
  })
  it('allows optional missing and explicitly unmapped fields, including computed lane', () => {
    let state = uploaded(changeUpcoming(row => ({ ...row, lane: 'incorrect lane', currency: 'USD' })))
    for (const field of ['lane', 'currency']) state = uploadReducer(state, { type: 'map', dataset: 'upcoming', field, header: null })
    expect(complete(state).snapshot?.data.upcoming[0]).toMatchObject({ lane: 'a → b', currency: 'SAR' })
    const absent = changeUpcoming(row => { const copy = { ...row }; delete copy.lane; delete copy.currency; return copy })
    expect(complete(uploaded(absent)).snapshot?.data.upcoming).toEqual(fixture().upcoming)
  })
  it('allows optional ambiguous columns to remain unmapped', () => {
    const files = changeUpcoming(row => ({ ...row, LANE: 'other' }))
    expect(complete(uploaded(files)).snapshot?.data.upcoming[0].lane).toBe('a → b')
  })
  it('prevents duplicate column use in the reducer, dropdown, and validation boundary', () => {
    const state = uploaded()
    expect(uploadReducer(state, { type: 'map', dataset: 'upcoming', field: 'customer', header: 'origin' })).toBe(state)
    expect(validateCsv(serializeDatasets(fixture()), AS_OF, undefined, { upcoming: { customer: 'origin' } }).errors).toContainEqual({ dataset: 'upcoming', field: 'origin', message: 'Invalid explicit column mapping' })
    const html = renderToStaticMarkup(createElement(UploadWorkflow, { state, dispatch: () => {} }))
    expect(html).toMatch(/value="origin" disabled=""/)
  })
  it.each([
    ['duplicate IDs', (d: ReturnType<typeof fixture>) => d.upcoming.push({ ...d.upcoming[0] }), 'Duplicate unique ID'],
    ['invalid date', (d: ReturnType<typeof fixture>) => { d.capacity[0].capacity_date = '2026-02-30' }, 'Invalid calendar date'],
    ['negative rates', (d: ReturnType<typeof fixture>) => { d.upcoming[0].planned_buy_rate = -1 }, 'Invalid numeric value'],
    ['mixed currencies', (d: ReturnType<typeof fixture>) => { d.offers[0].currency = 'USD' }, 'V1 supports one currency'],
    ['payment limits', (d: ReturnType<typeof fixture>) => { d.payments = [{ carrier_id: 'c', open_payable: 1, overdue_payable: 2, max_days_overdue: 1, last_payment_date: null, payment_status: 'Overdue', currency: 'SAR' }] }, 'Overdue payable exceeds open payable'],
  ] as const)('preserves existing blocking validation for %s', (_, mutate, message) => {
    const data = fixture(); mutate(data)
    const state = complete(uploaded(serializeDatasets(data)))
    expect(state.validation?.result.errors.some(issue => issue.message.startsWith(message))).toBe(true)
    expect(state.snapshot).toBeNull()
  })
  it('blocks malformed booleans and CSV parse errors without coercion', () => {
    const files = serializeDatasets(fixture()); files.capacity = files.capacity!.replace(',true,', ',maybe,')
    expect(complete(uploaded(files)).validation?.result.errors.some(issue => issue.message === 'Invalid boolean')).toBe(true)
    files.capacity = 'capacity_id,active\nx,true,extra'
    expect(complete(uploaded(files)).snapshot).toBeNull()
  })
  it('allows warning-only data and exposes the validator messages', () => {
    const data = fixture(); data.upcoming[0].planned_buy_rate = 2000
    const state = complete(uploaded(serializeDatasets(data)))
    expect(state.snapshot).not.toBeNull()
    expect(state.validation?.result.warnings).toContainEqual({ dataset: 'upcoming', row: 2, message: 'Negative gross spread' })
  })
  it('retains and displays temporal rows while excluding them from analytics and scenarios', () => {
    const data = fixture()
    data.upcoming.push(upcomingRow({ load_id: 'past-visible', pickup_datetime: '2026-09-07T07:00:00+03:00' }))
    data.historical.push(historyRow({ load_id: 'future-visible', date: '2026-09-08' }))
    data.offers.push(offerRow({ offer_id: 'future-offer-visible', date: '2026-09-08' }))
    const state = complete(uploaded(serializeDatasets(data))), snapshot = state.snapshot!
    expect(snapshot.data.upcoming).toHaveLength(1); expect(snapshot.data.historical).toHaveLength(10); expect(snapshot.data.offers).toHaveLength(20)
    expect(snapshot.analysis.kpis.upcoming_loads).toBe(10)
    expect(runScenario(snapshot.data, snapshot.asOf, { demand: 0.25 }).scenario.kpis.upcoming_loads).toBe(12.5)
    const html = renderToStaticMarkup(createElement(ValidationResults, { result: snapshot.validation }))
    for (const value of ['past-visible', 'future-visible', 'future-offer-visible', 'Past-due upcoming rows', 'Future historical rows excluded', 'Future offers excluded']) expect(html).toContain(value)
  })
  it('never shifts uploaded dates, even when the analysis clock advances', () => {
    const initial = uploaded(), state = uploadReducer(initial, { type: 'validate', asOf: '2026-10-07T08:00:00+03:00' })
    expect(state.validation?.result.pastDue[0].pickup_datetime).toBe(fixture().upcoming[0].pickup_datetime)
    expect(state.validation?.result.data?.capacity[0].capacity_date).toBe(fixture().capacity[0].capacity_date)
    expect(state.validation?.result.data?.historical[0].date).toBe(fixture().historical[0].date)
    expect(state.validation?.result.data?.offers[0].date).toBe(fixture().offers[0].date)
    expect(uploadReducer(state, { type: 'analyze' }).snapshot?.analysis.kpis.upcoming_loads).toBe(0)
  })
  it('contains only uploaded rows, without sample fallback for missing/empty datasets', () => {
    const state = complete()
    expect(state.snapshot?.data).toEqual(fixture())
    expect(state.snapshot?.analysis.buckets.map(bucket => bucket.lane)).toEqual(['a → b'])
    const files = serializeDatasets(fixture()); files.upcoming = files.upcoming!.split('\n')[0]
    expect(complete(uploaded(files)).snapshot?.analysis.kpis.upcoming_loads).toBe(0)
    delete files.capacity
    expect(complete(uploaded(files)).snapshot).toBeNull()
  })
  it.each(['remove', 'start'] as const)('%s invalidates previous validation and analysis immediately', type => {
    const state = uploadReducer(complete(), type === 'remove' ? { type, dataset: 'upcoming' } : { type, dataset: 'upcoming', token: 'replacement', name: 'next.csv', size: 10 })
    expect(state.validation).toBeNull(); expect(state.snapshot).toBeNull(); expect(readyToValidate(state)).toBe(false)
  })
  it('replacement resets mappings and discards late read results after replace/remove/reset', () => {
    let state = complete()
    const file = inspectUpload('upcoming', 'next.csv', 10, 'id\nx')
    state = uploadReducer(state, { type: 'start', dataset: 'upcoming', token: 'new', name: file.name, size: file.size })
    expect(uploadReducer(state, { type: 'loaded', dataset: 'upcoming', token: 'old', file })).toBe(state)
    state = uploadReducer(state, { type: 'loaded', dataset: 'upcoming', token: 'new', file })
    expect(state.slots.upcoming?.status === 'ready' && state.slots.upcoming.file.mapping.load_id).toBeNull()
    for (const event of [{ type: 'remove', dataset: 'upcoming' }, { type: 'reset' }] as const) {
      const cleared = uploadReducer(state, event)
      expect(uploadReducer(cleared, { type: 'loaded', dataset: 'upcoming', token: 'new', file })).toBe(cleared)
    }
  })
  it('manage retains source files/mappings for correction', () => {
    const state = complete(), managed = uploadReducer(state, { type: 'manage' })
    expect(managed.slots).toBe(state.slots); expect(managed.validation).toBe(state.validation); expect(managed.snapshot).toBeNull()
    expect(uploadReducer(managed, { type: 'analyze' }).snapshot?.analysis).toEqual(state.snapshot?.analysis)
  })
  it('rejects non-CSV files and recovers with a replacement CSV', () => {
    expect(() => inspectUpload('upcoming', 'x.xlsx', 1, 'x')).toThrow('Select a CSV file')
    let state = uploadReducer(uploaded(), { type: 'start', dataset: 'upcoming', token: 'bad', name: 'x.xlsx', size: 1 })
    state = uploadReducer(state, { type: 'failed', dataset: 'upcoming', token: 'bad', message: 'Select a CSV file' })
    expect(readyToValidate(state)).toBe(false)
    expect(complete(put(state, 'upcoming', serializeDatasets(fixture()).upcoming!)).snapshot).not.toBeNull()
  })
  it('reset clears uploads and restores known sample analysis through existing fetchSample flow', async () => {
    expect(uploadReducer(complete(), { type: 'reset' })).toEqual(initialUploadState())
    const files = Object.fromEntries(DATASETS.map(dataset => [dataset, readFileSync(`public/sample-data/${FILE_NAMES[dataset]}`, 'utf8')]))
    const metadata = JSON.parse(readFileSync('public/sample-data/sample-metadata.json', 'utf8'))
    const clock = '2026-10-07T08:00:00+03:00'
    const loaded = await fetchSample(clock, (async (input: string | URL | Request) => {
      const name = String(input).split('/').at(-1)!
      return new Response(name === 'sample-metadata.json' ? JSON.stringify(metadata) : readFileSync(`public/sample-data/${name}`, 'utf8'))
    }) as typeof fetch)
    expect(analyze(loaded.data!, clock)).toEqual(analyze(loadSample(files, metadata, clock).data!, clock))
    expect(analyze(loaded.data!, clock).kpis.upcoming_loads).toBe(155)
  })
  it('uploaded scenarios use the same engine, captured timestamp, and immutable baseline', () => {
    const snapshot = complete().snapshot!, before = structuredClone(snapshot.data)
    const scenario = runScenario(snapshot.data, snapshot.asOf, { demand: 0.25, capacity: 0.5 })
    expect(scenario.baseline).toEqual(snapshot.analysis)
    expect(scenario.scenario).toEqual(analyze(scenario.adjusted, AS_OF))
    expect(scenario.scenario.kpis.upcoming_loads).toBe(12.5)
    expect(snapshot.data).toEqual(before)
  })
})
