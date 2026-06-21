import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// WebSocket transport — required because Vercel's serverless compute blocks
// outbound port 5432 (raw TCP). Port 443 (wss://) is always open.
neonConfig.webSocketConstructor = ws

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaNeon(pool)

export const prisma = new PrismaClient({ adapter })
