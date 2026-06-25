import app from '../src/app'
import { ensureSchema } from '../src/lib/startup'

// Run schema patches once per cold start (idempotent — safe to re-run).
// Awaited so the very first request doesn't hit a stale schema.
const schemaReady = ensureSchema()

export default async function handler(req: any, res: any): Promise<void> {
  await schemaReady
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
