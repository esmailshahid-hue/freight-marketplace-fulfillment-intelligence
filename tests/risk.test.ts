import { it, expect } from 'vitest'
import { calculateRisk, concentrationRisk, riskBand, urgency } from '../src/analytics/risk'
import { classifyRootCause } from '../src/analytics/rootCause'
import { searchRates } from '../src/analytics/pricing'
it.each([[11.99, 100], [12, 80], [24, 60], [48, 35], [72, 10]])('urgency boundary %s', (h, score) => expect(urgency(h)).toBe(score))
it.each([[.24999, 10], [.25, 30], [.35, 60], [.45, 90]])('concentration boundary %s', (share, score) => expect(concentrationRisk(share)).toBe(score))
it.each([[39.99, 'Low'], [40, 'Medium'], [60, 'High'], [75, 'Critical']])('risk band %s', (score, band) => expect(riskBand(Number(score))).toBe(band))
it('uses the exact risk weights and deterministic reason', () => {
  const r = calculateRisk(.85, 18, .6, .4, true)
  expect(r.components.capacity).toBeCloseTo(50)
  expect(r.score).toBeCloseTo(.45 * 50 + .2 * 80 + .2 * 40 + .15 * 60)
  expect(r.reason).toContain('pickup is in 18.0 hours')
  expect(calculateRisk(1.2, 100, 1, 0, true).components.capacity).toBe(0)
  expect(calculateRisk(.5, 1, 0, 1, false).components.capacity).toBe(100)
})
it('respects root-cause precedence and retains secondary causes', () => {
  const blocked = searchRates(1000, 1100, .5, rate => ({ coverage: rate >= 1100 ? 1.1 : .5, acceptance: .5 }))
  expect(classifyRootCause(1.2, .5, 1.1, .5, .5, 5, blocked)).toEqual({ primary: 'COMMERCIAL_CONSTRAINT', secondary: ['SERVICE_QUALITY', 'CARRIER_CONCENTRATION', 'LATE_BOOKING'] })
  expect(classifyRootCause(.8, .5, .7, .5, .5, 5, blocked).primary).toBe('SUPPLY_SHORTAGE')
  const valid = searchRates(1000, 1500, .5, rate => ({ coverage: rate >= 1100 ? 1.1 : .5, acceptance: .5 }))
  expect(classifyRootCause(1.2, .5, 1.1, .5, .5, 5, valid).primary).toBe('PRICE_COMPETITIVENESS')
  expect(classifyRootCause(1.2, .9, 1.1, .9, .5, 5, null).primary).toBe('SERVICE_QUALITY')
  expect(classifyRootCause(1.2, .9, .95, .8, .5, 5, null).primary).toBe('CARRIER_CONCENTRATION')
  expect(classifyRootCause(1.2, .9, .95, .8, .3, 5, null).primary).toBe('LATE_BOOKING')
  expect(classifyRootCause(1.2, .9, .95, .8, .3, 24, null).primary).toBe('MIXED')
  expect(classifyRootCause(1.5, 1.2, 1.3, .9, .5, 5, null).primary).toBeNull()
})
