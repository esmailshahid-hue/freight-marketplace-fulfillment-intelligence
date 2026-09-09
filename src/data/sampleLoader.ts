import Papa from 'papaparse'
import { FILE_NAMES, type Datasets, type DatasetName, type SampleMetadata } from './schemas'
import { timestamp, DAY, addDays, dateNumber, localDate, DEFAULT_TIME_ZONE } from '../utils/dates'
import { validateCsv, type CsvFiles } from './validation'
export function serializeDatasets(data: Datasets): CsvFiles {
  return Object.fromEntries((Object.keys(FILE_NAMES) as DatasetName[]).filter(k => data[k] !== undefined).map(k => [k, Papa.unparse<object>(data[k]!, { newline: '\n' })]))
}
export function shiftSampleDates(data: Datasets, metadata: SampleMetadata, asOf: string, timeZone = DEFAULT_TIME_ZONE): Datasets {
  const delta = timestamp(asOf, timeZone) - timestamp(metadata.sample_as_of, timeZone)
  // Date-only fields have no instant. Anchor them to the source analysis clock,
  // and use the corresponding shifted pickup date for capacity buckets.
  const dayDelta = (dateNumber(localDate(asOf, timeZone)) - dateNumber(localDate(metadata.sample_as_of, timeZone))) / DAY
  const dateMap = new Map(data.upcoming.map(r => [localDate(r.pickup_datetime, timeZone), localDate(timestamp(r.pickup_datetime, timeZone) + delta, timeZone)]))
  return { upcoming: data.upcoming.map(r => ({ ...r, pickup_datetime: new Date(timestamp(r.pickup_datetime, timeZone) + delta).toISOString() })),
    capacity: data.capacity.map(r => ({ ...r, capacity_date: dateMap.get(r.capacity_date) ?? addDays(r.capacity_date, dayDelta) })),
    historical: data.historical.map(r => ({ ...r, date: addDays(r.date, dayDelta) })), offers: data.offers.map(r => ({ ...r, date: addDays(r.date, dayDelta) })),
    ...(data.payments ? { payments: data.payments.map(r => ({ ...r, last_payment_date: r.last_payment_date ? addDays(r.last_payment_date, dayDelta) : null })) } : {}) }
}
// Text-in/text-out boundary allows browser loading without coupling analytics to I/O.
export function loadSample(files: CsvFiles, metadata: SampleMetadata, analysisTime: string, timeZone = DEFAULT_TIME_ZONE) {
  const original = validateCsv(files, metadata.sample_as_of, timeZone)
  if (!original.data) return original
  return { ...validateCsv(serializeDatasets(shiftSampleDates(original.data, metadata, analysisTime, timeZone)), analysisTime, timeZone), displayLabels: original.displayLabels }
}
export async function fetchSample(analysisTime: string, fetcher: typeof fetch = fetch) {
  const metadataResponse = await fetcher('/sample-data/sample-metadata.json')
  if (!metadataResponse.ok) throw new Error('Unable to load sample metadata')
  const metadata: SampleMetadata = await metadataResponse.json()
  const files: CsvFiles = {}
  await Promise.all((Object.keys(FILE_NAMES) as DatasetName[]).map(async k => {
    const response = await fetcher(`/sample-data/${FILE_NAMES[k]}`)
    if (!response.ok) throw new Error(`Unable to load ${FILE_NAMES[k]}`)
    files[k] = await response.text()
  }))
  return loadSample(files, metadata, analysisTime)
}
