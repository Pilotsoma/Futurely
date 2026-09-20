import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import { logger } from '../common/logger'

neonConfig.webSocketConstructor = ws

// This backend runs as a stateless Vercel serverless function (see
// backend/api/index.ts). Without explicit limits here, a saturated
// connection budget doesn't fail fast: `pg`-style pools default
// connectionTimeoutMillis to 0 (no timeout), so a query waiting for a free
// client queues indefinitely instead of erroring. connectionTimeoutMillis/
// idleTimeoutMillis make exhaustion fail fast (a clear 5xx) instead of
// hanging; Neon's compute is now configured to never auto-suspend, so a
// healthy connection should establish in well under a second, and 5s is
// generous headroom for that while still failing fast if something's wrong.
//
// max was previously 5, sized to avoid exceeding Neon's connection budget
// if many serverless instances each opened their own pool at once. Real
// production logs showed this was too low in a different way: a single page
// load fires roughly a dozen API requests concurrently, and when several
// land on the same warm instance they compete for just 5 connections,
// queuing (and sometimes timing out) rather than running in parallel — this
// is what caused the instance to crash under load and cascade into 60s
// timeouts on other endpoints. Neon's actual limit here is 894 direct
// connections, so 5 per instance was far too conservative; 20 gives real
// headroom for a single instance's concurrent request burst while still
// being nowhere near Neon's actual ceiling even multiplied across many
// concurrent instances.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  connectionTimeoutMillis: 5000,
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

// Even with auto-suspend disabled, a connection can still fail transiently
// (a dropped socket, a brief network blip) — retrying once turns that into
// invisible added latency instead of a user-facing failure, without masking
// real, non-transient errors (bad queries, constraint violations, etc. are
// never retried). With the shorter timeout above, the worst case for a
// request that hits two real connection failures in a row is ~10s, not the
// ~20s it would have been at the old cold-start-sized timeout.
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
