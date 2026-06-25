import app from '../src/app'
import { ensureSchema } from '../src/lib/startup'

// Run schema patches in the background — never block incoming requests.
ensureSchema().catch(err => console.error('[startup]', err))

export default function handler(req: any, res: any): void {
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
