// Display only. Analytical candidates and amounts are never rounded in storage or calculations.
export const RATE_DISPLAY_INCREMENT = 25
export const moneyDigits = (currency: string) => currency === 'SAR' ? 0 : 2
export function money(value: number | null | undefined, currency = 'SAR', digits = moneyDigits(currency)): string {
  if (value == null || !Number.isFinite(value)) return 'Unavailable'
  const rounded = Number(value.toFixed(digits))
  return `${currency} ${rounded < 0 ? '−' : ''}${Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}
export const suggestedRate = (value: number, currency: string) => `Approximately ${money(Math.round(value / RATE_DISPLAY_INCREMENT) * RATE_DISPLAY_INCREMENT, currency)}`
export function moneyChange(before: number | null, after: number | null, currency: string) {
  if (before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after)) return 'Change unavailable'
  const change = Number((after - before).toFixed(moneyDigits(currency)))
  return change === 0 ? 'No change' : money(change, currency).replace(`${currency} `, `${currency} ${change > 0 ? '+' : ''}`)
}
