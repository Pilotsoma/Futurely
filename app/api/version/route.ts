export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({
    sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev',
  })
}
