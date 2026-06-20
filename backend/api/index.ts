import app from '../src/app'
import { ensureSchema } from '../src/lib/startup'

// Vercel routes /api/* requests to this function.
// Express routes are mounted without the /api prefix, so strip it here.

// Fire schema patches on cold start without blocking requests.
// The patches are idempotent and fast — the feed may fail on the very
// first cold-start request if columns aren't patched yet, but login
// and other routes are never blocked.
void ensureSchema()

export default function handler(req: any, res: any): void {
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
