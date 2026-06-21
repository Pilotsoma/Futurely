import { Router, Request, Response } from 'express'
import { logger } from '../common/logger'

const router = Router()

// GET /schools/search?q=lincoln
// Public — no auth needed, used on teacher registration form
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q ?? '').trim()
  if (q.length < 2) { res.json({ data: [] }); return }

  try {
    const url = `https://educationdata.urban.org/api/v1/schools/ccd/directory/?school_name=${encodeURIComponent(q)}&grade_high=12&per_page=12&ordering=school_name`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) { res.json({ data: [] }); return }

    const json = await resp.json() as { results?: Array<{ school_name?: string; city_location?: string; state_location?: string }> }
    const results = (json.results ?? []).map(s => ({
      name: s.school_name ?? '',
      city: s.city_location ?? '',
      state: s.state_location ?? '',
    })).filter(s => s.name)

    res.json({ data: results })
  } catch (err) {
    logger.warn('schools_search_error', { q, error: err instanceof Error ? err.message : String(err) })
    res.json({ data: [] })
  }
})

export default router
