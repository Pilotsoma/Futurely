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
          <stop offset="80%" stopColor="rgba(240,180,110,0)" />
          <stop offset="100%" stopColor="rgba(240,180,110,0.2)" />
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
          <stop offset="82%" stopColor="rgba(110,180,255,0)" />
          <stop offset="100%" stopColor="rgba(110,180,255,0.22)" />
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
    <svg viewBox="0 0 260 210" width="260" height="210" fill="none" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="by-rock" cx="32%" cy="15%" r="80%">
          <stop offset="0%" stopColor="#372c50" />
          <stop offset="55%" stopColor="#1e1832" />
          <stop offset="100%" stopColor="#0a0816" />
        </radialGradient>
      </defs>

      {/* the rock/asteroid he's standing on */}
      <ellipse cx="130" cy="330" rx="230" ry="230" fill="url(#by-rock)" stroke="rgba(170,150,255,0.18)" strokeWidth="1.5" />
      {/* horizon rim light, catching light from the upper right */}
      <path d="M -50 104 Q 130 66 310 104" fill="none" stroke="rgba(180,165,255,0.25)" strokeWidth="1.5" />
      {/* a couple of simple craters */}
      <ellipse cx="52" cy="112" rx="12" ry="4" fill="rgba(0,0,0,0.2)" />
      <ellipse cx="196" cy="116" rx="15" ry="5" fill="rgba(0,0,0,0.18)" />

      {/* contact shadow under his feet */}
      <ellipse cx="128" cy="176" rx="24" ry="6" fill="rgba(0,0,0,0.35)" />

      {/* boy — flat side-profile silhouette, facing right, looking up toward the top-right sky */}
      <g transform="translate(96,44)" fill="#0a0814">
        {/* head, profile facing right with a small nose */}
        <path d="M -8 -6 C -11 -16 -6 -27 5 -29 C 15 -31 22 -24 22 -15
                 C 25 -14 26 -11 24 -9 C 22 -7 20 -8 19 -10
                 C 18 -5 15 -1 10 1 L 8 5 C 4 7 -2 7 -6 5
                 C -9 3 -10 -2 -8 -6 Z" />
        {/* collar / hood base at the neck */}
        <path d="M -5 3 C -8 8 -7 13 -2 16 L 10 16 C 14 13 15 8 12 3 Z" />
        {/* hoodie torso, slight forward lean, kangaroo pocket up front */}
        <path d="M -14 12 C -19 20 -20 34 -17 50 L -13 88
                 C -12 94 -6 98 3 98 L 19 98
                 C 27 98 32 93 31 86 L 27 50
                 C 30 34 28 20 21 12
                 C 13 7 -6 7 -14 12 Z" />
        {/* pocket seam */}
        <path d="M -12 58 C -3 64 15 64 24 57" fill="none" stroke="rgba(150,140,220,0.18)" strokeWidth="1.2" strokeLinecap="round" />
        {/* back leg */}
        <path d="M -9 92 C -13 92 -16 95 -16 99 L -19 132 C -19 135 -17 137 -13 137 L -6 137 C -3 137 -1 135 -1 132 L -1 96 Z" />
        {/* front leg, stepped forward toward the right */}
        <path d="M 12 94 C 16 93 20 95 21 99 L 27 130 C 28 134 26 137 22 137 L 12 137 C 9 137 7 135 7 132 L 8 98 Z" />
        {/* simple shoe caps */}
        <path d="M -20 132 L -3 132 C -1 132 0 134 -1 136 C -3 140 -11 141 -17 140 C -20 139 -21 135 -20 132 Z" />
        <path d="M 8 130 L 30 130 C 33 130 34 132 32 135 C 30 139 21 140 13 138 C 9 137 7 133 8 130 Z" />
        {/* single rim-light accent along the sky-facing edge, catching light from upper right */}
        <path d="M 19 -25 C 24 -20 26 -13 24 -9 M 21 12 C 28 20 30 34 27 50 L 31 86 M 27 99 L 32 128"
          fill="none" stroke="rgba(180,170,255,0.3)" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  )
}
