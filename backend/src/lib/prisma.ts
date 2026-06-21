import { PrismaClient } from '@prisma/client'
import { PrismaNeonHTTP } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

// HTTP transport: no WebSocket handshake on cold start — each query is a plain
// HTTPS request. Faster on serverless than WebSocket Pool (no connection setup).
// Trade-off: no interactive transactions (prisma.$transaction with callback) —
// confirmed none are used in this codebase.
const sql = neon(process.env.DATABASE_URL!)
const adapter = new PrismaNeonHTTP(sql)

export const prisma = new PrismaClient({ adapter })
