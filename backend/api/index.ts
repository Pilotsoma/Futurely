import app from '../src/app'

// Vercel routes /api/* requests to this function.
// Express routes are mounted without the /api prefix, so strip it here.
export default function handler(req: any, res: any): void {
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
