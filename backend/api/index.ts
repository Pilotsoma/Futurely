import app from '../src/app'
import { ensureSchema } from '../src/lib/startup'

// Run schema patches in the background — never block incoming requests.
ensureSchema().catch(err => console.error('[startup]', err))

// Tell the Vercel runtime to allow up to 60 seconds for this function.
// The agent orchestrator runs a multi-step tool-use loop (up to 12 tool calls
// by default, 15 hard cap) with one LLM round-trip per turn plus DB writes —
// this can easily exceed the default 10-second limit on Hobby plans.
// A bare `export const maxDuration` is a Next.js route-segment convention —
// it does nothing for a plain @vercel/node function like this one (built via
// vercel.json's "builds", not compiled by Next.js). The `config` export below
// is the actual @vercel/node convention for this.
// Has no effect on non-Vercel runtimes (local dev, Render).
// memory: a page load fires roughly a dozen API calls concurrently
// (auth/me, several /integrations/grades/* endpoints, notifications,
// assignments, canvas status, etc.), which can all land on the same warm
// instance — production logs showed a crash ("Node.js process exited with
// exit status: 129") at the exact moment ~12 such requests hit at once,
// consistent with the instance running out of memory. 1024 is the max
// Hobby-plan allows; this is a no-op if already at that ceiling, but raises
// it if the plan supports more.
export const config = { maxDuration: 60, memory: 1024 }

export default function handler(req: any, res: any): void {
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/'
  app(req, res)
}
