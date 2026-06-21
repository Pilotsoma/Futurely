import app from '../src/app'
import { ensureSchema } from '../src/lib/startup'

// Module-level promise: resolves once per cold start, instant on warm requests.
const schemaReady = ensureSchema()

export default async function handler(req: any, res: any): Promise<void> {
  await schemaReady
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
