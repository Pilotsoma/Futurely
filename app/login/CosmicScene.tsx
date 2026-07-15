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

          {/* Glow — the lit doorway, pulsing gently */}
          <div style={{
            position: 'absolute', left: '54%', top: '57%', width: '9%', aspectRatio: '1/1', transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(220,235,255,0.9) 0%, rgba(180,210,255,0.35) 45%, transparent 75%)',
            filter: 'blur(6px)',
            animation: reduceMotion ? undefined : 'glowPulse 4.5s ease-in-out infinite',
          }} />

          {/* Glow — soft halo hugging the ringed planet's actual silhouette (planet +
              rings span roughly x 40%-100%, y 0%-44% of the artwork) */}
          <div style={{
            position: 'absolute', left: '70%', top: '20%', width: '64%', height: '46%', transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, transparent 0%, transparent 58%, rgba(210,220,255,0.4) 70%, rgba(180,195,255,0.18) 84%, transparent 98%)',
            filter: 'blur(8px)',
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

      {/* Ambient starfield — the SAME twinkling stars everywhere, drawn last so they
          sit on top of both the artwork and the blurred backdrop instead of being
          hidden behind the picture. */}
      {!reduceMotion && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Particles particleColors={['#ffffff']} particleCount={160} particleSpread={10} speed={0.08} particleBaseSize={80} alphaParticles={false} />
        </div>
      )}
    </div>
  )
}
