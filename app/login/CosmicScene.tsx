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
      `}</style>

      {/* Deep space gradient — fills any letterboxed edge around the artwork */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 20% 75%, rgba(60,20,100,0.20) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 15%, rgba(15,35,90,0.18) 0%, transparent 48%),
          radial-gradient(ellipse at 50% 45%, #0b0a20 0%, #050414 100%)
        `.replace(/\s+/g, ' '),
      }} />

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

          {/* Extra twinkling stars layered directly over the artwork for a livelier sky */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              {[
                { x: '9%', y: '58%' }, { x: '38%', y: '8%' }, { x: '48%', y: '52%' },
                { x: '73%', y: '65%' }, { x: '91%', y: '46%' }, { x: '60%', y: '30%' },
                { x: '20%', y: '25%' }, { x: '82%', y: '78%' },
              ].map((s, i) => (
                <g key={i} transform={`translate(${s.x}, ${s.y})`} opacity={reduceMotion ? 0.7 : undefined}>
                  {!reduceMotion && (
                    <animate attributeName="opacity" values="0.25;0.95;0.25" dur={`${2.4 + (i % 4) * 0.7}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
                  )}
                  <SparkleStar scale={0.45 + (i % 3) * 0.15} />
                </g>
              ))}
            </svg>
          </div>

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
