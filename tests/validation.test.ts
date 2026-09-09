import { it, expect } from 'vitest'
import { validateCsv } from '../src/data/validation'
import { serializeDatasets } from '../src/data/sampleLoader'
import { mapColumns } from '../src/data/mapping'
import { fixture, AS_OF, capacityRow, historyRow } from './helpers'
const check = (d = fixture()) => validateCsv(serializeDatasets(d), AS_OF)
it('round-trips CSV quoting, Unicode, newlines, and optional values', () => {
  const d = fixture(); d.upcoming[0].customer = 'Customer, "A"\nDivision'
  const r = check(d)
  expect(r.errors).toEqual([]); expect(r.data?.upcoming[0].customer).toBe(d.upcoming[0].customer)
  expect(r.data?.offers[0].sell_rate).toBeNull()
  expect(r.warnings.some(w => w.message === 'Missing payments file')).toBe(true)
})
it('blocks missing files/columns, duplicate IDs, and ambiguous mappings', () => {
  expect(validateCsv({}, AS_OF).data).toBeNull()
  expect(validateCsv({ ...serializeDatasets(fixture()), upcoming: 'customer\nBob' }, AS_OF).errors.some(e => e.field === 'load_id')).toBe(true)
  const d = fixture(); d.upcoming.push({ ...d.upcoming[0] })
  expect(check(d).errors.some(e => e.message === 'Duplicate unique ID')).toBe(true)
  expect(mapColumns('upcoming', ['equipment_type', 'Vehicle Type']).unresolved).toContain('equipment_type')
  expect(mapColumns('offers', [' Carrier-Rate ', ' Vendor ID ']).mapping).toMatchObject({ offered_buy_rate: ' Carrier-Rate ', carrier_id: ' Vendor ID ' })
})
it.each(['0', '-1', 'NaN', 'Infinity', 'garbage', '0x20', ''])('blocks invalid planned rates %s', value => {
  const files = serializeDatasets(fixture())
  files.upcoming = files.upcoming!.replace(',1000,Standard', `,${value},Standard`)
  expect(validateCsv(files, AS_OF).data).toBeNull()
})
it.each([0, -1, 1.5])('blocks invalid load count %s', load_count => {
  const d = fixture(); d.upcoming[0].load_count = load_count; expect(check(d).data).toBeNull()
})
it('allows zero capacity, warns additive blocks, and blocks negatives', () => {
  const d = fixture(); d.capacity.push(capacityRow({ capacity_id: 'new', available_trucks: 0 }))
  expect(check(d).warnings.some(w => w.message === 'Possible duplicated capacity blocks — confirm these rows are additive.')).toBe(true)
  expect(check(d).data?.capacity).toHaveLength(2)
  d.capacity[0].available_trucks = -1; expect(check(d).data).toBeNull()
  d.capacity[0].available_trucks = 1; d.capacity[0].deadhead_km_to_origin = -1; expect(check(d).data).toBeNull()
})
it('validates real dates and booleans without coercing malformed data', () => {
  const d = fixture(); d.upcoming[0].pickup_datetime = '2026-02-30T08:00:00Z'
  expect(check(d).data).toBeNull()
  const files = serializeDatasets(fixture()); files.capacity = files.capacity!.replace(',true,', ',perhaps,')
  expect(validateCsv(files, AS_OF).data).toBeNull()
  for (const value of ['1', '0', 'true', 'false', 'yes', 'no']) {
    files.capacity = serializeDatasets(fixture()).capacity!.replace(',true,', `,${value},`)
    expect(validateCsv(files, AS_OF).errors).toEqual([])
  }
})
it('flags negative spread, retains past-due rows and excludes future history', () => {
  const d = fixture(); d.upcoming[0].planned_buy_rate = 2000
  d.upcoming.push({ ...d.upcoming[0], load_id: 'past', pickup_datetime: '2026-09-07T07:59:59+03:00' })
  d.historical.push(historyRow({ load_id: 'future', date: '2026-09-08' }))
  d.offers[0].date = '2026-09-08'
  const r = check(d)
  expect(r.data?.upcoming).toHaveLength(1); expect(r.pastDue).toHaveLength(1)
  expect(r.futureHistorical).toHaveLength(1); expect(r.futureOffers).toHaveLength(1)
  expect(r.warnings.some(w => w.message === 'Negative gross spread')).toBe(true)
})
it('enforces single currency including optional payments', () => {
  const d = fixture(); d.offers[0].currency = 'USD'
  expect(check(d).errors.some(e => e.message.startsWith('V1 supports one currency'))).toBe(true)
  d.offers[0].currency = ''
  expect(check(d).data?.offers[0].currency).toBe('SAR')
})
it('warns contradictory service outcomes, validates assignment and payment amounts', () => {
  const d = fixture(); d.historical[0].cancelled = true
  expect(check(d).data?.historical[0].fulfilled).toBe(true)
  expect(check(d).warnings.some(w => w.message.includes('Inconsistent'))).toBe(true)
  d.historical[0].final_buy_rate = null; expect(check(d).data).toBeNull()
  d.historical[0].carrier_id = null; d.historical[0].fulfilled = false
  expect(check(d).data).not.toBeNull()
  d.payments = [{ carrier_id: 'c', open_payable: 10, overdue_payable: 11, max_days_overdue: 0, last_payment_date: null, payment_status: 'Overdue', currency: 'SAR' }]
  expect(check(d).data).toBeNull()
})
it('supports explicit resolution of ambiguous headers without rewriting CSV input', () => {
  const files = serializeDatasets(fixture())
  files.upcoming = files.upcoming!.replace('planned_buy_rate', 'buy_price,carrier_rate').replace(',1000,Standard', ',1000,1100,Standard')
  const original = files.upcoming
  expect(validateCsv(files, AS_OF).data).toBeNull()
  expect(validateCsv(files, AS_OF, 'Asia/Riyadh', { upcoming: { planned_buy_rate: 'carrier_rate' } }).data?.upcoming[0].planned_buy_rate).toBe(1100)
  expect(files.upcoming).toBe(original)
  expect(validateCsv(files, AS_OF, 'Asia/Riyadh', { upcoming: { planned_buy_rate: 'nonexistent' } }).data).toBeNull()
})
it('allows non-applicable service fields on never-assigned unfulfilled loads', () => {
  const d = fixture()
  d.historical = [historyRow({ carrier_id: null, final_buy_rate: null, fulfilled: false, pickup_ontime: null, delivery_ontime: null })]
  const r = check(d)
  expect(r.errors).toEqual([])
  expect(r.warnings.filter(w => w.dataset === 'historical')).toEqual([])
  expect(r.data?.historical[0].pickup_ontime).toBeNull()
  expect(r.data?.historical[0].delivery_ontime).toBeNull()
})
it.each([
  { carrier_id: 'c', fulfilled: false },
  { carrier_id: 'c', fulfilled: true },
  { carrier_id: null, fulfilled: true },
])('retains missing service warnings where service may apply: %j', values => {
  const d = fixture(); d.historical = [historyRow({ ...values, pickup_ontime: null })]
  const r = check(d)
  expect(r.errors).toEqual([])
  expect(r.warnings.some(w => w.message === 'Missing pickup/delivery service metrics')).toBe(true)
})
it('still rejects invalid service booleans on never-assigned loads', () => {
  const d = fixture(); d.historical = [historyRow({ carrier_id: null, final_buy_rate: null, fulfilled: false, pickup_ontime: null, delivery_ontime: null })]
  const files = serializeDatasets(d)
  files.historical = files.historical!.replace(',false,,,', ',false,unknown,,')
  expect(validateCsv(files, AS_OF).errors.some(e => e.field === 'pickup_ontime' && e.message === 'Invalid boolean')).toBe(true)
})
it('keeps the committed sample clean except for its genuine additive-block warning', async () => {
  const { readFileSync } = await import('node:fs')
  const { FILE_NAMES } = await import('../src/data/schemas')
  const files = Object.fromEntries(Object.entries(FILE_NAMES).map(([dataset, filename]) => [dataset, readFileSync(new URL(`../public/sample-data/${filename}`, import.meta.url), 'utf8')]))
  const metadata = JSON.parse(readFileSync(new URL('../public/sample-data/sample-metadata.json', import.meta.url), 'utf8'))
  const r = validateCsv(files, metadata.sample_as_of)
  expect(r.errors).toEqual([])
  expect(r.warnings).toHaveLength(1)
  expect(r.warnings[0].message).toBe('Possible duplicated capacity blocks — confirm these rows are additive.')
  expect(r.data?.historical).toHaveLength(1200)
})
