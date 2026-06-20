import { PrismaClient } from '@prisma/client'

// The pooled endpoint (-pooler) is sometimes unreachable from Vercel's
// serverless runtime. Use DIRECT_URL (bypasses PgBouncer) which has
// proven reachable. For this app's traffic level, direct connections
// won't exhaust Neon's connection limit.
export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
})
