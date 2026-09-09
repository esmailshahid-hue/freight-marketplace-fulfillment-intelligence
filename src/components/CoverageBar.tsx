import { coverage } from '../ui/format'

// A demand-relative display, capped at 100%; the exact ratio remains visible.
export function CoverageBar({ value }: { value: number | null }) {
  const available = value !== null && Number.isFinite(value)
  return <span className={`coverage-display ${available && value < 1 ? 'shortfall' : ''}`}>
    <span>{coverage(value)}</span><span className="coverage-track" aria-hidden="true"><span style={{ width: `${available ? Math.max(0, Math.min(1, value)) * 100 : 0}%` }} /></span>
  </span>
}
