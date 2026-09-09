import Papa from 'papaparse'
import { analyze, type Analysis } from '../analytics/engine'
import { mapColumns } from '../data/mapping'
import { SCHEMAS, type DatasetName, type Datasets } from '../data/schemas'
import { validateCsv, type ColumnMappings, type CsvFiles } from '../data/validation'

export type ValidationResult = ReturnType<typeof validateCsv>
export interface Snapshot { data: Datasets; analysis: Analysis; asOf: string; validation: ValidationResult }
export const DATASETS = Object.keys(SCHEMAS) as DatasetName[]
export const DATASET_LABELS: Record<DatasetName, string> = {
  upcoming: 'Upcoming loads', capacity: 'Carrier capacity', historical: 'Historical loads',
  offers: 'Historical offers', payments: 'Carrier payments',
}
export interface UploadedFile {
  name: string; size: number; csv: string; headers: string[]; rowCount: number;
  automatic: Record<string, string>; mapping: Record<string, string | null>;
}
export type UploadSlot = { token: string; name: string; size: number } & (
  { status: 'reading' } | { status: 'error'; message: string } | { status: 'ready'; file: UploadedFile }
)
export interface UploadState {
  mode: 'sample' | 'upload'; slots: Partial<Record<DatasetName, UploadSlot>>;
  validation: { asOf: string; result: ValidationResult } | null; snapshot: Snapshot | null;
}
export const initialUploadState = (): UploadState => ({ mode: 'sample', slots: {}, validation: null, snapshot: null })
export function inspectUpload(dataset: DatasetName, name: string, size: number, csv: string): UploadedFile {
  if (!/\.csv$/i.test(name)) throw new Error('Select a CSV file (.csv). Excel and other file types are not supported.')
  // Parsing here only discovers columns and counts records. validateCsv owns all validation.
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy' })
  const headers = parsed.meta.fields ?? []
  const automatic = mapColumns(dataset, headers).mapping
  return { name, size, csv, headers, rowCount: parsed.data.length, automatic,
    mapping: Object.fromEntries(Object.keys(SCHEMAS[dataset]).map(field => [field, automatic[field] ?? null])) }
}
export function missingMappings(dataset: DatasetName, file: UploadedFile) {
  return Object.entries(SCHEMAS[dataset]).filter(([field, rule]) => !rule.optional && !file.mapping[field]).map(([field]) => field)
}
export function readyToValidate(state: UploadState) {
  return state.mode === 'upload' && DATASETS.every(dataset => {
    const slot = state.slots[dataset]
    return !slot ? dataset === 'payments' : slot.status === 'ready' && missingMappings(dataset, slot.file).length === 0
  })
}
export type UploadEvent =
  | { type: 'upload' } | { type: 'reset' } | { type: 'manage' } | { type: 'analyze' }
  | { type: 'start'; dataset: DatasetName; token: string; name: string; size: number }
  | { type: 'loaded'; dataset: DatasetName; token: string; file: UploadedFile }
  | { type: 'failed'; dataset: DatasetName; token: string; message: string }
  | { type: 'remove'; dataset: DatasetName }
  | { type: 'map'; dataset: DatasetName; field: string; header: string | null }
  | { type: 'validate'; asOf: string }
export function uploadReducer(state: UploadState, event: UploadEvent): UploadState {
  if (event.type === 'reset') return initialUploadState()
  if (event.type === 'upload') return { ...initialUploadState(), mode: 'upload' }
  if (state.mode !== 'upload') return state // Ignore late file reads after resetting to sample.
  if (event.type === 'manage') return { ...state, snapshot: null }
  if (event.type === 'analyze') {
    if (!readyToValidate(state) || !state.validation?.result.data) return state
    const { asOf, result } = state.validation
    return { ...state, snapshot: { data: result.data!, analysis: analyze(result.data!, asOf), asOf, validation: result } }
  }
  if (event.type === 'validate') {
    if (!readyToValidate(state)) return state
    const files: CsvFiles = {}, mappings: ColumnMappings = {}
    for (const dataset of DATASETS) {
      const slot = state.slots[dataset]
      if (slot?.status === 'ready') { files[dataset] = slot.file.csv; mappings[dataset] = slot.file.mapping }
    }
    return { ...state, snapshot: null, validation: { asOf: event.asOf, result: validateCsv(files, event.asOf, undefined, mappings) } }
  }
  const slots = { ...state.slots }
  if (event.type === 'start') slots[event.dataset] = { status: 'reading', token: event.token, name: event.name, size: event.size }
  else if (event.type === 'remove') delete slots[event.dataset]
  else {
    const slot = slots[event.dataset]
    if (!slot) return state
    if (event.type === 'map') {
      if (slot.status !== 'ready' || !SCHEMAS[event.dataset][event.field]) return state
      if (event.header !== null && (!slot.file.headers.includes(event.header) || Object.entries(slot.file.mapping).some(([field, header]) => field !== event.field && header === event.header))) return state
      slots[event.dataset] = { ...slot, file: { ...slot.file, mapping: { ...slot.file.mapping, [event.field]: event.header } } }
    } else {
      if (slot.token !== event.token) return state // A replacement/removal wins over an earlier read.
      slots[event.dataset] = event.type === 'loaded' ? { ...slot, status: 'ready', file: event.file } : { ...slot, status: 'error', message: event.message }
    }
  }
  return { ...state, slots, validation: null, snapshot: null }
}
