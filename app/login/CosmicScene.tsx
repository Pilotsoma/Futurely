'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Particles from '../Particles'

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
export default function CosmicScene() {
  const [reduceMotion, setReduceMotion] = useState(false)
  const staticStarBackground = useMemo(buildStaticStarBackground, [])

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
        position: 'absolute', left: '90.5%', top: '44%', width: '5%', aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(220,235,255,0.9) 0%, rgba(180,210,255,0.35) 45%, transparent 75%)',
        filter: 'blur(6px)',
        animation: reduceMotion ? undefined : 'glowPulse 4.5s ease-in-out infinite',
      }} />

      {/* Glow — galaxy core */}
      <div style={{
        position: 'absolute', left: '84.5%', top: '15%', width: '8%', aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(230,210,255,0.55) 0%, rgba(190,160,255,0.2) 50%, transparent 75%)',
        filter: 'blur(5px)',
        animation: reduceMotion ? undefined : 'glowPulse 5.5s ease-in-out infinite',
        animationDelay: '0.5s',
      }} />

      {/* Purple glows — the smaller floating doors scattered through the scene */}
      {[
        { left: '27.5%', top: '54%',   size: '3.5%', delay: '1.1s' },
        { left: '36%',   top: '67.5%', size: '3.5%', delay: '2.4s' },
        { left: '67.5%', top: '67.5%', size: '3.5%', delay: '0.2s' },
      ].map((g, i) => (
        <div key={i} style={{
          position: 'absolute', left: g.left, top: g.top, width: g.size, aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
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
          <Particles particleColors={['#ffffff']} particleCount={220} particleSpread={10} speed={0.08} particleBaseSize={80} alphaParticles={false} meteorMinMs={3000} meteorMaxMs={7000} />
        </div>
      )}
    </div>
  )
}
