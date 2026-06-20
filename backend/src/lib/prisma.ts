import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Route all Prisma queries through WebSocket (port 443) instead of raw
// TCP (port 5432). Vercel's serverless compute blocks outbound port 5432
// but wss:// on 443 is always open. This is Neon's recommended approach.
neonConfig.webSocketConstructor = ws

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaNeon(pool)

export const prisma = new PrismaClient({ adapter })
