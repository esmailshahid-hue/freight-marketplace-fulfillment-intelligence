import { useEffect, useRef, useState } from 'react'
import type { Analysis } from '../analytics/engine'
import { BRIEF_SECTIONS, type OperationsBrief as Brief } from '../brief/context'
import { requestOperationsBrief } from '../brief/client'
export function OperationsBrief({ analysis, asOf, currency }: { analysis: Analysis; asOf: string; currency: string }) {
  const [available, setAvailable] = useState(false)
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'error' | 'ready'; brief?: Brief; message?: string }>({ status: 'idle' })
  const pending = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/operations-brief', { signal: controller.signal, cache: 'no-store' })
      .then(async r => r.ok ? r.json() : null).then(result => { if (!controller.signal.aborted) setAvailable(result?.available === true) }).catch(() => {})
    return () => { controller.abort(); pending.current?.abort() }
  }, [])
  async function generate() {
    if (pending.current) return
    const controller = new AbortController(); pending.current = controller
    setState({ status: 'loading' })
    try {
      const brief = await requestOperationsBrief(analysis, asOf, currency, AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]))
      if (!controller.signal.aborted) setState({ status: 'ready', brief })
    } catch {
      if (!controller.signal.aborted) setState({ status: 'error', message: 'Operations Brief is unavailable. Your analysis is unaffected. Please try again.' })
    } finally { if (pending.current === controller) pending.current = null }
  }
  if (!available) return <details className="brief-unavailable"><summary>Operations Brief · Unavailable</summary><p>Raw CSV files and rows stay in your browser. The optional brief is currently unavailable.</p></details>
  return <section className="brief" aria-label="Operations Brief">
    <div className="brief-control"><div><strong>Operations Brief <span className="muted">· AI summary</span></strong>
      <p className="muted">Only a compact computed summary is sent to the AI provider when you click Generate Operations Brief. Raw CSV files and rows stay in your browser.</p></div>
      {available ? <button onClick={() => void generate()} disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Generating brief…' : 'Generate Operations Brief'}</button> : <span className="muted">Brief unavailable</span>}
    </div>
    <div role="status">{state.status === 'loading' && <p>Writing brief…</p>}{state.status === 'error' && <p className="negative">{state.message}</p>}</div>
    {state.brief && <div className="brief-output"><p className="muted">AI narration · review alongside the action queue.</p>{BRIEF_SECTIONS.map((heading, i) => <section key={heading}><h3>{i + 1}. {heading}</h3><p>{state.brief![heading]}</p></section>)}</div>}
  </section>
}
