// One-time (or periodically re-run) bulk import of College Scorecard data for
// common colleges — currently operating, predominantly bachelor's-degree-
// granting institutions — into CollegeScorecardCache.
//
// Why: the /colleges/:id/insights and /colleges/search endpoints only have
// admissions data (admission rate, SAT bands) for a college once it's in this
// cache. Without this seed, the cache starts empty and only fills in
// reactively as students happen to search for a school, which means insights
// fail with "admissions data not found" for any college nobody has searched
// for yet. This script pre-populates the cache with the common/well-known
// colleges most students will actually add to their list, using the same
// live College Scorecard API the app calls on demand.
//
// Usage:
//   npm run seed:colleges
// Requires COLLEGE_SCORECARD_API_KEY (and DATABASE_URL) in the environment —
// register a free key at https://api.data.gov/signup/ if you don't have one.
// Safe to re-run: every row is upserted by unitId.

import dotenv from 'dotenv'
dotenv.config()

import { PrismaClient } from '@prisma/client'
import { fetchCommonInstitutionsPage, type ScorecardSchool } from '../src/integrations/scorecard/scorecardClient'

const prisma = new PrismaClient()

// Safety cap on pages fetched, in case a future Scorecard API change makes
// the filter match far more than the ~2,000-3,000 bachelor's-predominant
// institutions expected — this stops a silently-broken filter from turning
// into an unbounded crawl instead of just failing loudly.
const MAX_PAGES = 100
const DELAY_BETWEEN_PAGES_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function upsertBatch(schools: ScorecardSchool[]): Promise<{ ok: number; failed: number }> {
  let ok = 0
  let failed = 0
  await Promise.all(
    schools.map(async school => {
      try {
        await prisma.collegeScorecardCache.upsert({
          where: { unitId: school.unitId },
          update: {
            name: school.name,
            city: school.city,
            state: school.state,
            admissionRate: school.admissionRate,
            sat25th: school.sat25th,
            sat75th: school.sat75th,
            enrollment: school.enrollment,
            fetchedAt: new Date(),
          },
          create: {
            unitId: school.unitId,
            name: school.name,
            city: school.city,
            state: school.state,
            admissionRate: school.admissionRate,
            sat25th: school.sat25th,
            sat75th: school.sat75th,
            enrollment: school.enrollment,
          },
        })
        ok++
      } catch (err) {
        failed++
        console.warn(`  ! upsert failed for ${school.name} (${school.unitId}):`, err instanceof Error ? err.message : err)
      }
    })
  )
  return { ok, failed }
}

async function main(): Promise<void> {
  if (!process.env.COLLEGE_SCORECARD_API_KEY) {
    console.error('COLLEGE_SCORECARD_API_KEY is not set — get a free key at https://api.data.gov/signup/ and set it in your environment before running this script.')
    process.exitCode = 1
    return
  }

  console.log('Seeding CollegeScorecardCache from the College Scorecard API...\n')

  let page = 0
  let totalOk = 0
  let totalFailed = 0
  let reportedTotal: number | null = null

  while (page < MAX_PAGES) {
    const { schools, total } = await fetchCommonInstitutionsPage(page)
    if (reportedTotal === null) reportedTotal = total

    if (schools.length === 0) {
      console.log(`Page ${page}: no more results — done.`)
      break
    }

    const { ok, failed } = await upsertBatch(schools)
    totalOk += ok
    totalFailed += failed
    console.log(`Page ${page}: fetched ${schools.length}, upserted ${ok}${failed > 0 ? `, ${failed} failed` : ''} (${totalOk}/${reportedTotal ?? '?'} so far)`)

    const fetchedSoFar = (page + 1) * schools.length
    if (reportedTotal !== null && fetchedSoFar >= reportedTotal) {
      console.log('Reached the reported total — done.')
      break
    }

    page++
    await sleep(DELAY_BETWEEN_PAGES_MS)
  }

  if (page >= MAX_PAGES) {
    console.warn(`Hit the ${MAX_PAGES}-page safety cap — stopped early. If the Scorecard API's institution count has grown a lot, raise MAX_PAGES in this script.`)
  }

  console.log(`\nDone. ${totalOk} colleges upserted, ${totalFailed} failed.`)
}

main()
  .catch(err => {
    console.error('Seed failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
