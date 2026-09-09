// Presentation only: do not round inputs passed to the analytics engine.
export const UNAVAILABLE = 'Unavailable'
const usable = (value: number | null | undefined): value is number => value != null && Number.isFinite(value)
export const number = (value: number | null | undefined, digits = 1) => usable(value)
  ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : UNAVAILABLE
export const percent = (value: number | null | undefined) => usable(value) ? `${number(value * 100)}%` : UNAVAILABLE
export const coverage = (value: number | null | undefined) => usable(value) ? `${number(value, 2)}×` : UNAVAILABLE
export const money = (value: number | null | undefined, currency = 'SAR') => usable(value) ? `${currency} ${number(value, 2)}` : UNAVAILABLE
export const label = (value: string | null | undefined) => value === 'PRICE_COMPETITIVENESS' ? 'Pricing competitiveness' : value ? value.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) : 'None'
export const dateLabel = (date: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
export const suggestedRate = (value: number, currency: string) => `Approximately ${money(Math.round(value / 25) * 25, currency)}`
export const signedPercent = (wholePercent: number) => `${wholePercent > 0 ? '+' : ''}${wholePercent}%`
export const TAKE_RATE_HELP = 'Demo measure calculated as (sell revenue - carrier buy cost) / sell revenue. Actual marketplace accounting definitions may differ.'
