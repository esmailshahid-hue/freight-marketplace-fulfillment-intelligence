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
  for (const name of ['Decision summary', 'Bucket details', 'Carrier-level capacity', 'Individual capacity blocks', 'Warnings &amp; model provenance']) expect(html).toContain(name)
  expect(html).toContain(analysis.actions[0].recommended_action)
})
it('keeps sample as startup mode with compact source controls and no development labels', () => {
  const html = renderToStaticMarkup(createElement(App))
  expect(html).toContain('Freight Fulfillment Intelligence'); expect(html).not.toContain('Freight Marketplace Fulfillment')
  for (const copy of ['How it works', 'Review', 'Start with Operations Queue to see which lanes need attention.', 'Investigate', 'Open a flagged lane to understand the cause, capacity gap, pricing, and recommended actions.', 'Test', 'Use Pricing, Supply Gaps, or Scenario Lab to explore the response.']) expect(html).toContain(copy)
  expect(html.indexOf('Find fulfillment gaps.')).toBeLessThan(html.indexOf('How it works'))
  expect(html).toContain('Sample data'); expect(html).toContain('Upload data'); expect(html).toContain('Reset to sample data')
  expect(html).not.toMatch(/Phase [234]/)
  const analysis = analyze(fixture(), AS_OF)
  const queue = renderToStaticMarkup(createElement(OperationsQueue, { analysis, asOf: AS_OF, currency: 'SAR', onAction: () => {}, onBucket: () => {} }))
  expect(queue).toContain('98.0%'); expect(queue).toContain('Prioritized action queue')
  expect(queue).toContain('Only calculated results are sent to the AI provider. Your CSV files stay in your browser.')
  expect(queue).not.toContain('Only a compact computed summary')
})
it('groups related actions once per bucket in engine order without summing overlapping exposure', async () => {
  const { generateSynthetic } = await import('../src/data/synthetic')
  const { NeedsAttention } = await import('../src/components/NeedsAttention')
  const { bucketForAction, actionsForBucket } = await import('../src/ui/selectors')
  const { money } = await import('../src/ui/format')
  const analysis = analyze(generateSynthetic(), AS_OF), before = structuredClone(analysis)
  const groups = [...new Map(analysis.actions.map(a => bucketForAction(a, analysis.buckets)!).map(b => [b.id, b])).values()].slice(0, 3)
  const html = renderToStaticMarkup(createElement(NeedsAttention, { analysis, onAction: () => {} }))
  expect((html.match(/class="attention-card/g) ?? [])).toHaveLength(groups.length)
  for (const b of groups) {
    expect(html).toContain(money(b.modeled_revenue_exposure, b.currency))
    for (const a of actionsForBucket(b, analysis.actions)) expect(html).toContain(a.recommended_action.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;').replaceAll('>', '&gt;').replaceAll('<', '&lt;'))
  }
  expect(html.indexOf(groups[0].lane)).toBeLessThan(html.indexOf(groups[1].lane))
  expect(analysis).toEqual(before)
})
it('shows scenario deterioration as signed display deltas and preserves unavailable states', async () => {
  const { changeLabel } = await import('../src/ui/comparison')
  expect(changeLabel(.822, .74, ' pp', 100)).toBe('−8.2 pp')
  expect(changeLabel(27.6, 39.1, ' loads')).toBe('+11.5 loads')
  expect(changeLabel(0, .02, ' SAR', 1, 2)).toBe('+0.02 SAR')
  expect(changeLabel(null, 1)).toBe('Change unavailable')
  expect(changeLabel(1, 1)).toBe('No change')
  const { ScenarioComparison } = await import('../src/components/ScenarioComparison')
  const baseline = analyze(fixture(), AS_OF).kpis
  const html = renderToStaticMarkup(createElement(ScenarioComparison, { baseline, scenario: { ...baseline, expected_unfulfilled: baseline.expected_unfulfilled + 4 }, currency: 'SAR' }))
  expect(html).toContain('metric-delta negative'); expect(html).toContain('+4.0 loads')
})
it('uses the commercial trade-off label across action displays while preserving recommendations and enums', async () => {
  const { generateSynthetic } = await import('../src/data/synthetic')
  const { NeedsAttention } = await import('../src/components/NeedsAttention')
  const { ActionTable } = await import('../src/components/ActionTable')
  const { bucketForAction } = await import('../src/ui/selectors')
  const { label } = await import('../src/ui/format')
  const analysis = analyze(generateSynthetic(), AS_OF), before = structuredClone(analysis)
  const action = analysis.actions.find(a => a.action_type === 'ESCALATE_COMMERCIAL_CONSTRAINT')!
  expect(label(action.action_type)).toBe('Review commercial trade-off')
  expect(label('PREBOOK_CAPACITY')).toBe('Pre-book capacity')
  const views = [
    createElement(OperationsQueue, { analysis, asOf: AS_OF, currency: 'SAR', onAction: () => {}, onBucket: () => {} }),
    createElement(NeedsAttention, { analysis, onAction: () => {} }),
    createElement(ActionTable, { actions: [action], currency: 'SAR', onSelect: () => {}, caption: 'Scenario actions' }),
    createElement(BucketDrawer, { selection: { bucket: bucketForAction(action, analysis.buckets)!, actions: analysis.actions, context: 'Baseline' }, onClose: () => {} }),
  ]
  for (const view of views) {
    const html = renderToStaticMarkup(view)
    expect(html).toContain('Review commercial trade-off')
    expect(html).not.toContain('Escalate commercial constraint')
  }
  expect(analysis).toEqual(before)
})
