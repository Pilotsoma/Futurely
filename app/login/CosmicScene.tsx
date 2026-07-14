'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Particles from '../Particles'

/** Fixed cosmic backdrop for the login/register screen — starfield, textured
 *  drifting planets with rings and atmospheres, and a boy silhouette standing
 *  on a cratered rock looking out at the sky. Desktop only (mounted by caller). */
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

      {/* Faint nebula wash for depth */}
      <div style={{
        position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: 0.5,
        background: `
          radial-gradient(ellipse 700px 380px at 75% 70%, rgba(120,60,180,0.10) 0%, transparent 70%),
          radial-gradient(ellipse 600px 400px at 15% 20%, rgba(40,90,200,0.10) 0%, transparent 70%)
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
        style={{ position: 'absolute', top: '56%', left: '5%', width: 96, height: 96 }}
      >
        <OceanPlanet />
      </motion.div>

      {/* Cratered moon, upper left */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -9, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        style={{ position: 'absolute', top: '18%', left: '11%', width: 44, height: 44 }}
      >
        <MoonPlanet />
      </motion.div>

      {/* Boy standing on a cratered rock, looking out at his future */}
      <motion.div
        animate={reduceMotion ? {} : { y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="cosmic-boy"
        style={{ position: 'absolute', bottom: '-2%', left: '3%', width: 300 }}
      >
        <BoyOnRock />
      </motion.div>
    </div>
  )
}

function RingedPlanet() {
  return (
    <svg viewBox="0 0 200 200" width="190" height="190" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="rp-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="72%" stopColor="rgba(240,180,110,0)" />
          <stop offset="100%" stopColor="rgba(240,180,110,0.35)" />
        </radialGradient>
        <radialGradient id="rp-body" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#ffe3ae" />
          <stop offset="35%" stopColor="#f0a85c" />
          <stop offset="68%" stopColor="#c46f2e" />
          <stop offset="100%" stopColor="#5c2c0e" />
        </radialGradient>
        <radialGradient id="rp-terminator" cx="72%" cy="68%" r="65%">
          <stop offset="0%" stopColor="rgba(20,8,0,0)" />
          <stop offset="65%" stopColor="rgba(20,8,0,0)" />
          <stop offset="100%" stopColor="rgba(15,5,0,0.75)" />
        </radialGradient>
        <linearGradient id="rp-ring" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,225,180,0)" />
          <stop offset="30%" stopColor="rgba(255,225,180,0.85)" />
          <stop offset="50%" stopColor="rgba(200,160,110,0.55)" />
          <stop offset="70%" stopColor="rgba(255,225,180,0.85)" />
          <stop offset="100%" stopColor="rgba(255,225,180,0)" />
        </linearGradient>
        <clipPath id="rp-clip"><circle cx="100" cy="100" r="58" /></clipPath>
      </defs>

      <circle cx="100" cy="100" r="72" fill="url(#rp-atmo)" />

      {/* ring — back half, behind the planet body */}
      <ellipse cx="100" cy="100" rx="98" ry="26" fill="none" stroke="url(#rp-ring)" strokeWidth="7"
        transform="rotate(-16 100 100)" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 46%, 0% 46%)' }} opacity="0.9" />

      {/* planet body with cloud bands + terminator shading */}
      <circle cx="100" cy="100" r="58" fill="url(#rp-body)" />
      <g clipPath="url(#rp-clip)" opacity="0.5">
        <ellipse cx="96" cy="78" rx="55" ry="6" fill="#fff2d6" opacity="0.35" />
        <ellipse cx="104" cy="92" rx="58" ry="5" fill="#a85a24" opacity="0.4" />
        <ellipse cx="98" cy="106" rx="56" ry="7" fill="#fff2d6" opacity="0.28" />
        <ellipse cx="102" cy="122" rx="54" ry="4" fill="#8a4318" opacity="0.4" />
        <ellipse cx="96" cy="134" rx="52" ry="5" fill="#fbd9a4" opacity="0.25" />
      </g>
      <circle cx="100" cy="100" r="58" fill="url(#rp-terminator)" />
      {/* limb rim light */}
      <circle cx="100" cy="100" r="58" fill="none" stroke="rgba(255,230,190,0.4)" strokeWidth="1" />

      {/* ring — front half, in front of the planet body */}
      <ellipse cx="100" cy="100" rx="98" ry="26" fill="none" stroke="url(#rp-ring)" strokeWidth="7"
        transform="rotate(-16 100 100)" style={{ clipPath: 'polygon(0% 46%, 100% 46%, 100% 100%, 0% 100%)' }} />
    </svg>
  )
}

function OceanPlanet() {
  return (
    <svg viewBox="0 0 100 100" width="96" height="96" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="op-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="78%" stopColor="rgba(110,180,255,0)" />
          <stop offset="100%" stopColor="rgba(110,180,255,0.4)" />
        </radialGradient>
        <radialGradient id="op-body" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#bfe3ff" />
          <stop offset="35%" stopColor="#5fa9e8" />
          <stop offset="70%" stopColor="#2456a8" />
          <stop offset="100%" stopColor="#0e1f4a" />
        </radialGradient>
        <radialGradient id="op-terminator" cx="72%" cy="68%" r="65%">
          <stop offset="0%" stopColor="rgba(4,6,20,0)" />
          <stop offset="60%" stopColor="rgba(4,6,20,0)" />
          <stop offset="100%" stopColor="rgba(3,5,16,0.8)" />
        </radialGradient>
        <clipPath id="op-clip"><circle cx="50" cy="50" r="34" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="42" fill="url(#op-atmo)" />
      <circle cx="50" cy="50" r="34" fill="url(#op-body)" />
      <g clipPath="url(#op-clip)" fill="#8fd99a" opacity="0.75">
        <ellipse cx="38" cy="36" rx="10" ry="6" transform="rotate(-20 38 36)" />
        <ellipse cx="60" cy="46" rx="8" ry="5" transform="rotate(15 60 46)" />
        <ellipse cx="44" cy="62" rx="7" ry="4" transform="rotate(30 44 62)" />
      </g>
      <g clipPath="url(#op-clip)" fill="#ffffff" opacity="0.35">
        <ellipse cx="52" cy="30" rx="16" ry="4" transform="rotate(-8 52 30)" />
        <ellipse cx="34" cy="56" rx="12" ry="3.5" transform="rotate(10 34 56)" />
      </g>
      <circle cx="50" cy="50" r="34" fill="url(#op-terminator)" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(180,220,255,0.4)" strokeWidth="0.75" />
    </svg>
  )
}

function MoonPlanet() {
  return (
    <svg viewBox="0 0 60 60" width="44" height="44" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="mp-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="75%" stopColor="rgba(230,235,255,0)" />
          <stop offset="100%" stopColor="rgba(230,235,255,0.35)" />
        </radialGradient>
        <radialGradient id="mp-body" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#d7dbec" />
          <stop offset="80%" stopColor="#9298b3" />
          <stop offset="100%" stopColor="#4d5170" />
        </radialGradient>
        <radialGradient id="mp-terminator" cx="72%" cy="68%" r="65%">
          <stop offset="0%" stopColor="rgba(10,10,20,0)" />
          <stop offset="55%" stopColor="rgba(10,10,20,0)" />
          <stop offset="100%" stopColor="rgba(6,6,14,0.75)" />
        </radialGradient>
        <clipPath id="mp-clip"><circle cx="30" cy="30" r="22" /></clipPath>
      </defs>
      <circle cx="30" cy="30" r="27" fill="url(#mp-atmo)" />
      <circle cx="30" cy="30" r="22" fill="url(#mp-body)" />
      <g clipPath="url(#mp-clip)" fill="rgba(60,64,90,0.4)">
        <circle cx="22" cy="24" r="4" />
        <circle cx="35" cy="20" r="2.5" />
        <circle cx="38" cy="35" r="5" />
        <circle cx="24" cy="38" r="3" />
      </g>
      <circle cx="30" cy="30" r="22" fill="url(#mp-terminator)" />
    </svg>
  )
}

function BoyOnRock() {
  return (
    <svg viewBox="0 0 300 230" width="300" height="230" fill="none" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="by-glow" cx="46%" cy="30%" r="55%">
          <stop offset="0%" stopColor="rgba(160,150,255,0.28)" />
          <stop offset="100%" stopColor="rgba(160,150,255,0)" />
        </radialGradient>
        <radialGradient id="by-rock" cx="30%" cy="18%" r="85%">
          <stop offset="0%" stopColor="#4a3d6b" />
          <stop offset="30%" stopColor="#332a4d" />
          <stop offset="65%" stopColor="#1c1730" />
          <stop offset="100%" stopColor="#0a0816" />
        </radialGradient>
        <linearGradient id="by-figure" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1b1730" />
          <stop offset="100%" stopColor="#050409" />
        </linearGradient>
        <radialGradient id="by-moon" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#dfe3ff" />
          <stop offset="100%" stopColor="#9aa3e0" />
        </radialGradient>
      </defs>

      {/* moon he's looking at, up and to the left */}
      <circle cx="72" cy="34" r="17" fill="url(#by-moon)" opacity="0.95" />
      <circle cx="72" cy="34" r="24" fill="url(#by-moon)" opacity="0.12" />
      <circle cx="66" cy="28" r="2.6" fill="rgba(120,130,190,0.35)" />
      <circle cx="78" cy="40" r="1.8" fill="rgba(120,130,190,0.3)" />

      {/* ambient glow behind the figure */}
      <ellipse cx="150" cy="120" rx="160" ry="130" fill="url(#by-glow)" />

      {/* the rock/asteroid he's standing on */}
      <ellipse cx="150" cy="360" rx="260" ry="260" fill="url(#by-rock)" stroke="rgba(170,150,255,0.22)" strokeWidth="1.5" />
      {/* horizon rim light */}
      <path d="M -60 118 Q 150 78 360 118" fill="none" stroke="rgba(180,165,255,0.3)" strokeWidth="1.5" />
      {/* craters */}
      <ellipse cx="60" cy="128" rx="14" ry="5" fill="rgba(0,0,0,0.22)" />
      <ellipse cx="225" cy="132" rx="18" ry="6" fill="rgba(0,0,0,0.2)" />
      <ellipse cx="130" cy="148" rx="9" ry="3.5" fill="rgba(0,0,0,0.16)" />
      <ellipse cx="55" cy="128" rx="6" ry="2" fill="rgba(255,255,255,0.05)" />

      {/* contact shadow under his feet */}
      <ellipse cx="150" cy="196" rx="30" ry="7" fill="rgba(0,0,0,0.35)" />

      {/* boy — hoodie silhouette, hands in pocket, head tilted up at the moon */}
      <g transform="translate(150,58)">
        {/* hair / head, slight upward tilt */}
        <path d="M -13 8 C -14 -6 -3 -14 6 -12 C 16 -10 18 0 15 10 C 14 15 10 18 4 18 C -6 19 -12 15 -13 8 Z" fill="url(#by-figure)" />
        {/* hoodie shoulders + torso */}
        <path d="M -20 34 C -21 20 -14 15 -6 15 L 12 14 C 21 14 27 20 27 34 L 29 78 C 29 84 24 88 15 89 L -13 89 C -21 88 -25 84 -24 78 Z" fill="url(#by-figure)" />
        {/* hood ridge line for detail */}
        <path d="M -14 16 C -8 22 12 22 18 15" fill="none" stroke="rgba(150,140,220,0.28)" strokeWidth="1.2" />
        {/* pocket seam */}
        <path d="M -14 58 C -6 63 12 63 20 58" fill="none" stroke="rgba(150,140,220,0.2)" strokeWidth="1" />
        {/* arms, hands tucked in pocket */}
        <path d="M -20 30 C -30 36 -33 50 -28 62 C -25 66 -19 65 -16 60 C -20 50 -19 40 -13 32 Z" fill="url(#by-figure)" />
        <path d="M 27 30 C 37 36 40 50 35 62 C 32 66 26 65 23 60 C 27 50 26 40 20 32 Z" fill="url(#by-figure)" />
        {/* legs, standing at ease */}
        <path d="M -13 85 L -18 132 L -6 132 L -2 89 Z" fill="url(#by-figure)" />
        <path d="M 16 85 L 21 132 L 9 132 L 4 89 Z" fill="url(#by-figure)" />
        {/* shoes */}
        <ellipse cx="-13" cy="135" rx="9" ry="4" fill="#050409" />
        <ellipse cx="16" cy="135" rx="9" ry="4" fill="#050409" />
        {/* rim light along the sky-facing edge */}
        <path d="M 15 -10 C 22 -4 26 6 24 16 M 22 24 C 28 30 30 42 27 56 M 20 60 L 24 78"
          fill="none" stroke="rgba(180,170,255,0.35)" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
