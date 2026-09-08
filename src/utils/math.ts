export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
export const sum = <T>(rows: readonly T[], value: (row: T) => number) => rows.reduce((n, r) => n + value(r), 0)
export const mean = (xs: number[]) => xs.length ? sum(xs, x => x) / xs.length : null
export function median(xs: number[]) {
  if (!xs.length) return null
  const sorted = [...xs].sort((a, b) => a - b), i = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2
}
export const key = (...parts: string[]) => JSON.stringify(parts)
export function normalize(x: number, values: number[]) {
  const lo = Math.min(...values), hi = Math.max(...values)
  return hi === lo ? (hi > 0 ? 50 : 0) : 100 * (x - lo) / (hi - lo)
}
