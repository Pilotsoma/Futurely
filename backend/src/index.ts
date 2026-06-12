import app from './app'
import { logger } from './common/logger'

const PORT = Number(process.env.PORT ?? '3001')

app.listen(PORT, '0.0.0.0', () => {
  logger.info('NextStep API started', {
    port: PORT,
    url: 'http://0.0.0.0:3001',
  })
})