// Seeds the College reference catalog (admission stats used by the college
// probability feature) from data/colleges.csv. Idempotent — upserts by name,
// safe to re-run after the CSV is updated. Run with `npm run seed:colleges`.
import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface CollegeCsvRow {
  college_name: string
  avg_sat: string
  avg_act: string
  avg_gpa: string
  acceptance_rate: string
}

async function main(): Promise<void> {
  const csvPath = path.resolve(__dirname, '../../data/colleges.csv')
  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: No college CSV found. Expected ${csvPath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(csvPath, 'utf-8')
  const rows: CollegeCsvRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    comment: '#',
  })

  for (const row of rows) {
    await prisma.college.upsert({
      where: { name: row.college_name },
      update: {
        avgSat: parseInt(row.avg_sat, 10),
        avgAct: parseFloat(row.avg_act),
        avgGpa: parseFloat(row.avg_gpa),
        acceptanceRate: parseFloat(row.acceptance_rate),
      },
      create: {
        name: row.college_name,
        avgSat: parseInt(row.avg_sat, 10),
        avgAct: parseFloat(row.avg_act),
        avgGpa: parseFloat(row.avg_gpa),
        acceptanceRate: parseFloat(row.acceptance_rate),
      },
    })
  }

  console.log(`Seeded ${rows.length} colleges into the College table from ${csvPath}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
