import app from '../src/app'
import { ensureSchema } from '../src/lib/startup'

// Fire patches in the background — never block incoming requests.
ensureSchema()

export default function handler(req: any, res: any): void {
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
