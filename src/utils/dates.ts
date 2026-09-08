export const DAY = 86_400_000
// Explicit timezone makes analytics independent of the host/browser timezone.
export const DEFAULT_TIME_ZONE = 'Asia/Riyadh'
export function localDate(value: string | number, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(typeof value === 'string' ? timestamp(value, timeZone) : value))
  const get = (type: string) => parts.find(p => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export const dateNumber = (date: string) => Date.parse(`${date}T00:00:00Z`)
export const addDays = (date: string, days: number) => new Date(dateNumber(date) + days * DAY).toISOString().slice(0, 10)
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dateNumber(value)) && new Date(dateNumber(value)).toISOString().slice(0, 10) === value
}
export function validDatetime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(value) && validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
}
export function inLookback(date: string, asOf: string, days: number, timeZone = DEFAULT_TIME_ZONE) {
  const end = localDate(asOf, timeZone)
  return date >= addDays(end, -days) && date <= end
}

// ISO datetimes without an offset use the explicit planning timezone, never the host timezone.
export function timestamp(value: string, timeZone = DEFAULT_TIME_ZONE): number {
  if (/(Z|[+-]\d{2}:\d{2})$/.test(value)) return Date.parse(value)
  const nominal = Date.parse(`${value}Z`)
  if (!Number.isFinite(nominal)) return NaN
  let instant = nominal
  for (let i = 0; i < 3; i++) {
    const name = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(instant).find(p => p.type === 'timeZoneName')!.value
    const match = name.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
    const minutes = match ? (match[1] === '+' ? 1 : -1) * (+match[2] * 60 + +(match[3] ?? 0)) : 0
    const next = nominal - minutes * 60_000
    if (next === instant) break
    instant = next
  }
  return instant
}
