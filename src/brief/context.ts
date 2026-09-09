import type { Analysis } from '../analytics/engine.ts'
import { DEFAULT_CONFIG } from '../analytics/config.ts'
import { coverage, label, money, number, percent } from '../ui/format.ts'

// This is a separate, deliberately small transport contract, never an Analysis or Dataset.
export interface BriefContext {
  as_of: string; currency: string;
  kpis: { upcoming_loads: string; projected_fulfillment: string; effective_coverage: string; unfulfilled_load_equivalents: string; modeled_revenue_exposure: string; gross_take_rate_proxy: string; high_critical_buckets: string; action_count: string };
  top_actions: { action: string; severity: string; lane: string; equipment: string; pickup_date: string; root_cause: string; loads_exposed: string; modeled_revenue_exposure: string; priority: string; recommendation: string; evidence: string[] }[];
  at_risk_buckets: { lane: string; equipment: string; pickup_date: string; root_cause: string; risk: string; effective_coverage: string; unfulfilled_load_equivalents: string }[];
  demand_spikes: { lane: string; equipment: string; growth: string; weekly_demand: string }[];
  concentration_warnings: { lane: string; equipment: string; pickup_date: string; largest_carrier_share: string; capacity_status: string }[];
  supply_priorities: { lane: string; equipment: string; upcoming_exposure: string; historical_unfulfilled: string; gap_days: string; priority_score: string }[];
}
export function buildBriefContext(analysis: Analysis, asOf: string, currency: string): BriefContext {
  const k = analysis.kpis
  return {
    as_of: asOf, currency,
    kpis: { upcoming_loads: number(k.upcoming_loads), projected_fulfillment: percent(k.projected_fulfillment_pct), effective_coverage: coverage(k.effective_capacity_coverage),
      unfulfilled_load_equivalents: number(k.expected_unfulfilled), modeled_revenue_exposure: money(k.modeled_revenue_exposure, currency), gross_take_rate_proxy: percent(k.gross_take_rate_proxy), high_critical_buckets: number(k.high_critical_buckets, 0), action_count: number(k.action_count, 0) },
    top_actions: analysis.actions.slice(0, 5).map(a => ({ action: label(a.action_type), severity: a.severity, lane: a.lane, equipment: a.equipment_type, pickup_date: a.pickup_date,
      root_cause: label(a.root_cause), loads_exposed: number(a.loads_exposed), modeled_revenue_exposure: money(a.modeled_revenue_exposure, currency), priority: number(a.action_priority_score), recommendation: a.recommended_action, evidence: a.evidence.slice(0, 6) })),
    at_risk_buckets: analysis.buckets.filter(b => b.expected_unfulfilled > 0).sort((a, b) => b.risk.score - a.risk.score).slice(0, 5).map(b => ({ lane: b.lane, equipment: b.equipment_type, pickup_date: b.pickup_date, root_cause: label(b.root_cause.primary), risk: b.risk.band, effective_coverage: coverage(b.effective_capacity_coverage), unfulfilled_load_equivalents: number(b.expected_unfulfilled) })),
    demand_spikes: [...new Map(analysis.buckets.filter(b => b.baseline.demand_growth_pct !== null && b.baseline.demand_growth_pct >= DEFAULT_CONFIG.DEMAND_SPIKE_THRESHOLD).map(b => [JSON.stringify([b.lane, b.equipment_type]), b])).values()]
      .sort((a, b) => b.baseline.demand_growth_pct! - a.baseline.demand_growth_pct!).slice(0, 5).map(b => ({ lane: b.lane, equipment: b.equipment_type, growth: percent(b.baseline.demand_growth_pct), weekly_demand: number(b.baseline.upcoming_7d_loads) })),
    concentration_warnings: analysis.buckets.filter(b => ['Watch', 'High'].includes(b.concentration_status)).sort((a, b) => b.capacity.top_carrier_share - a.capacity.top_carrier_share).slice(0, 5).map(b => ({ lane: b.lane, equipment: b.equipment_type, pickup_date: b.pickup_date, largest_carrier_share: percent(b.capacity.top_carrier_share), capacity_status: b.status })),
    supply_priorities: analysis.supply_gaps.slice(0, 5).map(g => ({ lane: g.lane, equipment: g.equipment_type, upcoming_exposure: number(g.upcoming_expected_unfulfilled_7d), historical_unfulfilled: number(g.historical_unfulfilled_30d, 0), gap_days: number(g.gap_days_30d, 0), priority_score: number(g.structural_supply_gap_score, 0) })),
  }
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const exact = (v: unknown, fields: string[]): v is Record<string, unknown> => record(v) && Object.keys(v).length === fields.length && fields.every(f => Object.hasOwn(v, f))
const text = (v: unknown, limit = 1000): v is string => typeof v === 'string' && v.length > 0 && v.length <= limit && !/[\r\n]/.test(v) && !v.includes('\0')
const stringRecord = (v: unknown, fields: string[]) => exact(v, fields) && fields.every(f => text(v[f], ['lane', 'equipment'].includes(f) ? 240 : 1000))
const list = (v: unknown, fields: string[]) => Array.isArray(v) && v.length <= 5 && v.every(row => stringRecord(row, fields))
export function isBriefContext(v: unknown): v is BriefContext {
  if (!exact(v, ['as_of', 'currency', 'kpis', 'top_actions', 'at_risk_buckets', 'demand_spikes', 'concentration_warnings', 'supply_priorities'])) return false
  if (!text(v.as_of, 40) || !Number.isFinite(Date.parse(v.as_of)) || !text(v.currency, 12)) return false
  if (!stringRecord(v.kpis, ['upcoming_loads', 'projected_fulfillment', 'effective_coverage', 'unfulfilled_load_equivalents', 'modeled_revenue_exposure', 'gross_take_rate_proxy', 'high_critical_buckets', 'action_count'])) return false
  const actionFields = ['action', 'severity', 'lane', 'equipment', 'pickup_date', 'root_cause', 'loads_exposed', 'modeled_revenue_exposure', 'priority', 'recommendation']
  if (!Array.isArray(v.top_actions) || v.top_actions.length > 5 || !v.top_actions.every(a => {
    if (!exact(a, [...actionFields, 'evidence'])) return false
    return actionFields.every(f => text(a[f], ['lane', 'equipment'].includes(f) ? 240 : 1000)) && Array.isArray(a.evidence) && a.evidence.length <= 6 && a.evidence.every(e => text(e, 500))
  })) return false
  return list(v.at_risk_buckets, ['lane', 'equipment', 'pickup_date', 'root_cause', 'risk', 'effective_coverage', 'unfulfilled_load_equivalents'])
    && list(v.demand_spikes, ['lane', 'equipment', 'growth', 'weekly_demand'])
    && list(v.concentration_warnings, ['lane', 'equipment', 'pickup_date', 'largest_carrier_share', 'capacity_status'])
    && list(v.supply_priorities, ['lane', 'equipment', 'upcoming_exposure', 'historical_unfulfilled', 'gap_days', 'priority_score'])
}
export const BRIEF_SECTIONS = ['What requires attention', 'Why', 'Commercial impact', 'Recommended actions'] as const
export type OperationsBrief = Record<(typeof BRIEF_SECTIONS)[number], string>
const numbers = (s: string) => s.match(/[+-]?\d+(?:,\d{3})*(?:\.\d+)?%?/g) ?? []
export function isOperationsBrief(v: unknown, context: BriefContext): v is OperationsBrief {
  if (!exact(v, [...BRIEF_SECTIONS]) || !BRIEF_SECTIONS.every(section => text(v[section], 2000))) return false
  const paragraphs = BRIEF_SECTIONS.map(section => v[section] as string)
  if ([...BRIEF_SECTIONS.map((section, i) => `${i + 1}. ${section}`), ...paragraphs].join(' ').trim().split(/\s+/).length >= 250) return false
  // Numbers must be copied verbatim, not calculated, rounded or estimated by the model.
  const allowed = new Set(numbers(JSON.stringify(context)))
  return paragraphs.every(p => numbers(p).every(n => allowed.has(n)))
}
