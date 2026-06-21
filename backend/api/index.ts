import app from '../src/app'

export default function handler(req: any, res: any): void {
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
