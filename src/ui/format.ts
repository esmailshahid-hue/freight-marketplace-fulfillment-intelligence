export { money, suggestedRate, moneyChange, moneyDigits } from '../utils/money.js'
// Presentation only: do not round inputs passed to the analytics engine.
export const UNAVAILABLE = 'Unavailable'
const usable = (value: number | null | undefined): value is number => value != null && Number.isFinite(value)
export const number = (value: number | null | undefined, digits = 1) => usable(value)
  ? value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : UNAVAILABLE
export const percent = (value: number | null | undefined) => usable(value) ? `${number(value * 100)}%` : UNAVAILABLE
export const coverage = (value: number | null | undefined) => usable(value) ? `${number(value, 2)}×` : UNAVAILABLE
export const label = (value: string | null | undefined) => value === 'ESCALATE_COMMERCIAL_CONSTRAINT' ? 'Review commercial trade-off' : value === 'PRICE_COMPETITIVENESS' ? 'Pricing competitiveness' : value ? value.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) : 'None'
const displayDateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
export const dateLabel = (date: string) => displayDateFormatter.format(new Date(`${date}T00:00:00Z`))
export const signedPercent = (wholePercent: number) => `${wholePercent > 0 ? '+' : ''}${wholePercent}%`
export const TAKE_RATE_HELP = 'Demo measure calculated as (sell revenue - carrier buy cost) / sell revenue. Actual marketplace accounting definitions may differ.'
