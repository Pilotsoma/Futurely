'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Roadmap now lives as a tab inside My Future (/colleges) — redirect any
// bookmarked or linked visits there instead of 404ing.
export default function RoadmapRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/colleges') }, [router])
  return null
}
