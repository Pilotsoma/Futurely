import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Use WebSocket (port 443) instead of raw TCP (port 5432).
// Vercel's serverless network blocks outbound TCP to port 5432 but
// WebSocket over TLS (wss://) is always open.
neonConfig.webSocketConstructor = ws

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaNeon(pool)

export const prisma = new PrismaClient({ adapter })
