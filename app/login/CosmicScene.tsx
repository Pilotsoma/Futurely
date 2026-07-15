'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Particles from '../Particles'

const IMG_ASPECT = 1536 / 1024

/** object-fit: cover crops the image asymmetrically depending on how the
 *  viewport's aspect ratio compares to the image's — e.g. on a wider-than-image
 *  viewport it's cropped top/bottom (scaled to viewport width), and vice versa.
 *  Glow accents are authored as percentages of the *original* image, so this
 *  tracks how much has been cropped off each edge and remaps those percentages
 *  into the visible, on-screen coordinate space. */
function useCoverCrop(imageAspect: number) {
  const [crop, setCrop] = useState({ xPct: 0, yPct: 0 })
  useEffect(() => {
    function update() {
      const w = window.innerWidth, h = window.innerHeight
      const viewportAspect = w / h
      if (viewportAspect > imageAspect) {
        const imgH = w / imageAspect
        setCrop({ xPct: 0, yPct: ((imgH - h) / 2 / imgH) * 100 })
      } else {
        const imgW = h * imageAspect
        setCrop({ xPct: ((imgW - w) / 2 / imgW) * 100, yPct: 0 })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [imageAspect])
  return crop
}

function mapCoverPct(rawPct: number, cropPct: number) {
  return ((rawPct - cropPct) / (100 - 2 * cropPct)) * 100
}

/** A cheap, static starfield — a single CSS background-image of radial-gradient
 *  dots, painted once with no canvas or animation loop. Used in place of the
 *  animated <Particles> canvas for prefers-reduced-motion / low-end CPUs, so
 *  those users still see stars instead of a flat gradient. */
function buildStaticStarBackground() {
  let seed = 42
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const stops: string[] = []
  for (let i = 0; i < 70; i++) {
    const x = (rand() * 100).toFixed(1)
    const y = (rand() * 100).toFixed(1)
    const size = (0.7 + rand() * 1.3).toFixed(1)
    const alpha = (0.35 + rand() * 0.55).toFixed(2)
    stops.push(`radial-gradient(${size}px ${size}px at ${x}% ${y}%, rgba(255,255,255,${alpha}), transparent 100%)`)
  }
  return stops.join(', ')
}

/** Fixed cosmic backdrop for the login/register screen — the hand-designed hero
 *  artwork (boy on a small world, looking out at a ringed planet and a distant
 *  galaxy), filling the entire screen edge to edge, with animated stars and soft
 *  glow accents layered on top for motion and depth. Desktop only (mounted by caller). */
// Glow accents, authored as percentages of the original 1536x1024 artwork.
// Coordinates were found by computer — thresholding pixel brightness to locate
// each door's bright rectangle centroid and the black hole's dark void — then
// confirmed by cropping the source image at that exact point, rather than
// eyeballed off a downscaled preview (which was off by several percent).
const GLOWS = {
  litDoor:   { x: 89.0, y: 42.8, size: 4.5, color: 'rgba(220,235,255,0.9)',  colorMid: 'rgba(180,210,255,0.35)', delay: '0s' },
  blackHole: { x: 84.4, y: 17.0, size: 18,  color: 'rgba(200,170,255,0.5)',  colorMid: 'rgba(160,120,255,0.18)', delay: '0.5s' },
  doors: [
    { x: 29.9, y: 57.7, size: 4.5, delay: '1.1s' },
    { x: 35.4, y: 70.9, size: 4,   delay: '2.4s' },
    { x: 67.2, y: 67.2, size: 4.5, delay: '0.2s' },
  ],
}

export default function CosmicScene() {
  const [reduceMotion, setReduceMotion] = useState(false)
  const staticStarBackground = useMemo(buildStaticStarBackground, [])
  const crop = useCoverCrop(IMG_ASPECT)
  const at = (x: number, y: number) => ({
    left: `${mapCoverPct(x, crop.xPct)}%`,
    top:  `${mapCoverPct(y, crop.yPct)}%`,
  })

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lowEndCpu = (navigator.hardwareConcurrency ?? 8) <= 4
    if (prefersReduced || lowEndCpu) setReduceMotion(true)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none', background: '#050414' }}>
      <style>{`
        @keyframes glowPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.94); }
          50%      { opacity: 0.75; transform: scale(1.06); }
        }
      `}</style>

      {/* The artwork — full-bleed, covering the entire screen. */}
      <Image
        src="/login/login-bg-landscape.png"
        alt=""
        fill
        priority
        sizes="100vw"
        style={{ objectFit: 'cover' }}
      />

      {/* Deep space gradient — subtle tint on top of the artwork, darkest behind
          the centered login card so it stays readable. */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 50% 50%, rgba(5,4,20,0.35) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(5,4,20,0.35) 100%)
        `.replace(/\s+/g, ' '),
      }} />

      {/* Glow — the lit doorway, pulsing gently */}
      <div style={{
        position: 'absolute', ...at(GLOWS.litDoor.x, GLOWS.litDoor.y), width: `${GLOWS.litDoor.size}%`, aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${GLOWS.litDoor.color} 0%, ${GLOWS.litDoor.colorMid} 45%, transparent 75%)`,
        filter: 'blur(6px)',
        animation: reduceMotion ? undefined : 'glowPulse 4.5s ease-in-out infinite',
        animationDelay: GLOWS.litDoor.delay,
      }} />

      {/* Glow — the black hole / supernova, wrapping the visible swirl */}
      <div style={{
        position: 'absolute', ...at(GLOWS.blackHole.x, GLOWS.blackHole.y), width: `${GLOWS.blackHole.size}%`, aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${GLOWS.blackHole.color} 0%, ${GLOWS.blackHole.colorMid} 45%, transparent 72%)`,
        filter: 'blur(8px)',
        animation: reduceMotion ? undefined : 'glowPulse 5.5s ease-in-out infinite',
        animationDelay: GLOWS.blackHole.delay,
      }} />

      {/* Purple glows — the smaller floating doors scattered through the scene */}
      {GLOWS.doors.map((g, i) => (
        <div key={i} style={{
          position: 'absolute', ...at(g.x, g.y), width: `${g.size}%`, aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,150,255,0.7) 0%, rgba(150,100,230,0.28) 50%, transparent 75%)',
          filter: 'blur(5px)',
          animation: reduceMotion ? undefined : `glowPulse ${4.8 + i * 0.6}s ease-in-out infinite`,
          animationDelay: g.delay,
        }} />
      ))}

      {/* Ambient starfield — twinkling stars and shooting stars, drawn last so
          they sit on top of the artwork instead of being hidden behind it.
          Low-end/reduced-motion devices get a static (unanimated) starfield
          instead of the animated canvas, so they still see stars. */}
      {reduceMotion ? (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: staticStarBackground }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Particles particleColors={['#ffffff']} particleCount={220} particleSpread={10} speed={0.08} particleBaseSize={80} alphaParticles={false} meteorMinMs={7000} meteorMaxMs={10000} />
        </div>
      )}
    </div>
  )
}
