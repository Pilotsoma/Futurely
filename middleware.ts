import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// accountStatus embedded in the JWT as a convenience claim only.
// This is defense-in-depth for the UI — the real enforcement is server-side
// via requireActiveAccount middleware. The claim can be stale for up to the
// 15-minute access token TTL, which is acceptable for this redirect layer.

const FIX_BIRTHDAY_PATH = '/account/fix-birthday'
const ACCESS_RESTRICTED_PATH = '/account/access-restricted'

interface JwtPayload {
  sub: unknown
  role: unknown
  accountStatus: unknown
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Never redirect loops on the account recovery pages themselves
  if (pathname.startsWith('/account/')) return NextResponse.next()

  const rawSecret = process.env.JWT_SECRET
  if (!rawSecret) return NextResponse.next()

  const tokenValue = request.cookies.get('access_token')?.value
  if (!tokenValue) return NextResponse.next()

  try {
    const secret = new TextEncoder().encode(rawSecret)
    const { payload } = await jwtVerify(tokenValue, secret)
    const { accountStatus } = payload as unknown as JwtPayload

    if (accountStatus === 'DOB_MISMATCH_LOCKED') {
      return NextResponse.redirect(new URL(FIX_BIRTHDAY_PATH, request.url))
    }
    if (accountStatus === 'UNDER_13_BANNED') {
      return NextResponse.redirect(new URL(ACCESS_RESTRICTED_PATH, request.url))
    }
  } catch {
    // Expired or invalid token — allow through; the client-side auth flow in
    // app/(app)/layout.tsx will redirect to /login when it can't refresh.
    return NextResponse.next()
  }

  return NextResponse.next()
}

// Explicitly enumerate the student-facing protected route segments.
// /account/**, /login, /api/**, and marketing pages are intentionally excluded
// so they are never caught in a redirect loop.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/grades/:path*',
    '/planner/:path*',
    '/feed/:path*',
    '/ai/:path*',
    '/roadmap/:path*',
    '/settings/:path*',
    '/colleges/:path*',
    '/marketplace/:path*',
    '/sets/:path*',
    '/play/:path*',
    '/battle/:path*',
    '/classroom/:path*',
    '/my-counselor/:path*',
  ],
}
