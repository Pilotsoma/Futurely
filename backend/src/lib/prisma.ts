import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import { logger } from '../common/logger'

neonConfig.webSocketConstructor = ws

// This backend runs as a stateless Vercel serverless function (see
// backend/api/index.ts) — every cold-started instance creates its own Pool,
// so a traffic burst (e.g. the cold-start stampede right after a deploy, or
// after Vercel scales idle instances down) can spin up many Pools at once,
// each opening connections against the same Neon database. Without explicit
// limits here, a saturated connection budget doesn't fail fast: `pg`-style
// pools default connectionTimeoutMillis to 0 (no timeout), so a query
// waiting for a free client queues indefinitely instead of erroring — which
// surfaced as requests hanging forever until the pressure eventually eased
// on its own, several minutes later. max/connectionTimeoutMillis/
// idleTimeoutMillis keep this instance's own footprint small and make
// exhaustion fail fast (a clear 5xx) instead of hanging.
// Measured against production: Neon's compute needs a bit over 8s to wake
// from auto-suspend on a cold request, so an 8s timeout was cutting the
// connection off right as it was about to succeed — turning "slow" into "hard
// failure" for every request that happened to land during a cold-start
// window (this is what made login/refresh intermittently fail outright
// rather than just being slow). 10s gives the wake-up enough room, and the
// retry-once wrapper below means even a request unlucky enough to hit a
// timeout gets one more chance — which succeeds near-instantly once the
// compute is actually warm, per the same measurement.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
})

// Neon's serverless driver terminates idle WebSocket connections after a
// period of inactivity. The pool emits an 'error' event on the idle client
// when that happens — without a listener, Node's default behavior is to
// throw, which wedges the process (it keeps running but stops responding to
// requests, since the underlying pool state is left inconsistent). Attaching
// a listener lets the pool do what it's designed to do: discard the dead
// client and transparently open a new one on the next query. No reconnect
// logic needed here — pg-style pools already handle that internally.
pool.on('error', (err: Error) => {
  logger.error('Neon pool idle client error — pool will recover on next query', {
    message: err.message,
  })
})

const adapter = new PrismaNeon(pool)

const basePrisma = new PrismaClient({ adapter })

// Neon compute waking from auto-suspend is the single most common cause of a
// query failing here — and it's transient by definition: the compute is
// warm within a second or two of the wake-up completing, so the very next
// attempt almost always succeeds (measured: an 8.2s cold-start timeout
// followed immediately by a 0.3s success on retry). Retrying once on exactly
// this class of error turns an otherwise-user-facing failure into invisible
// added latency, without masking real, non-transient errors (bad queries,
// constraint violations, etc. are never retried).
export function isTransientConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('timeout exceeded when trying to connect') ||
    msg.includes('connection terminated') ||
    msg.includes("can't reach database server") ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused')
  )
}

export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      try {
        return await query(args)
      } catch (err) {
        if (!isTransientConnectionError(err)) throw err
        logger.warn('Prisma query failed on a transient connection error — retrying once', {
          model,
          operation,
          errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
        })
        return await query(args)
      }
    },
  },
})
