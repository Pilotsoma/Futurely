import { PrismaClient } from '@prisma/client'
import { PrismaNeonHTTP } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

// Neon HTTP API requires the direct (non-pooled) connection URL.
// DATABASE_URL goes through PgBouncer (-pooler. host) which doesn't support
// the HTTP query endpoint. DIRECT_URL bypasses PgBouncer — use it here.
const sql = neon(process.env.DIRECT_URL ?? process.env.DATABASE_URL!)
const adapter = new PrismaNeonHTTP(sql)

export const prisma = new PrismaClient({ adapter })
