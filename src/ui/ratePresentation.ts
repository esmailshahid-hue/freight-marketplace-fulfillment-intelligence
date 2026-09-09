import type { PlanningBucket } from '../analytics/types'
export function restoringCandidate(bucket: PlanningBucket) {
  return bucket.raw_capacity_coverage >= 1 && bucket.rate_search?.commercialConstraint
    ? bucket.rate_search.candidates.find(c => c.increase > 0 && c.coverage >= 1 && c.gross_take_rate_proxy < bucket.rate_search!.commercial_floor) ?? null : null
}

export function rateOpportunity(bucket: PlanningBucket) {
  return bucket.raw_capacity_coverage < 1 ? null : bucket.rate_search?.recommendation ?? restoringCandidate(bucket)
}
