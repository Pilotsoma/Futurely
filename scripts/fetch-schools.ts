/**
 * One-time script to fetch all US high schools from the Urban Institute
 * Education Data API (NCES CCD) and save them as a static JSON file.
 *
 * Run with:
 *   npx ts-node --skipProject scripts/fetch-schools.ts
 * or (if ts-node isn't available):
 *   node --loader ts-node/esm scripts/fetch-schools.ts
 *
 * Output: backend/src/data/schools-full.json
 * Then update backend/src/data/schools.ts to import that file instead.
 */

import * as fs from 'fs'
import * as path from 'path'

interface NCESSchool {
  school_name?: string
  city_location?: string
  state_location?: string
  [key: string]: unknown
}

interface APIResponse {
  count?: number
  next?: string | null
  results?: NCESSchool[]
}

const BASE = 'https://educationdata.urban.org/api/v1/schools/ccd/directory/2019/'
const PER_PAGE = 10000
const DELAY_MS = 500

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(page: number): Promise<APIResponse> {
  const url = `${BASE}?school_level=3&school_status=1&per_page=${PER_PAGE}&page=${page}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; school-data-fetcher/1.0)',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`)
  return res.json() as Promise<APIResponse>
}

async function main() {
  console.log('Fetching US high schools from NCES CCD via Urban Institute API...')
  console.log('This may take a few minutes.\n')

  // Fetch page 1 to discover total count
  const first = await fetchPage(1)

  if (!first.results || first.results.length === 0) {
    console.error('No results on page 1. Check the API URL or year.')
    console.log('First response keys:', Object.keys(first))
    process.exit(1)
  }

  // Log a sample record so field names can be verified
  console.log('Sample record (first result):')
  console.log(JSON.stringify(first.results[0], null, 2))
  console.log()

  const total = first.count ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)
  console.log(`Total schools: ${total}, pages: ${totalPages}`)

  const all: Array<{ name: string; city: string; state: string }> = []

  function processResults(results: NCESSchool[]) {
    for (const s of results) {
      const name = (s.school_name ?? '').trim()
      const city = (s.city_location ?? '').trim()
      const state = (s.state_location ?? '').trim()
      if (name) all.push({ name, city, state })
    }
  }

  processResults(first.results)
  console.log(`Page 1/${totalPages} — ${all.length} schools so far`)

  for (let page = 2; page <= totalPages; page++) {
    await sleep(DELAY_MS)
    try {
      const data = await fetchPage(page)
      processResults(data.results ?? [])
      console.log(`Page ${page}/${totalPages} — ${all.length} schools so far`)
    } catch (err) {
      console.error(`Error on page ${page}:`, err)
      console.log('Continuing with what we have...')
    }
  }

  // Sort alphabetically by name
  all.sort((a, b) => a.name.localeCompare(b.name))

  const outPath = path.join(__dirname, '../backend/src/data/schools-full.json')
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2))
  console.log(`\nDone! Wrote ${all.length} schools to ${outPath}`)
  console.log('\nNext step: update backend/src/data/schools.ts to use this file.')
}

main().catch(err => { console.error(err); process.exit(1) })
