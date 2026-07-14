'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Particles from '../Particles'

/** Fixed cosmic backdrop for the login/register screen — starfield, drifting planets,
 *  and a boy silhouette standing on a small planet looking out at the sky. */
export default function CosmicScene() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lowEndCpu = (navigator.hardwareConcurrency ?? 8) <= 4
    if (prefersReduced || lowEndCpu) setReduceMotion(true)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        .cosmic-boy { display: none; }
        @media (min-width: 980px) {
          .cosmic-boy { display: block; }
        }
      `}</style>
      {/* Deep space gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 20% 75%, rgba(50,15,90,0.16) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 15%, rgba(10,30,80,0.14) 0%, transparent 48%),
          radial-gradient(ellipse at 50% 45%, #0c0c22 0%, #04040e 100%)
        `.replace(/\s+/g, ' '),
      }} />

      {/* Starfield + shooting stars */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {reduceMotion ? (
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: 140 }, (_, i) => {
              const seed = i * 2654435761
              const x = ((seed >>> 0) % 10000) / 100
              const y = ((seed * 1234567) >>> 0) % 10000 / 100
              const r = 0.4 + ((seed * 987654) >>> 0) % 10 / 14
              const op = 0.25 + ((seed * 123456) >>> 0) % 10 / 17
              return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" fillOpacity={op} />
            })}
          </svg>
        ) : (
          <Particles particleColors={['#ffffff']} particleCount={220} particleSpread={10} speed={0.1} particleBaseSize={100} alphaParticles={false} />
        )}
      </div>

      {/* Drifting planets */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -14, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '10%', right: '8%', width: 90, height: 90, borderRadius: '50%',
          background: 'radial-gradient(circle at 32% 30%, #f9c97c 0%, #e0873a 45%, #7a3d12 100%)',
          boxShadow: '0 0 50px rgba(240,160,80,0.25)',
        }}
      >
        <div style={{
          position: 'absolute', inset: '-10% -35%', border: '2px solid rgba(255,220,170,0.35)',
          borderRadius: '50%', transform: 'rotate(-18deg)',
        }} />
      </motion.div>

      <motion.div
        animate={reduceMotion ? {} : { y: [0, 12, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        style={{
          position: 'absolute', top: '58%', left: '6%', width: 46, height: 46, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #a5c9ff 0%, #4a6bd6 55%, #1c2a63 100%)',
          boxShadow: '0 0 30px rgba(90,130,255,0.25)',
        }}
      />

      <motion.div
        animate={reduceMotion ? {} : { y: [0, -8, 0] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        style={{
          position: 'absolute', top: '22%', left: '12%', width: 20, height: 20, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #c8dcff 60%, #7c94c9 100%)',
          boxShadow: '0 0 18px rgba(200,220,255,0.4)',
        }}
      />

      {/* Boy standing on a small planet, looking out at his future */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="cosmic-boy"
        style={{ position: 'absolute', bottom: '0%', left: '4%', width: 220, opacity: 0.92 }}
      >
        <svg viewBox="0 0 260 200" width="220" height="169" fill="none">
          <defs>
            <radialGradient id="planetSurface" cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#3a2f57" />
              <stop offset="55%" stopColor="#221a38" />
              <stop offset="100%" stopColor="#100c1e" />
            </radialGradient>
            <radialGradient id="moonGlow" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor="rgba(180,160,255,0.22)" />
              <stop offset="100%" stopColor="rgba(180,160,255,0)" />
            </radialGradient>
          </defs>

          {/* soft glow behind the scene */}
          <ellipse cx="130" cy="120" rx="140" ry="110" fill="url(#moonGlow)" />

          {/* small planet the boy is standing on */}
          <ellipse cx="130" cy="330" rx="230" ry="230" fill="url(#planetSurface)" stroke="rgba(180,160,255,0.25)" strokeWidth="1.5" />
          {/* craters for texture */}
          <ellipse cx="70" cy="112" rx="10" ry="4" fill="rgba(0,0,0,0.18)" />
          <ellipse cx="190" cy="118" rx="14" ry="5" fill="rgba(0,0,0,0.15)" />

          {/* boy silhouette, hands on hips, looking up at the stars */}
          <g transform="translate(130,60)">
            {/* head, tilted up */}
            <circle cx="2" cy="10" r="11" fill="#0a0814" />
            {/* body */}
            <path d="M -9 30 C -9 18 -5 21 2 21 C 9 21 13 18 13 30 L 13 52 C 13 56 9 58 2 58 C -5 58 -9 56 -9 52 Z" fill="#0a0814" />
            {/* legs, standing apart */}
            <path d="M -6 55 L -10 78 L -3 78 L 0 58 Z" fill="#0a0814" />
            <path d="M 8 55 L 12 78 L 5 78 L 2 58 Z" fill="#0a0814" />
            {/* arms, hands resting near hips */}
            <path d="M -9 24 C -15 28 -16 36 -14 42 L -9 40 C -10 34 -9 29 -6 25 Z" fill="#0a0814" />
            <path d="M 13 24 C 19 28 20 36 18 42 L 13 40 C 14 34 13 29 10 25 Z" fill="#0a0814" />
          </g>

          {/* horizon rim light */}
          <ellipse cx="130" cy="100" rx="230" ry="230" fill="none" stroke="rgba(180,160,255,0.18)" strokeWidth="1" />
        </svg>
      </motion.div>
    </div>
  )
}
