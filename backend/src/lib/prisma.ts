import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws
// Pipeline the auth handshake with the first query — saves one round trip on cold start
neonConfig.pipelineConnect = 'password'

// Use direct URL (bypass PgBouncer pooler) — pooling doesn't help in serverless
// since each function instance is short-lived. Direct is lower latency.
const directUrl = (process.env.DATABASE_URL ?? '').replace(/-pooler(?=\.)/, '')
const pool = new Pool({ connectionString: directUrl })
const adapter = new PrismaNeon(pool)

export const prisma = new PrismaClient({ adapter })
