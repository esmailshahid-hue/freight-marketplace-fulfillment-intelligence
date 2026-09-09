import { emptyDisplayLabels, rememberDisplayLabels } from './displayLabels'
import Papa from 'papaparse'
import { SCHEMAS, type DatasetName, type Datasets } from './schemas'
import { mapColumns, normalizeKey, normalizeLane } from './mapping'
import { timestamp, DAY, localDate, validDate, validDatetime, DEFAULT_TIME_ZONE } from '../utils/dates'
import { key } from '../utils/math'
export interface DataIssue { dataset: DatasetName; row?: number; field?: string; message: string }
export type CsvFiles = Partial<Record<DatasetName, string>>
// null explicitly leaves a field unmapped; omitted keys retain automatic mapping.
export type ColumnMappings = Partial<Record<DatasetName, Record<string, string | null>>>
export function validateCsv(files: CsvFiles, analysisTime: string, timeZone = DEFAULT_TIME_ZONE, columnMappings: ColumnMappings = {}) {
  if (!validDatetime(analysisTime)) throw new Error('Invalid analysis time')
  const analysisInstant = timestamp(analysisTime, timeZone), analysisDate = localDate(analysisInstant, timeZone)
  const errors: DataIssue[] = [], warnings: DataIssue[] = []
  const displayLabels = emptyDisplayLabels()
  const data: Datasets = { upcoming: [], capacity: [], historical: [], offers: [] }
  for (const dataset of Object.keys(SCHEMAS) as DatasetName[]) {
    const csv = files[dataset]
    if (csv === undefined) {
      (dataset === 'payments' ? warnings : errors).push({ dataset, message: `Missing ${dataset} file` }); continue
    }
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy' })
    parsed.errors.forEach(e => errors.push({ dataset, row: e.row === undefined ? undefined : e.row + 2, message: e.message }))
    const headers = parsed.meta.fields ?? []
    const automatic = mapColumns(dataset, headers)
    const mapping = { ...automatic.mapping, ...columnMappings[dataset] }
    const unresolved = new Set(automatic.unresolved.filter(field => !Object.hasOwn(columnMappings[dataset] ?? {}, field)))
    for (const [field, rule] of Object.entries(SCHEMAS[dataset])) {
      if (!rule.optional && !mapping[field]) unresolved.add(field)
    }
    const used = new Set<string>()
    for (const [field, header] of Object.entries(mapping)) {
      if (header === null) {
        if (!SCHEMAS[dataset][field]) errors.push({ dataset, field, message: 'Invalid explicit column mapping' })
        continue
      }
      if (!headers.includes(header) || used.has(header) || !SCHEMAS[dataset][field]) errors.push({ dataset, field, message: 'Invalid explicit column mapping' })
      used.add(header)
    }
    unresolved.forEach(field => errors.push({ dataset, field, message: 'Missing or ambiguous column; explicit mapping required' }))
    const ids = new Set<string>(), blocks = new Set<string>(), rows: Record<string, unknown>[] = []
    parsed.data.forEach((input, i) => {
      const row: Record<string, unknown> = {}, before = errors.length
      const issue = (field: string, message: string) => errors.push({ dataset, row: i + 2, field, message })
      for (const [field, rule] of Object.entries(SCHEMAS[dataset])) {
        const header = mapping[field]
        const value = String(header == null ? '' : input[header] ?? '').trim()
        if (!value) { row[field] = field === 'currency' ? 'SAR' : null; if (!rule.optional) issue(field, 'Required non-blank value'); continue }
        let out: string | number | boolean = value
        if (rule.type === 'number' || rule.type === 'integer') {
          out = Number(value)
          if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(out) || (rule.positive && out <= 0) || (rule.min !== undefined && out < rule.min) || (rule.type === 'integer' && !Number.isInteger(out))) issue(field, 'Invalid numeric value')
        } else if (rule.type === 'boolean') {
          if (['1', 'true', 'yes'].includes(value.toLowerCase())) out = true
          else if (['0', 'false', 'no'].includes(value.toLowerCase())) out = false
          else issue(field, 'Invalid boolean')
        } else if (rule.type === 'date' && !validDate(value)) issue(field, 'Invalid calendar date')
        else if (rule.type === 'datetime' && !validDatetime(value)) issue(field, 'Invalid ISO datetime')
        if (rule.values && !rule.values.includes(value)) issue(field, 'Invalid enum value')
        row[field] = field === 'currency' ? value.toUpperCase() : out
      }
      if (dataset === 'upcoming' || dataset === 'historical') row.lane ||= `${row.origin} → ${row.destination}`
      const sourceLane = String(row.lane ?? ''), sourceEquipment = String(row.equipment_type ?? '')
      if (row.lane) row.lane = normalizeLane(String(row.lane))
      if (row.equipment_type) row.equipment_type = normalizeKey(String(row.equipment_type))
      const idField = dataset === 'capacity' ? 'capacity_id' : dataset === 'offers' ? 'offer_id' : dataset === 'payments' ? 'carrier_id' : 'load_id'
      const id = String(row[idField])
      if (ids.has(id)) issue(idField, 'Duplicate unique ID')
      ids.add(id)
      if (dataset === 'payments' && Number(row.overdue_payable) > Number(row.open_payable)) issue('overdue_payable', 'Overdue payable exceeds open payable')
      if (dataset === 'historical' && row.carrier_id && row.final_buy_rate === null) issue('final_buy_rate', 'Assigned load requires positive final buy rate')
      if (errors.length > before) return
      rememberDisplayLabels(displayLabels, sourceLane, sourceEquipment)
      const warn = (message: string) => warnings.push({ dataset, row: i + 2, message })
      if (dataset === 'capacity') {
        const block = key(String(row.carrier_id), String(row.lane), String(row.equipment_type), String(row.capacity_date))
        if (blocks.has(block)) warn('Possible duplicated capacity blocks — confirm these rows are additive.')
        blocks.add(block)
      }
      if (dataset === 'upcoming' && Number(row.planned_buy_rate) > Number(row.sell_rate)) warn('Negative gross spread')
      if (dataset === 'historical') {
        if (row.cancelled && row.fulfilled) warn('Inconsistent cancelled/fulfilled row; fulfilled is source of truth')
        // Service metrics are not applicable to loads never assigned or fulfilled (spec §6.3).
        if ((row.carrier_id || row.fulfilled) && (row.pickup_ontime === null || row.delivery_ontime === null)) warn('Missing pickup/delivery service metrics')
      }
      rows.push(row)
    })
    Object.assign(data, { [dataset]: rows })
  }
  const currencies = new Set([...data.upcoming, ...data.historical, ...data.offers, ...(data.payments ?? [])].map(r => r.currency))
  if (currencies.size > 1) errors.push({ dataset: 'upcoming', message: 'V1 supports one currency per analysis. Convert rates to a common currency before upload.' })
  const pastDue = data.upcoming.filter(r => timestamp(r.pickup_datetime, timeZone) < analysisInstant)
  pastDue.forEach(r => warnings.push({ dataset: 'upcoming', message: `Past Due: ${r.load_id}` }))
  data.upcoming = data.upcoming.filter(r => timestamp(r.pickup_datetime, timeZone) >= analysisInstant)
  const outsideHorizon = data.upcoming.filter(r => timestamp(r.pickup_datetime, timeZone) > analysisInstant + 7 * DAY)
  const futureHistorical = data.historical.filter(r => r.date > analysisDate)
  const futureOffers = data.offers.filter(r => r.date > analysisDate)
  futureHistorical.forEach(r => warnings.push({ dataset: 'historical', message: `Future historical row excluded: ${r.load_id}` }))
  futureOffers.forEach(r => warnings.push({ dataset: 'offers', message: `Future historical row excluded: ${r.offer_id}` }))
  data.historical = data.historical.filter(r => r.date <= analysisDate)
  data.offers = data.offers.filter(r => r.date <= analysisDate)
  return { data: errors.length ? null : data, errors, warnings, pastDue, futureHistorical, futureOffers, displayLabels, outsideHorizon }
}
