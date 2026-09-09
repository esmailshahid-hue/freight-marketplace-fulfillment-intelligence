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
