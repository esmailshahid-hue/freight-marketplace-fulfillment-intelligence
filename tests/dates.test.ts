import { it, expect } from 'vitest'
import { timestamp, localDate, validDate } from '../src/utils/dates'
import { analyze } from '../src/analytics/engine'
import { fixture, AS_OF } from './helpers'
it('uses explicit timezone for offset-less ISO timestamps and calendar buckets', () => {
  expect(timestamp('2026-09-07T08:00:00')).toBe(Date.parse(AS_OF))
  expect(localDate('2026-09-07T23:00:00Z')).toBe('2026-09-08')
  expect(timestamp('2026-09-07T08:00:00', 'America/New_York')).toBe(Date.parse('2026-09-07T12:00:00Z'))
  const d = fixture(), original = analyze(d, AS_OF)
  d.upcoming[0].pickup_datetime = '2026-09-07T20:00:00'
  expect(analyze(d, '2026-09-07T08:00:00')).toEqual(original)
})
it('rejects invalid calendar dates and accepts leap days', () => {
  expect(validDate('2026-02-29')).toBe(false); expect(validDate('2028-02-29')).toBe(true)
  expect(validDate('2026-13-01')).toBe(false)
})
it('reuses formatters without reusing timezone offsets across DST or timezone changes', () => {
  for (let i = 0; i < 3; i++) {
    expect(timestamp('2026-07-07T08:00:00', 'America/New_York')).toBe(Date.parse('2026-07-07T12:00:00Z'))
    expect(timestamp('2026-12-07T08:00:00', 'America/New_York')).toBe(Date.parse('2026-12-07T13:00:00Z'))
    expect(timestamp('2026-07-07T08:00:00', 'Asia/Kolkata')).toBe(Date.parse('2026-07-07T02:30:00Z'))
    expect(localDate('2026-07-07T01:00:00Z', 'America/New_York')).toBe('2026-07-06')
    expect(localDate('2026-07-07T01:00:00Z', 'Asia/Riyadh')).toBe('2026-07-07')
  }
})
