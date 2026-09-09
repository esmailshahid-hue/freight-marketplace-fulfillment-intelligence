import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { DataStatus } from '../src/components/DataStatus'
import { dataStatusIssues } from '../src/ui/dataStatus'
import { validateCsv } from '../src/data/validation'
import { serializeDatasets } from '../src/data/sampleLoader'
import { fixture, AS_OF } from './helpers'

function duplicateBlocks() {
  const data = fixture()
  data.capacity.push({ ...data.capacity[0], capacity_id: 'additive-block' })
  data.payments = [{ carrier_id: 'c', open_payable: 0, overdue_payable: 0, max_days_overdue: 0, last_payment_date: null, payment_status: 'Current', currency: 'SAR' }]
  const validation = validateCsv(serializeDatasets(data), AS_OF)
  expect(validation.errors).toEqual([])
  expect(validation.warnings).toHaveLength(1)
  return { data, validation }
}
it('shows the intentional sample event as a neutral note without changing validation output', () => {
  const props = duplicateBlocks(), before = structuredClone(props.validation)
  const html = renderToStaticMarkup(createElement(DataStatus, { ...props, source: 'sample' }))
  expect(html).toContain('<summary>Data status: sample loaded</summary>')
  expect(html).toContain('1 data note')
  expect(html).toContain('Sample contains intentional additive capacity blocks used to demonstrate carrier-level concentration.')
  expect(html).toContain('Warnings (0)')
  expect(dataStatusIssues(props.validation.warnings, 'sample').warnings).toEqual([])
  expect(props.validation).toEqual(before)
})
it('keeps the same additive capacity event as a visible warning for uploaded data', () => {
  const props = duplicateBlocks()
  const html = renderToStaticMarkup(createElement(DataStatus, { ...props, source: 'upload' }))
  expect(html).toContain('uploaded data loaded · 1 warning')
  expect(html).toContain(props.validation.warnings[0].message)
  expect(html).not.toContain('data note')
  expect(dataStatusIssues(props.validation.warnings, 'upload').warnings).toEqual(props.validation.warnings)
})
it('continues counting and displaying genuine sample warnings alongside notes', () => {
  const props = duplicateBlocks()
  props.data.upcoming[0].planned_buy_rate = props.data.upcoming[0].sell_rate + 1
  props.validation = validateCsv(serializeDatasets(props.data), AS_OF)
  const html = renderToStaticMarkup(createElement(DataStatus, { ...props, source: 'sample' }))
  expect(html).toContain('sample loaded · 1 warning')
  expect(html).toContain('1 data note')
  expect(html).toContain('Negative gross spread')
})
it('matches the exact capacity message, never partial wording or another dataset', () => {
  const original = duplicateBlocks().validation.warnings[0]
  const issues = [{ ...original, message: original.message + ' Investigate.' }, { ...original, dataset: 'historical' as const }]
  expect(dataStatusIssues(issues, 'sample')).toEqual({ notes: [], warnings: issues })
})
it('counts non-temporal warnings consistently and reports exclusions separately without deleting events', () => {
  const { data } = duplicateBlocks()
  data.upcoming[0].planned_buy_rate = data.upcoming[0].sell_rate + 1
  delete data.payments
  for (let i = 0; i < 4; i++) data.upcoming.push({ ...data.upcoming[0], planned_buy_rate: 1000, load_id: `past-${i}`, pickup_datetime: '2026-09-06T08:00:00+03:00' })
  data.historical.push({ ...data.historical[0], load_id: 'future-history', date: '2026-09-08' })
  data.offers.push({ ...data.offers[0], offer_id: 'future-offer', date: '2026-09-08' })
  const validation = validateCsv(serializeDatasets(data), AS_OF), before = structuredClone(validation)
  const markup = renderToStaticMarkup(createElement(DataStatus, { data: validation.data!, validation, source: 'upload' }))
  expect(markup).toContain('uploaded data loaded · 3 warnings · 4 past-due rows excluded · 1 future historical rows excluded · 1 future offers excluded')
  expect(markup).toContain('Warnings (3)')
  expect(validation.warnings).toHaveLength(9)
  expect(validation).toEqual(before)
})
it('retains outside-horizon rows for review, displays a neutral count, and respects the inclusive seven-day boundary', async () => {
  const { analyze } = await import('../src/analytics/engine')
  const { runScenario } = await import('../src/analytics/scenarios')
  const data = fixture()
  data.upcoming.push({ ...data.upcoming[0], load_id: 'at-horizon', pickup_datetime: '2026-09-14T08:00:00+03:00', load_count: 1 })
  data.upcoming.push({ ...data.upcoming[0], load_id: 'just-outside', pickup_datetime: '2026-09-14T08:00:00.001+03:00', load_count: 99 })
  data.upcoming.push({ ...data.upcoming[0], load_id: 'later-outside', pickup_datetime: '2026-09-20T08:00:00+03:00', load_count: 99 })
  const validation = validateCsv(serializeDatasets(data), AS_OF)
  expect(validation.data!.upcoming).toHaveLength(4)
  expect(validation.outsideHorizon.map(r => r.load_id)).toEqual(['just-outside', 'later-outside'])
  expect(validation.errors).toEqual([])
  expect(validation.warnings.some(w => w.message.includes('horizon'))).toBe(false)
  expect(analyze(validation.data!, AS_OF).kpis.upcoming_loads).toBe(11)
  expect(runScenario(validation.data!, AS_OF, { demand: .25 }).scenario.kpis.upcoming_loads).toBe(13.75)
  const markup = renderToStaticMarkup(createElement(DataStatus, { data: validation.data!, validation, source: 'upload' }))
  expect(markup).toContain('2 upcoming rows outside the 7-day horizon')
  expect(markup).toContain('just-outside'); expect(markup).toContain('later-outside')
})
