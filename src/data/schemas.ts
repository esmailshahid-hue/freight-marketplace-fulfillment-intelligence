export interface UpcomingLoad {
  load_id: string; customer: string; business_unit: string; origin: string; destination: string;
  lane: string; pickup_datetime: string; equipment_type: string; sell_rate: number;
  planned_buy_rate: number; priority: 'Standard' | 'High' | 'Critical'; load_count: number; currency: string;
}
export interface CarrierCapacity {
  capacity_id: string; carrier_id: string; carrier_name: string; lane: string; equipment_type: string;
  capacity_date: string; available_trucks: number; deadhead_km_to_origin: number; active: boolean;
  contract_status: 'Preferred' | 'Contract' | 'Spot';
}
export interface HistoricalLoad {
  load_id: string; date: string; customer: string; business_unit: string; origin: string; destination: string;
  lane: string; equipment_type: string; carrier_id: string | null; sell_rate: number; final_buy_rate: number | null;
  fulfilled: boolean; pickup_ontime: boolean | null; delivery_ontime: boolean | null;
  cancelled: boolean; failure_reason: string | null; currency: string;
}
export interface HistoricalOffer {
  offer_id: string; load_id: string | null; date: string; lane: string; equipment_type: string;
  carrier_id: string; offered_buy_rate: number; accepted: boolean; sell_rate: number | null; currency: string;
}
export interface CarrierPayment {
  carrier_id: string; open_payable: number; overdue_payable: number; max_days_overdue: number;
  last_payment_date: string | null; payment_status: 'Current' | 'Watch' | 'Overdue'; currency: string;
}
export interface Datasets {
  upcoming: UpcomingLoad[]; capacity: CarrierCapacity[]; historical: HistoricalLoad[];
  offers: HistoricalOffer[]; payments?: CarrierPayment[];
}
export type DatasetName = keyof Datasets
export interface SampleMetadata { sample_as_of: string; currency: string; seed: number }
type Field = { type: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime'; optional?: boolean; min?: number; positive?: boolean; values?: string[] }
const str: Field = { type: 'string' }, optional: Field = { type: 'string', optional: true }
const money: Field = { type: 'number', positive: true }, bool: Field = { type: 'boolean' }, date: Field = { type: 'date' }
const geography = { customer: str, business_unit: str, origin: str, destination: str, lane: optional, equipment_type: str }
export const SCHEMAS: Record<DatasetName, Record<string, Field>> = {
  upcoming: { load_id: str, ...geography, pickup_datetime: { type: 'datetime' }, sell_rate: money, planned_buy_rate: money, priority: { ...str, values: ['Standard', 'High', 'Critical'] }, load_count: { type: 'integer', min: 1 }, currency: optional },
  capacity: { capacity_id: str, carrier_id: str, carrier_name: str, lane: str, equipment_type: str, capacity_date: date, available_trucks: { type: 'integer', min: 0 }, deadhead_km_to_origin: { type: 'number', min: 0 }, active: bool, contract_status: { ...str, values: ['Preferred', 'Contract', 'Spot'] } },
  historical: { load_id: str, date, ...geography, carrier_id: optional, sell_rate: money, final_buy_rate: { ...money, optional: true }, fulfilled: bool, pickup_ontime: { ...bool, optional: true }, delivery_ontime: { ...bool, optional: true }, cancelled: bool, failure_reason: optional, currency: optional },
  offers: { offer_id: str, load_id: optional, date, lane: str, equipment_type: str, carrier_id: str, offered_buy_rate: money, accepted: bool, sell_rate: { ...money, optional: true }, currency: optional },
  payments: { carrier_id: str, open_payable: { type: 'number', min: 0 }, overdue_payable: { type: 'number', min: 0 }, max_days_overdue: { type: 'integer', min: 0 }, last_payment_date: { ...date, optional: true }, payment_status: { ...str, values: ['Current', 'Watch', 'Overdue'] }, currency: optional },
}
export const FILE_NAMES: Record<DatasetName, string> = { upcoming: 'upcoming-loads.csv', capacity: 'carrier-capacity.csv', historical: 'historical-loads.csv', offers: 'historical-offers.csv', payments: 'carrier-payments.csv' }
