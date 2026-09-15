import app from '../src/app'
import { ensureSchema } from '../src/lib/startup'

// Run schema patches in the background — never block incoming requests.
ensureSchema().catch(err => console.error('[startup]', err))

// Tell the Vercel runtime to allow up to 60 seconds for this function.
// The agent orchestrator runs a multi-step tool-use loop (up to 12 tool calls
// by default, 15 hard cap) with one LLM round-trip per turn plus DB writes —
// this can easily exceed the default 10-second limit on Hobby plans.
// This is a classic @vercel/node function (see vercel.json's "builds"), which
// honours this named export directly — no extra vercel.json config needed.
// Has no effect on non-Vercel runtimes (local dev, Render).
export const maxDuration = 60

export default function handler(req: any, res: any): void {
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
