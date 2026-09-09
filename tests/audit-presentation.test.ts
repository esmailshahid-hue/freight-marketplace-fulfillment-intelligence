import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { analyze } from '../src/analytics/engine'
import { generateSynthetic } from '../src/data/synthetic'
import { validateCsv } from '../src/data/validation'
import { loadSample, serializeDatasets } from '../src/data/sampleLoader'
import { DisplayLabelContext } from '../src/ui/displayLabels'
import { actionReason } from '../src/ui/actionReason'
import { restoringCandidate, rateOpportunity } from '../src/ui/ratePresentation'
import { buildBriefContext } from '../src/brief/context'
import { money, suggestedRate, moneyChange } from '../src/ui/format'
import { OperationsQueue } from '../src/pages/OperationsQueue'
import { CapacityFulfillment } from '../src/pages/CapacityFulfillment'
import { PricingEconomics } from '../src/pages/PricingEconomics'
import { SupplyGaps } from '../src/pages/SupplyGaps'
import { ScenarioLab } from '../src/pages/ScenarioLab'
import { BucketDrawer } from '../src/components/BucketDrawer'
import { RateScenario } from '../src/components/RateScenario'
import { fixture, AS_OF } from './helpers'
const html = (element: ReactElement) => renderToStaticMarkup(element)
const sample = () => analyze(generateSynthetic(), AS_OF)
it('uses the actual action trigger as its reason, without repeating generic coverage evidence', () => {
  const analysis = sample(), before = structuredClone(analysis)
  for (const action of analysis.actions) {
    const bucket = analysis.buckets.find(b => b.lane === action.lane && b.equipment_type === action.equipment_type && b.pickup_date === action.pickup_date)!
    const reason = actionReason(action, bucket)
    switch (action.action_type) {
      case 'PREBOOK_CAPACITY': expect(reason.detail).toContain('Weekly baseline'); expect(reason.detail).not.toContain('Raw coverage'); break
      case 'REVIEW_PAYMENT_EXPOSURE': expect(reason.detail).toContain('Carrier share'); expect(reason.detail).toMatch(/Overdue payable SAR [\d,]+/); expect(reason.detail).not.toContain('Raw coverage'); break
      case 'SECURE_CAPACITY': expect(reason.detail).toContain('qualified trucks'); expect(reason.detail).toContain('Raw coverage'); break
      case 'RAISE_BUY_RATE': expect(reason.detail).toContain('Acceptance'); expect(reason.detail).toContain('floor'); break
      case 'ACTIVATE_BACKUP_CARRIERS': expect(reason.detail).toContain('Top carrier share'); break
      case 'REVIEW_SERVICE_QUALITY': expect(reason.detail).toContain('before reliability'); break
      case 'ESCALATE_COMMERCIAL_CONSTRAINT': expect(reason.detail).toContain('below 10.0% floor'); break
    }
  }
  expect(analysis).toEqual(before)
})
it('surfaces restoring commercial candidates without recommending them or offering rates for physical shortages', () => {
  const analysis = sample(), constrained = analysis.buckets.find(b => b.root_cause.primary === 'COMMERCIAL_CONSTRAINT')!
  const restoring = restoringCandidate(constrained)!
  expect(restoring.buy_rate).toBeCloseTo(2353.2)
  expect(constrained.rate_search!.recommendation).toBeNull()
  const view = html(createElement(PricingEconomics, { buckets: analysis.buckets, currency: 'SAR', onBucket: () => {} }))
  expect(view).toContain('Below commercial floor'); expect(view).toContain('~ SAR 2,350')
  expect(view).toContain('8.1%, below the 10.0% floor')
  expect(view).toContain('Physical shortage')
  const shortage = analysis.buckets.find(b => b.raw_capacity_coverage < 1)!
  expect(rateOpportunity(shortage)).toBeNull()
  expect(analysis.actions.some(a => a.lane === shortage.lane && a.action_type === 'RAISE_BUY_RATE')).toBe(false)
  const healthy = analysis.buckets.find(b => b.status === 'Healthy')!
  expect(rateOpportunity(healthy)).toBeNull()
})
it('presents one rounded recommendation everywhere, retaining exact candidates only in supporting detail', () => {
  const analysis = sample(), b = analysis.buckets.find(b => b.rate_search?.recommendation)!, before = structuredClone(b)
  const rate = suggestedRate(b.rate_search!.recommendation!.buy_rate, 'SAR')
  expect(rate).toBe('Approximately SAR 3,150')
  expect(html(createElement(PricingEconomics, { buckets: [b], currency: 'SAR', onBucket: () => {} }))).toContain(rate)
  const detail = html(createElement(RateScenario, { bucket: b }))
  expect(detail).toContain(rate); expect(detail).toMatch(/<details><summary>Underlying model values<\/summary>/)
  expect(detail).toContain('SAR 3,137.60')
  expect(analysis.actions.find(a => a.lane === b.lane && a.action_type === 'RAISE_BUY_RATE')!.recommended_action).toContain('approximately SAR 3,150')
  expect(b).toEqual(before)
  expect(money(18000)).toBe('SAR 18,000'); expect(money(0)).toBe('SAR 0'); expect(money(-.1)).toBe('SAR 0')
  expect(moneyChange(100000, 43202.4, 'SAR')).toBe('SAR −56,798')
  expect(moneyChange(0, 2000, 'USD')).toBe('USD +2,000.00')
})
it('preserves first source casing across all views, filters and brief context while matching normalized keys', () => {
  const d = fixture()
  for (const row of [...d.upcoming, ...d.capacity, ...d.historical, ...d.offers]) { row.lane = 'jip -> kaec / neom'; row.equipment_type = 'iso_tank' }
  d.upcoming[0].lane = 'JIP → KAEC / NEOM'; d.upcoming[0].equipment_type = 'ISO Tank'
  const validation = validateCsv(serializeDatasets(d), AS_OF), data = validation.data!, analysis = analyze(data, AS_OF)
  expect(data.upcoming[0].lane).toBe('jip → kaec / neom'); expect(data.upcoming[0].equipment_type).toBe('iso tank')
  expect(analysis.buckets).toHaveLength(1); expect(analysis.buckets[0].capacity.raw).toBe(10)
  const elements = [
    createElement(OperationsQueue, { analysis, asOf: AS_OF, currency: 'SAR', onAction: () => {}, onBucket: () => {} }),
    createElement(CapacityFulfillment, { buckets: analysis.buckets, onBucket: () => {} }),
    createElement(PricingEconomics, { buckets: analysis.buckets, currency: 'SAR', onBucket: () => {} }),
    createElement(SupplyGaps, { gaps: analysis.supply_gaps, currency: 'SAR' }),
    createElement(ScenarioLab, { data, analysis, asOf: AS_OF, currency: 'SAR', onInspect: () => {} }),
    createElement(BucketDrawer, { selection: { bucket: analysis.buckets[0], actions: analysis.actions, context: 'Baseline' }, onClose: () => {} }),
  ]
  for (const element of elements) {
    const markup = html(createElement(DisplayLabelContext.Provider, { value: validation.displayLabels }, element))
    expect(markup).toContain('JIP → KAEC / NEOM'); expect(markup).toContain('ISO Tank')
  }
  const context = buildBriefContext(analysis, AS_OF, 'SAR', validation.displayLabels)
  expect(context.at_risk_buckets[0]).toMatchObject({ lane: 'JIP → KAEC / NEOM', equipment: 'ISO Tank' })
  expect(context.top_actions[0].lane).toBe('JIP → KAEC / NEOM')
  const shifted = loadSample(serializeDatasets(d), { sample_as_of: AS_OF, currency: 'SAR', seed: 42 }, '2026-10-07T08:00:00+03:00')
  expect(shifted.displayLabels).toEqual(validation.displayLabels)
})
it('computes a source display lane when the optional lane column is blank', () => {
  const d = fixture(); d.upcoming[0].lane = ''; d.upcoming[0].origin = 'KAEC'; d.upcoming[0].destination = 'NEOM Region'
  const result = validateCsv(serializeDatasets(d), AS_OF)
  expect(result.displayLabels.lanes['kaec → neom region']).toBe('KAEC → NEOM Region')
  expect(result.data!.upcoming[0].lane).toBe('kaec → neom region')
})
it('uses a neutral heading for healthy and concentration-only drilldowns', () => {
  const a = sample(), concentration = analyze(fixture(), AS_OF)
  expect(concentration.buckets[0].root_cause.primary).toBe('CARRIER_CONCENTRATION')
  for (const b of [a.buckets.find(b => b.status === 'Healthy')!, concentration.buckets[0]]) {
    const view = html(createElement(BucketDrawer, { selection: { bucket: b, actions: [], context: 'Baseline' }, onClose: () => {} }))
    expect(view).toContain('Bucket details'); expect(view).not.toContain('Why this bucket is at risk')
  }
  const atRisk = a.buckets.find(b => b.root_cause.primary === 'SUPPLY_SHORTAGE')!
  expect(html(createElement(BucketDrawer, { selection: { bucket: atRisk, actions: a.actions, context: 'Baseline' }, onClose: () => {} }))).toContain('Why this bucket is at risk')
})
