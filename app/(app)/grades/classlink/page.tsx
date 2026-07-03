// DISABLED: ClassLink integration paused, pending completion.
// The full connect UI lives in git history (this file, prior to July 2026).
// Restore it — and re-add the ClassLink card in app/(app)/grades/page.tsx,
// the ClassLink branches in app/login/page.tsx + app/(app)/settings/page.tsx,
// and the router mount in backend/src/app.ts — when the integration is ready.
import { redirect } from 'next/navigation'

export default function ClasslinkConnectPage() {
  redirect('/grades')
}
