import app from '../src/app'
import { ensureSchema } from '../src/lib/startup'

// Vercel routes /api/* requests to this function.
// Express routes are mounted without the /api prefix, so strip it here.

// Fire schema patches on cold start. The module-level promise is shared
// across all warm invocations — after the first request resolves it,
// subsequent requests await an already-resolved promise (free).
const ready = ensureSchema()

export default async function handler(req: any, res: any): Promise<void> {
  await ready
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
