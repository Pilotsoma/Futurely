'use client'

import Particles from './Particles'
import { useReducedMotion } from './useReducedMotion'

export default function ParticlesLayer() {
  const reduceMotion = useReducedMotion()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      {reduceMotion ? (
        // Static star field — no JS animation, Chromebook-safe
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: 180 }, (_, i) => {
            const seed = i * 2654435761
            const x = ((seed >>> 0) % 10000) / 100
            const y = ((seed * 1234567) >>> 0) % 10000 / 100
            const r = 0.4 + ((seed * 987654) >>> 0) % 10 / 14
            const op = 0.25 + ((seed * 123456) >>> 0) % 10 / 17
            return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" fillOpacity={op} />
          })}
        </svg>
      ) : (
        <Particles
          particleColors={['#ffffff']}
          particleCount={350}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={100}
          moveParticlesOnHover
          alphaParticles={false}
          disableRotation={false}
          pixelRatio={1}
        />
      )}
    </div>
  )
}
