import app from './app'
import { logger } from './common/logger'
import { prisma } from './lib/prisma'
import { restoreSessionFromCache, type SchoolSystemType } from './integrations/grades/sessionStore'

const PORT = Number(process.env.PORT ?? '3001')

app.listen(PORT, '0.0.0.0', () => {
  logger.info('NextStep API started', {
    port: PORT,
    url: 'http://0.0.0.0:3001',
  })
  restoreAllSessions()
})

async function restoreAllSessions() {
  try {
    const connections = await prisma.schoolConnection.findMany({
      where: { cachedSession: { not: null } },
    })
    let restored = 0
    for (const conn of connections) {
      if (!conn.cachedSession || !conn.districtUrl) continue
      try {
        const token = restoreSessionFromCache(
          conn.userId,
          (conn.systemType as SchoolSystemType) ?? 'HAC',
          conn.districtUrl,
          conn.cachedSession,
        )
        if (token) restored++
      } catch {}
    }
    logger.info(`[AUTO-LOGIN] Restored ${restored}/${connections.length} sessions on startup`)
  } catch (e) {
    logger.warn('[AUTO-LOGIN] Startup restore failed (non-fatal):', { error: String(e) })
  }
}