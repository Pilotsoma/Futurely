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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 8000,
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

export const prisma = new PrismaClient({ adapter })
