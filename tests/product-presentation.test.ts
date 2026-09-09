import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { analyze } from '../src/analytics/engine'
import { ScenarioLab } from '../src/pages/ScenarioLab'
import { BucketDrawer } from '../src/components/BucketDrawer'
import { OperationsQueue } from '../src/pages/OperationsQueue'
import App from '../src/App'
import { fixture, AS_OF } from './helpers'
it('keeps the scenario comparison bound to engine output, including High/Critical groups', () => {
  const data = fixture(), analysis = analyze(data, AS_OF), before = structuredClone(analysis)
  const html = renderToStaticMarkup(createElement(ScenarioLab, { data, analysis, asOf: AS_OF, currency: 'SAR', onInspect: () => {} }))
  expect(html).toContain('High / Critical planning buckets'); expect(html).toContain('98.0%')
  for (const label of ['Newly created actions', 'Resolved actions', 'Actions whose severity increased', 'Actions whose severity decreased', 'Reset Scenario']) expect(html).toContain(label)
  expect(analysis).toEqual(before)
})
it('shows recommendations before detailed capacity, preserving exact decision text', () => {
  const analysis = analyze(fixture(), AS_OF)
  const html = renderToStaticMarkup(createElement(BucketDrawer, { selection: { bucket: analysis.buckets[0], actions: analysis.actions, context: 'Baseline' }, onClose: () => {} }))
  expect(html.indexOf('Recommended actions')).toBeLessThan(html.indexOf('Capacity &amp; commercial metrics'))
  for (const name of ['Decision summary', 'Why this bucket is at risk', 'Carrier-level capacity', 'Individual capacity blocks', 'Warnings &amp; model provenance']) expect(html).toContain(name)
  expect(html).toContain(analysis.actions[0].recommended_action)
})
it('keeps sample as startup mode with compact source controls and no development labels', () => {
  const html = renderToStaticMarkup(createElement(App))
  expect(html).toContain('Sample data'); expect(html).toContain('Upload data'); expect(html).toContain('Reset to sample data')
  expect(html).not.toMatch(/Phase [234]/)
  const analysis = analyze(fixture(), AS_OF)
  const queue = renderToStaticMarkup(createElement(OperationsQueue, { analysis, asOf: AS_OF, currency: 'SAR', onAction: () => {}, onBucket: () => {} }))
  expect(queue).toContain('98.0%'); expect(queue).toContain('Prioritized action queue')
  expect(queue).toContain('Raw CSV files and rows stay in your browser.')
})
