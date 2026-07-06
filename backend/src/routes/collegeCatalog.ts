import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

const router = Router()

const CATALOG_DEFAULT_LIMIT = 10
const CATALOG_MAX_LIMIT = 20
const CATALOG_MIN_QUERY_LENGTH = 2

const catalogQuerySchema = z.object({
  q: z.string().min(CATALOG_MIN_QUERY_LENGTH, 'q must be at least 2 characters'),
  limit: z
    .string()
    .optional()
    .transform(val => (val !== undefined ? parseInt(val, 10) : CATALOG_DEFAULT_LIMIT))
    .pipe(z.number().int().min(1).max(CATALOG_MAX_LIMIT)),
})

/**
 * GET /colleges/catalog?q=<string>&limit=<number>
 *
 * No auth required — this is shared reference data with no FERPA/COPPA implications.
 * Case-insensitive substring match on college name.
 * Returns full College rows (id, name, avgSat, avgAct, avgGpa, acceptanceRate).
 * acceptanceRate is the raw 0-1 decimal from the DB (0.06 = 6%) — not converted here.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const parse = catalogQuerySchema.safeParse(req.query)
  if (!parse.success) {
    const message = parse.error.errors[0]?.message ?? 'Invalid query parameters'
    res.status(400).json({ data: null, error: { message } })
    return
  }

  const { q, limit } = parse.data

  try {
    const colleges = await prisma.college.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { name: 'asc' },
    })
    res.json({ data: colleges })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Do not leak internal error details to the client
    void message
    res.status(500).json({ data: null, error: { message: 'Failed to query college catalog.' } })
  }
})

export default router
