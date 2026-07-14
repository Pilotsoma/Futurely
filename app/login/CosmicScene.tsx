'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Particles from '../Particles'

const IMG_W = 1086
const IMG_H = 1448

/** Fixed cosmic backdrop for the login/register screen — the hand-designed hero
 *  artwork (boy on a small world, looking out at a ringed planet and a distant
 *  galaxy), shown uncropped, with animated stars and soft glow accents layered
 *  on top for motion and depth. Desktop only (mounted by caller). */
export default function CosmicScene() {
  const [reduceMotion, setReduceMotion] = useState(false)

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
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 1; }
        }
      `}</style>

      {/* Deep space gradient — base tint under everything */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 20% 75%, rgba(60,20,100,0.20) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 15%, rgba(15,35,90,0.18) 0%, transparent 48%),
          radial-gradient(ellipse at 50% 45%, #0b0a20 0%, #050414 100%)
        `.replace(/\s+/g, ' '),
      }} />

      {/* Blurred full-bleed copy of the artwork — fills the whole viewport edge to
          edge so the sides never go flat black, like a soft-focus backdrop behind
          the crisp foreground copy. */}
      <div style={{ position: 'absolute', inset: '-5%' }}>
        <Image
          src="/login/login-bg.png"
          alt=""
          fill
          sizes="100vw"
          style={{ objectFit: 'cover', filter: 'blur(60px) brightness(0.55) saturate(1.15)', transform: 'scale(1.1)' }}
        />
      </div>

      {/* Ambient starfield across the whole viewport, including the letterboxed edges */}
      {!reduceMotion && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Particles particleColors={['#ffffff']} particleCount={160} particleSpread={10} speed={0.08} particleBaseSize={80} alphaParticles={false} />
        </div>
      )}

      {/* The artwork — scaled up and anchored to the top-left so both the boy
          (bottom-left of the frame) and the ringed planet (top-right) clear the
          centered login card, instead of both hiding behind it. A little of the
          plain planet surface at the very bottom of the image gets cropped off,
          which is the least important part of the composition. */}
      <div style={{ position: 'absolute', top: 0, left: '-4%', height: '137vh', aspectRatio: `${IMG_W} / ${IMG_H}` }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <Image
            src="/login/login-bg.png"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 140vh, 0px"
            style={{ objectFit: 'contain' }}
          />

          {/* Extra twinkling stars layered directly over the artwork for a livelier sky.
              Positioned with plain CSS left/top percentages — SVG's own transform=
              "translate(%, %)" syntax doesn't support percentage units, which silently
              collapsed every star to the same spot the first time this was written. */}
          {[
            { x: '9%', y: '58%', scale: 0.45, dur: 2.4 }, { x: '38%', y: '8%', scale: 0.6, dur: 3.1 },
            { x: '48%', y: '52%', scale: 0.75, dur: 3.8 }, { x: '73%', y: '65%', scale: 0.45, dur: 2.4 },
            { x: '91%', y: '46%', scale: 0.6, dur: 3.1 }, { x: '60%', y: '30%', scale: 0.75, dur: 3.8 },
            { x: '20%', y: '25%', scale: 0.45, dur: 2.4 }, { x: '82%', y: '78%', scale: 0.6, dur: 3.1 },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute', left: s.x, top: s.y, width: 21, height: 21,
                transform: 'translate(-50%,-50%)',
                opacity: reduceMotion ? 0.7 : undefined,
                animation: reduceMotion ? undefined : `starTwinkle ${s.dur}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            >
              <svg width="100%" height="100%" viewBox="-10.5 -10.5 21 21" style={{ overflow: 'visible' }}>
                <SparkleStar scale={s.scale} />
              </svg>
            </div>
          ))}

          {/* Glow — the lit doorway, pulsing gently */}
          <div style={{
            position: 'absolute', left: '54%', top: '57%', width: '9%', aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(220,235,255,0.9) 0%, rgba(180,210,255,0.35) 45%, transparent 75%)',
            filter: 'blur(6px)',
            animation: reduceMotion ? undefined : 'glowPulse 4.5s ease-in-out infinite',
          }} />

          {/* Glow — soft halo around the ringed planet */}
          <div style={{
            position: 'absolute', left: '77%', top: '20%', width: '46%', aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(190,200,255,0.16) 0%, rgba(150,170,240,0.07) 50%, transparent 75%)',
            filter: 'blur(10px)',
            animation: reduceMotion ? undefined : 'glowPulse 7s ease-in-out infinite',
            animationDelay: '1s',
          }} />

          {/* Glow — galaxy core */}
          <div style={{
            position: 'absolute', left: '86%', top: '51%', width: '14%', aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(230,210,255,0.55) 0%, rgba(190,160,255,0.2) 50%, transparent 75%)',
            filter: 'blur(5px)',
            animation: reduceMotion ? undefined : 'glowPulse 5.5s ease-in-out infinite',
            animationDelay: '0.5s',
          }} />
        </div>
      </div>
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
