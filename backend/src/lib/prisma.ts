import { PrismaClient } from '@prisma/client'
import { PrismaNeonHTTP } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

// HTTP transport: each query is a plain HTTPS request to Neon — no WebSocket
// handshake on cold serverless starts. ~300-700ms faster per cold function.
// Trade-off: no interactive transactions (prisma.$transaction w/ callback).
// Confirmed: no $transaction calls exist in this codebase.
const sql = neon(process.env.DATABASE_URL!)
const adapter = new PrismaNeonHTTP(sql)

export const prisma = new PrismaClient({ adapter })
