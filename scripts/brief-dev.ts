import { Readable } from 'node:stream'
import type { Plugin } from 'vite'
import { handleOperationsBrief, type BriefEnvironment } from '../server/operationsBrief.ts'
// Local adapter for the same Web Request/Response handler deployed on Vercel.
export function briefDev(env: BriefEnvironment): Plugin {
  return { name: 'local-operations-brief', configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url?.split('?')[0] !== '/api/operations-brief') return next()
      try {
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        const request = new Request('http://localhost/api/operations-brief', {
          method: req.method, headers, ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: Readable.toWeb(req) as ReadableStream, duplex: 'half' }),
        } as RequestInit)
        const response = await handleOperationsBrief(request, env)
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      } catch { res.statusCode = 500; res.end('Operations Brief unavailable') }
    })
  } }
}
