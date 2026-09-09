import Papa from 'papaparse'
import { FILE_NAMES, SCHEMAS, type DatasetName, type Datasets } from './schemas'

// Illustrative dates are fixed: users replace these example rows with their own data.
const geography = { customer: 'Example Customer', business_unit: 'Domestic', origin: 'Riyadh', destination: 'Dammam', lane: 'Riyadh → Dammam', equipment_type: 'Dry Van' }
const examples: { [K in DatasetName]: NonNullable<Datasets[K]>[number] } = {
  upcoming: { ...geography, load_id: 'EXAMPLE-UPCOMING-001', pickup_datetime: '2026-09-10T09:00:00+03:00', sell_rate: 2200, planned_buy_rate: 1800, priority: 'Standard', load_count: 1, currency: 'SAR' },
  capacity: { capacity_id: 'EXAMPLE-CAPACITY-001', carrier_id: 'EXAMPLE-CARRIER-001', carrier_name: 'Example Carrier', lane: geography.lane, equipment_type: geography.equipment_type, capacity_date: '2026-09-10', available_trucks: 2, deadhead_km_to_origin: 25, active: true, contract_status: 'Spot' },
  historical: { ...geography, load_id: 'EXAMPLE-HISTORY-001', date: '2026-09-01', carrier_id: 'EXAMPLE-CARRIER-001', sell_rate: 2200, final_buy_rate: 1800, fulfilled: true, pickup_ontime: true, delivery_ontime: true, cancelled: false, failure_reason: null, currency: 'SAR' },
  offers: { offer_id: 'EXAMPLE-OFFER-001', load_id: 'EXAMPLE-HISTORY-001', date: '2026-09-01', lane: geography.lane, equipment_type: geography.equipment_type, carrier_id: 'EXAMPLE-CARRIER-001', offered_buy_rate: 1800, accepted: true, sell_rate: 2200, currency: 'SAR' },
  payments: { carrier_id: 'EXAMPLE-CARRIER-001', open_payable: 1800, overdue_payable: 0, max_days_overdue: 0, last_payment_date: '2026-09-01', payment_status: 'Current', currency: 'SAR' },
}

export function csvTemplates() {
  return (Object.keys(SCHEMAS) as DatasetName[]).map(dataset => {
    const fields = Object.keys(SCHEMAS[dataset])
    const row = examples[dataset] as unknown as Record<string, unknown>
    return { dataset, filename: FILE_NAMES[dataset].replace('.csv', '-template.csv'), csv: Papa.unparse({ fields, data: [fields.map(field => row[field])] }) + '\r\n' }
  })
}
