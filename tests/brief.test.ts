import { describe, expect, it, vi } from 'vitest'
import { analyze } from '../src/analytics/engine'
import { buildBriefContext, BRIEF_SECTIONS, isBriefContext, isOperationsBrief, type BriefContext } from '../src/brief/context'
import { requestOperationsBrief } from '../src/brief/client'
import { handleOperationsBrief } from '../server/operationsBrief'
import endpoint from '../api/operations-brief'
import { fixture, AS_OF } from './helpers'
const env = { ANALYSIS_LLM_API_KEY: 'test-only-placeholder', ANALYSIS_LLM_MODEL: 'test-model', ANALYSIS_LLM_BASE_URL: 'https://provider.example/v1' }
const analysis = () => analyze(fixture(), AS_OF)
const context = () => buildBriefContext(analysis(), AS_OF, 'SAR')
const brief = (c: BriefContext = context()) => ({
  'What requires attention': `${c.kpis.unfulfilled_load_equivalents} load-equivalents are exposed.`,
  Why: `Effective coverage is ${c.kpis.effective_coverage}.`,
  'Commercial impact': `Modeled revenue exposure is ${c.kpis.modeled_revenue_exposure}. Gross take-rate proxy is ${c.kpis.gross_take_rate_proxy}.`,
  'Recommended actions': c.top_actions[0]?.recommendation ?? 'No actions were generated.',
})
const request = (body: unknown = context()) => new Request('https://app.example/api/operations-brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const provider = (value: unknown = brief()) => vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] }))

describe('computed summary privacy boundary', () => {
  it('projects computed outputs only, with bounded arrays and no raw rows or unexpected runtime fields', () => {
    const data = fixture(); data.upcoming[0].customer = 'RAW_CUSTOMER_SENTINEL'
    const a = analyze(data, AS_OF)
    Object.assign(a, { csv: 'RAW_CSV_SENTINEL', data })
    Object.assign(a.actions[0], { secret: 'RAW_ACTION_SENTINEL' })
    Object.assign(a.buckets[0].benchmark!, { raw: 'RAW_BENCHMARK_SENTINEL' })
    a.actions = Array.from({ length: 30 }, () => a.actions[0]); a.buckets = Array.from({ length: 30 }, () => a.buckets[0]); a.supply_gaps = Array.from({ length: 30 }, () => a.supply_gaps[0])
    const c = buildBriefContext(a, AS_OF, 'SAR'), serialized = JSON.stringify(c)
    expect(isBriefContext(c)).toBe(true)
    expect(serialized).not.toContain('RAW_')
    for (const name of ['contributions', 'rows', 'offered_buy_rate', 'customer', 'csv', 'historical', 'payments']) expect(Object.keys(c)).not.toContain(name)
    expect(c.top_actions).toHaveLength(5); expect(c.at_risk_buckets).toHaveLength(5); expect(c.supply_priorities).toHaveLength(5)
    expect(c.top_actions[0].recommendation).toBe(a.actions[0].recommended_action)
    expect(c.kpis.projected_fulfillment).toBe('98.0%')
  })
  it.each(['csv', 'data', 'upcoming', 'capacity', 'historical', 'offers', 'payments'])('rejects raw/extra %s fields before provider invocation', async key => {
    const fetcher = provider()
    const response = await handleOperationsBrief(request({ ...context(), [key]: fixture() }), env, fetcher)
    expect(response.status).toBe(400); expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects full Analysis objects, raw CSV, nested unknown keys and oversized arrays', async () => {
    for (const input of [analysis(), 'load_id,customer\nu,private', { ...context(), kpis: { ...context().kpis, raw: 'private' } }, { ...context(), top_actions: Array(6).fill(context().top_actions[0]) }, { ...context(), top_actions: [{ ...context().top_actions[0], rows: fixture().upcoming }] }]) {
      const fetcher = provider()
      expect((await handleOperationsBrief(request(input), env, fetcher)).status).toBe(400)
      expect(fetcher).not.toHaveBeenCalled()
    }
  })
  it('client constructs and posts the allowlisted summary, never serializes the whole analysis', async () => {
    const a = analysis(); Object.assign(a, { rawCSV: 'PRIVATE_CSV' })
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ brief: brief() }))
    await requestOperationsBrief(a, AS_OF, 'SAR', undefined, fetcher)
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('/api/operations-brief'); expect(options?.method).toBe('POST')
    expect(JSON.parse(String(options?.body))).toEqual(context())
    expect(String(options?.body)).not.toContain('PRIVATE_CSV')
    expect(options?.headers).not.toHaveProperty('Authorization')
  })
})
describe('optional provider and output handling', () => {
  it('exports a Vercel Web handler and works without any configuration', async () => {
    expect(typeof endpoint.fetch).toBe('function')
    const fetcher = provider()
    expect(await (await handleOperationsBrief(new Request('https://app.example/api/operations-brief'), {}, fetcher)).json()).toEqual({ available: false })
    expect((await handleOperationsBrief(request(), {}, fetcher)).status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('availability never sends analysis to a provider; partial or unsafe configuration stays unavailable', async () => {
    const fetcher = provider()
    for (const configuration of [{}, { ANALYSIS_LLM_API_KEY: env.ANALYSIS_LLM_API_KEY }, { ...env, ANALYSIS_LLM_BASE_URL: 'http://provider.example' }]) {
      expect(await (await handleOperationsBrief(new Request('https://app.example/api/operations-brief'), configuration, fetcher)).json()).toEqual({ available: false })
    }
    expect(await (await handleOperationsBrief(new Request('https://app.example/api/operations-brief'), env, fetcher)).json()).toEqual({ available: true })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('uses one configured provider adapter, server credentials and exact four-section narration', async () => {
    const fetcher = provider(), response = await handleOperationsBrief(request(), env, fetcher)
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ brief: brief() })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe('https://provider.example/v1/chat/completions')
    expect(options?.headers).toHaveProperty('Authorization', `Bearer ${env.ANALYSIS_LLM_API_KEY}`)
    expect(options?.redirect).toBe('error')
    const sent = JSON.parse(String(options?.body))
    expect(sent.model).toBe(env.ANALYSIS_LLM_MODEL)
    expect(JSON.parse(sent.messages[1].content)).toEqual(context())
    expect(sent.messages[0].content).toContain('Do not calculate')
    expect(Object.keys(brief())).toEqual([...BRIEF_SECTIONS])
    expect(isOperationsBrief(brief(), context())).toBe(true)
  })
  it('rejects missing/extra sections, invented numbers and 250-word output', async () => {
    const valid = brief()
    for (const output of [{ ...valid, Why: 'Coverage is 987654.3%.' }, { ...valid, 'Watch next': 'Extra heading' }, { Why: 'Missing sections' }, { ...valid, Why: Array(250).fill('word').join(' ') }, { ...valid, Why: 'line\nbreak' }]) {
      expect(isOperationsBrief(output, context())).toBe(false)
      expect((await handleOperationsBrief(request(), env, provider(output))).status).toBe(502)
    }
  })
  it('provider errors, timeout and malformed responses do not expose details or alter analytics', async () => {
    const a = analysis(), before = structuredClone(a)
    for (const fetcher of [vi.fn<typeof fetch>().mockRejectedValue(new Error(`private ${env.ANALYSIS_LLM_API_KEY}`)), vi.fn<typeof fetch>().mockRejectedValue(new DOMException('Timeout', 'TimeoutError')), vi.fn<typeof fetch>().mockResolvedValue(new Response('private error', { status: 429 })), vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [] })), vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: 'not json' } }] }))]) {
      const response = await handleOperationsBrief(request(buildBriefContext(a, AS_OF, 'SAR')), env, fetcher)
      expect(response.status).toBe(502)
      const text = await response.text(); expect(text).toContain('analysis is unaffected'); expect(text).not.toContain(env.ANALYSIS_LLM_API_KEY); expect(text).not.toContain('private')
    }
    expect(a).toEqual(before)
  })
  it('client handles endpoint failure or unverifiable narration without mutating results', async () => {
    const a = analysis(), before = structuredClone(a)
    for (const response of [new Response('', { status: 503 }), Response.json({ brief: { ...brief(), Why: 'Invented 98765.7%.' } })]) {
      await expect(requestOperationsBrief(a, AS_OF, 'SAR', undefined, vi.fn<typeof fetch>().mockResolvedValue(response))).rejects.toThrow('analysis is unaffected')
    }
    expect(a).toEqual(before)
  })
  it('blocks wrong methods, malformed JSON, unsupported content types and oversized bodies', async () => {
    const fetcher = provider()
    const method = await handleOperationsBrief(new Request('https://app.example/api/operations-brief', { method: 'DELETE' }), env, fetcher)
    expect(method.status).toBe(405); expect(method.headers.get('Allow')).toBe('GET, POST')
    for (const [body, contentType, status] of [['{', 'application/json', 400], ['private', 'text/csv', 415], ['x'.repeat(65537), 'application/json', 413]] as const) {
      const response = await handleOperationsBrief(new Request('https://app.example/api/operations-brief', { method: 'POST', headers: { 'Content-Type': contentType }, body }), env, fetcher)
      expect(response.status).toBe(status)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
})
