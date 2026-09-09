import type { Action, PlanningBucket } from '../analytics/types'
export interface BucketFilters { lane: string; equipment: string; date: string; status: string }
export const EMPTY_FILTERS: BucketFilters = { lane: '', equipment: '', date: '', status: '' }
export function filterBuckets(buckets: PlanningBucket[], filters: BucketFilters) {
  return buckets.filter(b => (!filters.lane || b.lane === filters.lane) && (!filters.equipment || b.equipment_type === filters.equipment)
    && (!filters.date || b.pickup_date === filters.date) && (!filters.status || b.status === filters.status))
}
export function bucketForAction(action: Action, buckets: PlanningBucket[]) {
  return buckets.find(b => b.lane === action.lane && b.equipment_type === action.equipment_type && b.pickup_date === action.pickup_date)
}
export const actionsForBucket = (bucket: PlanningBucket, actions: Action[]) => actions.filter(a => a.lane === bucket.lane && a.equipment_type === bucket.equipment_type && a.pickup_date === bucket.pickup_date)
export function uniquePairs(buckets: PlanningBucket[]) {
  return [...new Map(buckets.map(b => [JSON.stringify([b.lane, b.equipment_type]), { lane: b.lane, equipment_type: b.equipment_type }])).values()]
}
