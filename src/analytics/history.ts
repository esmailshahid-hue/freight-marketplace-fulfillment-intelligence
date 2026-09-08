import type { HistoricalLoad, UpcomingLoad } from '../data/schemas'
import { timestamp, DAY, dateNumber, localDate, DEFAULT_TIME_ZONE } from '../utils/dates'
import { sum } from '../utils/math'
export function demandBaseline(history: HistoricalLoad[], upcoming: UpcomingLoad[], lane: string, equipment: string, asOf: string, timeZone = DEFAULT_TIME_ZONE) {
  const endDate = localDate(asOf, timeZone)
  const rows = history.filter(r => r.lane === lane && r.equipment_type === equipment && r.date <= endDate)
  const today = dateNumber(localDate(asOf, timeZone)), weekday = new Date(today).getUTCDay()
  const end = today - ((weekday + 6) % 7) * DAY
  const earliest = rows.length ? Math.min(...rows.map(r => dateNumber(r.date))) : end
  // The first partially observed week is not a complete week.
  const startDay = new Date(earliest).getUTCDay(), firstMonday = earliest + ((8 - startDay) % 7) * DAY
  const weeks = Math.max(0, Math.min(8, Math.floor((end - firstMonday) / (7 * DAY))))
  const count = rows.filter(r => dateNumber(r.date) >= end - weeks * 7 * DAY && dateNumber(r.date) < end).length
  const average = weeks >= 2 && count > 0 ? count / weeks : null
  const weekly = sum(upcoming.filter(r => r.lane === lane && r.equipment_type === equipment && timestamp(r.pickup_datetime, timeZone) >= timestamp(asOf, timeZone) && timestamp(r.pickup_datetime, timeZone) <= timestamp(asOf, timeZone) + 7 * DAY), r => r.load_count)
  return { historical_avg_weekly_loads: average, complete_weeks: weeks, upcoming_7d_loads: weekly, demand_growth_pct: average === null ? null : weekly / average - 1 }
}
