import type { economics, fulfillment } from './fulfillment'
import type { Capacity } from './capacity'
import type { Benchmark, RateSearch } from './pricing'
import type { calculateRisk } from './risk'
import type { classifyRootCause, RootCause } from './rootCause'
import type { demandBaseline } from './history'
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical'
export type ActionType = 'RAISE_BUY_RATE' | 'SECURE_CAPACITY' | 'ACTIVATE_BACKUP_CARRIERS' | 'ESCALATE_COMMERCIAL_CONSTRAINT' | 'PREBOOK_CAPACITY' | 'REVIEW_SERVICE_QUALITY' | 'REVIEW_PAYMENT_EXPOSURE'
export interface PlanningBucket extends ReturnType<typeof economics>, ReturnType<typeof fulfillment> {
  id: string; lane: string; equipment_type: string; pickup_date: string; currency: string; hours_to_pickup: number;
  capacity: Capacity; benchmark: Benchmark; rate_index: number | null; rate_search: RateSearch | null;
  risk: ReturnType<typeof calculateRisk>; root_cause: ReturnType<typeof classifyRootCause>;
  baseline: ReturnType<typeof demandBaseline>; status: 'Healthy' | 'Watch' | 'At Risk' | 'Critical';
  concentration_status: 'Normal' | 'Watch' | 'High' | 'No effective capacity'; concentration_warning: 'Watch' | null;
  modeled_revenue_exposure: number; warnings: string[];
}
export interface Action {
  action_id: string; action_type: ActionType; severity: Severity; lane: string; equipment_type: string;
  pickup_date: string; loads_exposed: number; risk_score: number; root_cause: RootCause | null;
  modeled_revenue_exposure: number; evidence: string[]; recommended_action: string; action_priority_score: number;
  pickup_urgency: number; carrier_id?: string;
}
