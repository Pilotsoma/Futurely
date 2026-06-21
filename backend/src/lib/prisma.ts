import { PrismaClient } from '@prisma/client'
import { PrismaNeonHTTP } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

// Neon HTTP API requires the direct (non-pooled) connection string.
// DATABASE_URL routes through PgBouncer (-pooler. in hostname) which
// doesn't support the HTTP query endpoint — strip it to get the direct URL.
const directUrl = (process.env.DATABASE_URL ?? '').replace(/-pooler(?=\.)/, '')
const sql = neon(directUrl)
const adapter = new PrismaNeonHTTP(sql)

export const prisma = new PrismaClient({ adapter })
