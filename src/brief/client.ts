import type { DisplayLabels } from '../data/displayLabels'
import type { Analysis } from '../analytics/engine'
import { buildBriefContext, isBriefContext, isOperationsBrief } from './context'
export async function requestOperationsBrief(analysis: Analysis, asOf: string, currency: string, signal?: AbortSignal, fetcher: typeof fetch = fetch, labels?: DisplayLabels) {
  const context = buildBriefContext(analysis, asOf, currency, labels)
  if (!isBriefContext(context)) throw new Error('This summary could not be prepared for narration. Your analysis is unaffected.')
  const response = await fetcher('/api/operations-brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context), signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Operations Brief is unavailable. Your analysis is unaffected. Please try again.')
  const result = await response.json()
  if (!isOperationsBrief(result?.brief, context)) throw new Error('The brief could not be verified. Your analysis is unaffected.')
  return result.brief
}
