'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Particles from '../Particles'

/** Fixed cosmic backdrop for the login/register screen — a dense, layered starfield
 *  with a soft Milky Way band, naturalistic textured planets, and an illustrated boy
 *  standing on a small world looking up at the sky. Desktop only (mounted by caller). */
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

      {/* Boy standing on a small world, looking up at his future */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="cosmic-boy"
        style={{ position: 'absolute', bottom: '-3%', left: '2%', width: 360 }}
      >
        <BoyOnRock />
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

/** Illustrated boy — three-quarter turn, warm colored jacket, visible face and hair,
 *  standing at ease on a small cratered world, gazing up toward the top-right sky. */
function BoyOnRock() {
  return (
    <svg viewBox="0 0 280 240" width="360" height="309" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="by-rock" cx="30%" cy="14%" r="82%">
          <stop offset="0%" stopColor="#40335c" />
          <stop offset="50%" stopColor="#221b38" />
          <stop offset="100%" stopColor="#0a0816" />
        </radialGradient>
        <radialGradient id="by-crater" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="50%" stopColor="rgba(0,0,0,0.05)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </radialGradient>

        <linearGradient id="by-hair" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a3324" />
          <stop offset="100%" stopColor="#1c130c" />
        </linearGradient>
        <linearGradient id="by-skin" x1="20%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#f0c39b" />
          <stop offset="100%" stopColor="#c9895e" />
        </linearGradient>
        <linearGradient id="by-jacket" x1="10%" y1="0%" x2="95%" y2="100%">
          <stop offset="0%" stopColor="#e08a4c" />
          <stop offset="55%" stopColor="#c1602c" />
          <stop offset="100%" stopColor="#8a3d1a" />
        </linearGradient>
        <linearGradient id="by-pants" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#31324a" />
          <stop offset="100%" stopColor="#1a1a29" />
        </linearGradient>
      </defs>

      {/* the small world he's standing on */}
      <ellipse cx="140" cy="360" rx="240" ry="240" fill="url(#by-rock)" stroke="rgba(180,160,255,0.16)" strokeWidth="1.5" />
      <path d="M -60 122 Q 140 82 340 122" fill="none" stroke="rgba(190,175,255,0.22)" strokeWidth="1.5" />
      <circle cx="58" cy="128" r="9" fill="url(#by-crater)" />
      <circle cx="212" cy="132" r="12" fill="url(#by-crater)" />
      <circle cx="138" cy="146" r="6" fill="url(#by-crater)" />

      {/* contact shadow under his feet */}
      <ellipse cx="150" cy="220" rx="34" ry="7" fill="rgba(0,0,0,0.4)" />

      {/* ── figure ─────────────────────────────────────────────────────── */}
      <g transform="translate(112,40)">

        {/* back arm, hand relaxed at side */}
        <path d="M -20 58 C -28 66 -30 82 -26 98 C -25 103 -19 104 -16 100 C -19 88 -18 74 -12 62 Z"
          fill="url(#by-jacket)" />
        <ellipse cx="-24" cy="99" rx="5" ry="6" fill="url(#by-skin)" />

        {/* legs */}
        <path d="M -3 150 C -8 150 -12 154 -12 159 L -15 196 C -15 200 -12 202 -7 202 L 2 202 C 6 202 8 200 8 196 L 6 156 Z"
          fill="url(#by-pants)" />
        <path d="M 22 152 C 27 151 32 154 33 159 L 40 194 C 41 199 38 202 33 202 L 22 202 C 18 202 16 200 16 196 L 17 158 Z"
          fill="url(#by-pants)" />
        {/* shoes */}
        <path d="M -17 196 L 3 196 C 6 196 7 199 5 202 C 2 207 -8 208 -16 206 C -20 205 -21 200 -17 196 Z" fill="#e9e4d8" />
        <path d="M -17 196 L 3 196 C 6 196 7 199 5 202 L -17 202 Z" fill="#c1602c" opacity="0.7" />
        <path d="M 16 194 L 41 194 C 44 194 46 197 43 200 C 40 205 29 207 20 205 C 16 204 14 198 16 194 Z" fill="#e9e4d8" />
        <path d="M 16 194 L 41 194 C 44 194 46 197 43 200 L 16 200 Z" fill="#c1602c" opacity="0.7" />

        {/* torso / jacket, slight forward lean, three-quarter turn */}
        <path d="M -16 46 C -22 55 -23 72 -19 92 L -14 148
                 C -13 155 -6 160 4 160 L 24 160
                 C 33 160 39 154 38 146 L 32 92
                 C 36 72 33 55 25 46
                 C 16 40 -7 40 -16 46 Z"
          fill="url(#by-jacket)" />
        {/* jacket zipper + collar */}
        <path d="M 4 48 L 2 158" fill="none" stroke="rgba(30,14,4,0.35)" strokeWidth="1.4" />
        <path d="M -10 44 C -6 50 8 50 14 44 L 10 52 C 4 56 -4 56 -8 52 Z" fill="#e9d9bf" opacity="0.85" />
        {/* fold shading */}
        <path d="M -14 70 C -6 76 20 76 28 68" fill="none" stroke="rgba(30,14,4,0.22)" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M -12 110 C -2 116 22 116 30 108" fill="none" stroke="rgba(30,14,4,0.18)" strokeWidth="1.6" strokeLinecap="round" />
        {/* highlight edge catching starlight from upper right */}
        <path d="M 25 46 C 33 55 36 72 32 92 L 38 146" fill="none" stroke="rgba(255,220,180,0.4)" strokeWidth="1.4" strokeLinecap="round" />

        {/* front arm, bent at the elbow, hand tucked into the front pocket */}
        <path d="M 22 50 C 30 54 35 63 36 73 C 37 81 34 88 27 91 C 23 93 19 91 19 87
                 C 23 85 26 79 25 71 C 24 63 21 56 15 51 Z"
          fill="url(#by-jacket)" />

        {/* neck */}
        <path d="M -5 27 L -5 46 L 11 46 L 11 27 Z" fill="url(#by-skin)" />
        <path d="M -5 27 L 11 27 L 11 33 C 5 36 1 36 -5 33 Z" fill="#000" opacity="0.12" />

        {/* ── head, three-quarter turn toward upper right ───────────────── */}
        <g transform="translate(0,17) rotate(-10 2 8)">
          {/* hair — back mass */}
          <path d="M -20 6 C -23 -10 -14 -26 4 -29 C 22 -32 35 -19 34 -3
                   C 34 3 31 6 27 5 C 29 -6 22 -16 8 -18 C -6 -20 -16 -10 -17 3
                   C -17 8 -14 12 -10 13 C -16 15 -20 12 -20 6 Z"
            fill="url(#by-hair)" />
          {/* face — skin base */}
          <ellipse cx="7" cy="-8" rx="17" ry="19" fill="url(#by-skin)" />
          {/* ear */}
          <path d="M -9 -6 C -13 -7 -14 -2 -11 2 C -9 4 -6 3 -6 0 Z" fill="url(#by-skin)" />
          {/* hair — swept fringe over the forehead */}
          <path d="M -12 -18 C -6 -26 8 -28 18 -22 C 22 -19 24 -14 23 -9
                   C 18 -15 9 -19 -1 -18 C -7 -17 -10 -14 -12 -10 Z"
            fill="url(#by-hair)" />
          <path d="M -2 -20 C 4 -24 12 -24 17 -20" fill="none" stroke="#6b4a32" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />

          {/* eyebrow */}
          <path d="M 10 -13 C 14 -15 18 -15 21 -13" fill="none" stroke="#2a1c12" strokeWidth="1.6" strokeLinecap="round" />
          {/* eye */}
          <path d="M 11 -8 C 14 -10 19 -10 22 -7.5 C 19 -5.5 14 -5.5 11 -8 Z" fill="#fff" />
          <circle cx="17" cy="-7.8" r="2.1" fill="#4a2f1c" />
          <circle cx="17.6" cy="-8.4" r="0.6" fill="#fff" />
          {/* nose */}
          <path d="M 22 -6 C 24 -3 24 0 21 1.5" fill="none" stroke="#a9744e" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
          {/* mouth */}
          <path d="M 13 5 C 16 6.5 20 6.5 22 4.8" fill="none" stroke="#93553a" strokeWidth="1.4" strokeLinecap="round" />
          {/* cheek + jaw shading */}
          <path d="M 20 -2 C 23 1 22 6 18 9 C 21 5 20 0 17 -2 Z" fill="#a9714a" opacity="0.28" />
          <path d="M -6 -4 C -3 4 2 10 9 11 C 1 12 -6 6 -8 -2 Z" fill="#a9714a" opacity="0.22" />

          {/* rim light along the hair/skull edge facing the sky */}
          <path d="M 27 5 C 31 -3 32 -14 27 -22 C 24 -26 20 -29 15 -30"
            fill="none" stroke="rgba(255,225,190,0.35)" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
