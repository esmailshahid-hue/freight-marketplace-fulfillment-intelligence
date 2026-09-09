import { number } from './format'

// Display differences between engine outputs; never fed back into analytics.
export function displayedChange(before: number | null, after: number | null, scale = 1, digits = 1) {
  return before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after)
    ? null : Number(((after - before) * scale).toFixed(digits))
}
export function changeLabel(before: number | null, after: number | null, unit = '', scale = 1, digits = 1) {
  const change = displayedChange(before, after, scale, digits)
  return change === null ? 'Change unavailable' : change === 0 ? 'No change' : `${change > 0 ? '+' : '−'}${number(Math.abs(change), digits)}${unit}`
}
