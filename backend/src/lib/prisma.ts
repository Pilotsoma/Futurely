import { PrismaClient } from '@prisma/client'

// Append connect_timeout=30 so Neon has time to auto-resume from suspension.
// Neon free tier suspends after 5 min of inactivity; the default Prisma
// timeout (5s) is often too short for the resume to complete.
function dbUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url || url.includes('connect_timeout')) return url
  return url + (url.includes('?') ? '&' : '?') + 'connect_timeout=30'
}

export const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl() } },
})
