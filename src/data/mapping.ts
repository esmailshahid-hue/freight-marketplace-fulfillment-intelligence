import { SCHEMAS, type DatasetName } from './schemas.js'
export const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
export const normalizeLane = (value: string) => normalizeKey(value.replace(/\s*(?:→|->)\s*/g, ' → '))
export function mapColumns(dataset: DatasetName, headers: string[]) {
  const synonyms: Record<string, string[]> = { equipment_type: ['truck_type', 'vehicle_type'], customer: ['shipper', 'client'], load_count: ['qty', 'loads'], carrier_id: ['vendor_id'] }
  if (dataset === 'upcoming') synonyms.planned_buy_rate = ['buy_price', 'carrier_rate']
  if (dataset === 'offers') synonyms.offered_buy_rate = ['buy_price', 'carrier_rate']
  const mapping: Record<string, string> = {}, unresolved: string[] = []
  for (const [field, rule] of Object.entries(SCHEMAS[dataset])) {
    const candidates = headers.filter(h => [field, ...(synonyms[field] ?? [])].some(s => normalizeKey(h) === normalizeKey(s)))
    if (candidates.length === 1) mapping[field] = candidates[0]
    else if (candidates.length > 1 || !rule.optional) unresolved.push(field)
  }
  return { mapping, unresolved }
}
