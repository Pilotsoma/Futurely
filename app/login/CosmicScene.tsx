'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Particles from '../Particles'

/** Fixed cosmic backdrop for the login/register screen — a dense, layered starfield
 *  with a soft Milky Way band, naturalistic textured planets, and an astronaut
 *  reaching toward the stars. Desktop only (mounted by caller). */
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
          radial-gradient(ellipse at 20% 75%, rgba(60,20,100,0.22) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 15%, rgba(15,35,90,0.20) 0%, transparent 48%),
          radial-gradient(ellipse at 50% 45%, #0d0d24 0%, #030309 100%)
        `.replace(/\s+/g, ' '),
      }} />

      {/* Soft Milky Way band — diagonal, painterly, gives the sky depth to stare into */}
      <div style={{
        position: 'absolute', inset: '-10%', transform: 'rotate(-22deg)',
        background: `
          linear-gradient(100deg,
            transparent 0%,
            rgba(120,110,190,0.05) 30%,
            rgba(190,160,210,0.09) 44%,
            rgba(220,200,230,0.11) 50%,
            rgba(160,150,220,0.08) 56%,
            rgba(100,110,180,0.05) 68%,
            transparent 100%)
        `.replace(/\s+/g, ' '),
        filter: 'blur(2px)',
        mixBlendMode: 'screen',
      }} />

      {/* Starfield + shooting stars */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {reduceMotion ? (
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            {Array.from({ length: 200 }, (_, i) => {
              const seed = i * 2654435761
              const x = ((seed >>> 0) % 10000) / 100
              const y = ((seed * 1234567) >>> 0) % 10000 / 100
              const r = 0.4 + ((seed * 987654) >>> 0) % 10 / 13
              const op = 0.25 + ((seed * 123456) >>> 0) % 10 / 15
              return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" fillOpacity={op} />
            })}
          </svg>
        ) : (
          <Particles particleColors={['#ffffff']} particleCount={280} particleSpread={10} speed={0.09} particleBaseSize={105} alphaParticles={false} />
        )}
      </div>

      {/* A few hand-placed bright sparkle stars for an intricate, premium feel */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {[
          { x: '86%', y: '38%', s: 1 },
          { x: '15%', y: '46%', s: 0.7 },
          { x: '64%', y: '68%', s: 0.6 },
          { x: '46%', y: '12%', s: 0.8 },
        ].map((star, i) => (
          <g key={i} transform={`translate(${star.x}, ${star.y})`} opacity={0.85}>
            <SparkleStar scale={star.s} />
          </g>
        ))}
      </svg>

      {/* Ringed gas giant, top right */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -16, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '6%', right: '6%', width: 190, height: 190 }}
      >
        <RingedPlanet />
      </motion.div>

      {/* Blue-green planet, lower left */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, 14, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        style={{ position: 'absolute', top: '54%', left: '5%', width: 96, height: 96 }}
      >
        <OceanPlanet />
      </motion.div>

      {/* Cratered moon, upper left */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -9, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        style={{ position: 'absolute', top: '17%', left: '11%', width: 44, height: 44 }}
      >
        <MoonPlanet />
      </motion.div>

      {/* Astronaut drifting near a small asteroid, reaching toward his future */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="cosmic-boy"
        style={{ position: 'absolute', bottom: '2%', left: '2%', width: 300 }}
      >
        <StargazerOnRock />
      </motion.div>
    </div>
  )
}

function SparkleStar({ scale = 1 }: { scale?: number }) {
  const s = 14 * scale
  return (
    <g>
      <path d={`M0,${-s} C${s * 0.15},${-s * 0.15} ${s * 0.15},${-s * 0.15} ${s},0 C${s * 0.15},${s * 0.15} ${s * 0.15},${s * 0.15} 0,${s} C${-s * 0.15},${s * 0.15} ${-s * 0.15},${s * 0.15} ${-s},0 C${-s * 0.15},${-s * 0.15} ${-s * 0.15},${-s * 0.15} 0,${-s} Z`}
        fill="#ffffff" opacity={0.9} />
      <circle r={s * 0.16} fill="#ffffff" />
    </g>
  )
}

function RingedPlanet() {
  return (
    <svg viewBox="0 0 200 200" width="190" height="190" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="rp-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="84%" stopColor="rgba(240,200,140,0)" />
          <stop offset="100%" stopColor="rgba(240,200,140,0.14)" />
        </radialGradient>
        <radialGradient id="rp-body" cx="36%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f7e8c8" />
          <stop offset="32%" stopColor="#e0bd8a" />
          <stop offset="62%" stopColor="#b8895a" />
          <stop offset="100%" stopColor="#6b4a34" />
        </radialGradient>
        <radialGradient id="rp-terminator" cx="74%" cy="70%" r="70%">
          <stop offset="0%" stopColor="rgba(30,14,4,0)" />
          <stop offset="55%" stopColor="rgba(30,14,4,0)" />
          <stop offset="85%" stopColor="rgba(25,12,4,0.35)" />
          <stop offset="100%" stopColor="rgba(18,9,3,0.62)" />
        </radialGradient>
        <linearGradient id="rp-ring-1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(240,215,175,0)" />
          <stop offset="28%" stopColor="rgba(240,215,175,0.7)" />
          <stop offset="50%" stopColor="rgba(190,150,105,0.4)" />
          <stop offset="72%" stopColor="rgba(240,215,175,0.7)" />
          <stop offset="100%" stopColor="rgba(240,215,175,0)" />
        </linearGradient>
        <linearGradient id="rp-ring-2" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(220,190,150,0)" />
          <stop offset="35%" stopColor="rgba(220,190,150,0.5)" />
          <stop offset="65%" stopColor="rgba(220,190,150,0.5)" />
          <stop offset="100%" stopColor="rgba(220,190,150,0)" />
        </linearGradient>
        <clipPath id="rp-clip"><circle cx="100" cy="100" r="58" /></clipPath>
      </defs>

      <circle cx="100" cy="100" r="70" fill="url(#rp-atmo)" />

      {/* ring — back half, behind the planet body (three fine bands, like a real ring system) */}
      <g transform="rotate(-16 100 100)" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 46%, 0% 46%)' }} opacity="0.92">
        <ellipse cx="100" cy="100" rx="99" ry="27" fill="none" stroke="url(#rp-ring-1)" strokeWidth="3.5" />
        <ellipse cx="100" cy="100" rx="91" ry="24.5" fill="none" stroke="url(#rp-ring-2)" strokeWidth="2.5" />
        <ellipse cx="100" cy="100" rx="83" ry="22" fill="none" stroke="url(#rp-ring-1)" strokeWidth="2" />
      </g>

      {/* planet body — muted, hand-painted cloud bands */}
      <circle cx="100" cy="100" r="58" fill="url(#rp-body)" />
      <g clipPath="url(#rp-clip)" opacity="0.45">
        <path d="M42,76 Q100,70 158,77 Q100,84 42,76 Z" fill="#fbf1da" opacity="0.4" />
        <path d="M40,90 Q100,83 160,91 Q100,99 40,90 Z" fill="#8a5a34" opacity="0.35" />
        <path d="M41,104 Q100,98 159,105 Q100,113 41,104 Z" fill="#f7e6c4" opacity="0.3" />
        <path d="M43,119 Q100,114 157,120 Q100,127 43,119 Z" fill="#734524" opacity="0.35" />
        <path d="M46,132 Q100,128 154,133 Q100,139 46,132 Z" fill="#f0dcb2" opacity="0.24" />
      </g>
      {/* subtle grain */}
      <g clipPath="url(#rp-clip)" opacity="0.5">
        {Array.from({ length: 14 }, (_, i) => {
          const seed = (i + 1) * 916191
          const x = 55 + ((seed >>> 0) % 100)
          const y = 55 + ((seed * 7) % 100)
          return <circle key={i} cx={x} cy={y} r={0.6} fill="#3a2314" opacity={0.3} />
        })}
      </g>
      <circle cx="100" cy="100" r="58" fill="url(#rp-terminator)" />
      <circle cx="100" cy="100" r="58" fill="none" stroke="rgba(255,235,200,0.3)" strokeWidth="1" />

      {/* ring — front half, in front of the planet body */}
      <g transform="rotate(-16 100 100)" style={{ clipPath: 'polygon(0% 46%, 100% 46%, 100% 100%, 0% 100%)' }}>
        <ellipse cx="100" cy="100" rx="99" ry="27" fill="none" stroke="url(#rp-ring-1)" strokeWidth="3.5" />
        <ellipse cx="100" cy="100" rx="91" ry="24.5" fill="none" stroke="url(#rp-ring-2)" strokeWidth="2.5" />
        <ellipse cx="100" cy="100" rx="83" ry="22" fill="none" stroke="url(#rp-ring-1)" strokeWidth="2" />
      </g>
    </svg>
  )
}

function OceanPlanet() {
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="op-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="84%" stopColor="rgba(110,180,255,0)" />
          <stop offset="100%" stopColor="rgba(110,180,255,0.16)" />
        </radialGradient>
        <radialGradient id="op-body" cx="33%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#cfe9ff" />
          <stop offset="32%" stopColor="#68a9dd" />
          <stop offset="68%" stopColor="#295690" />
          <stop offset="100%" stopColor="#0f1a3a" />
        </radialGradient>
        <radialGradient id="op-terminator" cx="74%" cy="70%" r="68%">
          <stop offset="0%" stopColor="rgba(4,6,20,0)" />
          <stop offset="55%" stopColor="rgba(4,6,20,0)" />
          <stop offset="100%" stopColor="rgba(3,5,16,0.65)" />
        </radialGradient>
        <clipPath id="op-clip"><circle cx="50" cy="50" r="34" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="41" fill="url(#op-atmo)" />
      <circle cx="50" cy="50" r="34" fill="url(#op-body)" />
      <g clipPath="url(#op-clip)" fill="#79c98a" opacity="0.7">
        <path d="M30,30 Q38,26 44,32 Q40,38 34,38 Q28,36 30,30 Z" />
        <path d="M56,40 Q64,38 66,46 Q60,50 54,46 Q52,42 56,40 Z" />
        <path d="M36,58 Q42,55 45,60 Q41,64 37,63 Q34,61 36,58 Z" />
      </g>
      <g clipPath="url(#op-clip)" fill="#ffffff" opacity="0.3">
        <path d="M24,28 Q40,24 54,29" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.5" />
        <path d="M28,54 Q40,52 50,57" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      </g>
      <circle cx="50" cy="50" r="34" fill="url(#op-terminator)" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(190,225,255,0.35)" strokeWidth="0.75" />
    </svg>
  )
}

function MoonPlanet() {
  return (
    <svg viewBox="0 0 60 60" width="44" height="44" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="mp-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="78%" stopColor="rgba(230,235,255,0)" />
          <stop offset="100%" stopColor="rgba(230,235,255,0.22)" />
        </radialGradient>
        <radialGradient id="mp-body" cx="33%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#f4f2f6" />
          <stop offset="45%" stopColor="#cbccdc" />
          <stop offset="80%" stopColor="#83849e" />
          <stop offset="100%" stopColor="#454761" />
        </radialGradient>
        <radialGradient id="mp-terminator" cx="74%" cy="70%" r="68%">
          <stop offset="0%" stopColor="rgba(10,10,20,0)" />
          <stop offset="55%" stopColor="rgba(10,10,20,0)" />
          <stop offset="100%" stopColor="rgba(6,6,14,0.6)" />
        </radialGradient>
        <radialGradient id="mp-crater" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="45%" stopColor="rgba(0,0,0,0.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </radialGradient>
        <clipPath id="mp-clip"><circle cx="30" cy="30" r="22" /></clipPath>
      </defs>
      <circle cx="30" cy="30" r="26" fill="url(#mp-atmo)" />
      <circle cx="30" cy="30" r="22" fill="url(#mp-body)" />
      <g clipPath="url(#mp-clip)">
        <circle cx="22" cy="24" r="4" fill="url(#mp-crater)" />
        <circle cx="35" cy="20" r="2.4" fill="url(#mp-crater)" />
        <circle cx="38" cy="35" r="5" fill="url(#mp-crater)" />
        <circle cx="24" cy="38" r="2.8" fill="url(#mp-crater)" />
        <circle cx="17" cy="31" r="1.6" fill="url(#mp-crater)" />
      </g>
      <circle cx="30" cy="30" r="22" fill="url(#mp-terminator)" />
    </svg>
  )
}

/** A small drifting asteroid alongside an astronaut character reaching toward the
 *  stars. The figure is a real, professionally-drawn illustration (Storyset by
 *  Freepik, free license with attribution — see the credit link in the page footer)
 *  — hand-coded SVG couldn't reach a convincing, colored human likeness, so this
 *  uses a licensed illustration instead of a from-scratch attempt. */
function StargazerOnRock() {
  return (
    <div style={{ position: 'relative', width: 300, height: 260 }}>
      <svg viewBox="0 0 300 260" width="300" height="260" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} fill="none">
        <defs>
          <radialGradient id="sg-rock" cx="30%" cy="18%" r="85%">
            <stop offset="0%" stopColor="#40335c" />
            <stop offset="50%" stopColor="#221b38" />
            <stop offset="100%" stopColor="#0a0816" />
          </radialGradient>
          <radialGradient id="sg-crater" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="50%" stopColor="rgba(0,0,0,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </radialGradient>
        </defs>
        {/* a small asteroid drifting nearby */}
        <ellipse cx="52" cy="232" rx="46" ry="30" fill="url(#sg-rock)" stroke="rgba(180,160,255,0.16)" strokeWidth="1.5" />
        <circle cx="34" cy="222" r="6" fill="url(#sg-crater)" />
        <circle cx="66" cy="230" r="4" fill="url(#sg-crater)" />
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login/stargazer-astronaut.svg"
        alt=""
        style={{
          position: 'absolute', right: 8, top: 0, height: 230, width: 'auto',
          transform: 'scaleX(-1)',
          filter: 'drop-shadow(1px -2px 10px rgba(180,165,255,0.3))',
        }}
      />
    </div>
  )
}

