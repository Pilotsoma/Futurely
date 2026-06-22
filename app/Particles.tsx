'use client'
import { useEffect, useRef } from 'react'

interface Props {
  particleColors?: string[]
  particleCount?: number
  particleSpread?: number
  speed?: number
  particleBaseSize?: number
  moveParticlesOnHover?: boolean
  alphaParticles?: boolean
  disableRotation?: boolean
  pixelRatio?: number
}

interface Star {
  x: number; y: number
  ox: number; oy: number
  vx: number; vy: number
  radius: number
  alpha: number
  twinklePhase: number
  twinkleFreq: number
  bright: boolean
  sprite: HTMLCanvasElement
  spikeLen: number
  color: string
}

// Pre-render a star sprite: bloom halo + bright core
function makeSprite(radius: number, color: string): HTMLCanvasElement {
  const sz = Math.ceil(radius * 24)
  const c = document.createElement('canvas')
  c.width = sz; c.height = sz
  const cx = sz / 2
  const ctx = c.getContext('2d')!

  // Parse hex color to rgb for gradient stops
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  // Outer bloom (large, very soft)
  const bloom = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
  bloom.addColorStop(0,   `rgba(${r},${g},${b},0.9)`)
  bloom.addColorStop(0.08,`rgba(${r},${g},${b},0.6)`)
  bloom.addColorStop(0.25,`rgba(${r},${g},${b},0.18)`)
  bloom.addColorStop(0.55,`rgba(${r},${g},${b},0.04)`)
  bloom.addColorStop(1,   `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, sz, sz)

  // Bright white core
  const core = ctx.createRadialGradient(cx, cx, 0, cx, cx, radius * 1.4)
  core.addColorStop(0,   'rgba(255,255,255,1)')
  core.addColorStop(0.4, 'rgba(255,255,255,0.9)')
  core.addColorStop(1,   'rgba(255,255,255,0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(cx, cx, radius * 1.4, 0, Math.PI * 2)
  ctx.fill()

  return c
}

const STAR_COLORS = [
  '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', // 40% pure white
  '#F0F6FF', '#F0F6FF', '#F0F6FF',            // 30% near-white blue tint
  '#B8D0FF', '#B8D0FF',                        // 20% blue-white
  '#FFE8C0',                                   // 10% warm yellow-white
]

export default function Particles({
  particleCount = 200,
  particleSpread = 10,
  speed = 0.1,
  particleBaseSize = 100,
  moveParticlesOnHover = false,
  alphaParticles = false,
  pixelRatio = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef  = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    let stars: Star[] = []

    function dims() {
      const p = canvas!.parentElement
      return { w: p?.offsetWidth ?? window.innerWidth, h: p?.offsetHeight ?? window.innerHeight }
    }

    function init() {
      const { w, h } = dims()
      const baseV = speed * particleSpread * 0.015

      // Sprite cache by size bucket
      const spriteCache = new Map<string, HTMLCanvasElement>()
      function getSprite(r: number, color: string) {
        const key = `${r.toFixed(1)}_${color}`
        if (!spriteCache.has(key)) spriteCache.set(key, makeSprite(r, color))
        return spriteCache.get(key)!
      }

      stars = Array.from({ length: particleCount }, () => {
        const x = Math.random() * w
        const y = Math.random() * h
        // Power-law size distribution: many small, few large
        const t = Math.random()
        const radius = particleBaseSize * 0.012 * (t < 0.7 ? 0.4 + t * 0.6 : 1.0 + (t - 0.7) * 5)
        const bright = radius > particleBaseSize * 0.022
        const color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
        const alpha = alphaParticles
          ? 0.3 + Math.random() * 0.7
          : bright ? 0.85 + Math.random() * 0.15 : 0.4 + Math.random() * 0.5
        return {
          x, y, ox: x, oy: y,
          vx: (Math.random() - 0.5) * baseV,
          vy: (Math.random() - 0.5) * baseV,
          radius,
          alpha,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleFreq: 0.4 + Math.random() * 1.2,
          bright,
          sprite: getSprite(radius, color),
          spikeLen: radius * 18,
          color,
        }
      })
    }

    function resize() {
      const { w, h } = dims()
      const dpr = pixelRatio > 0 ? pixelRatio : (window.devicePixelRatio || 1)
      canvas!.width  = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width  = w + 'px'
      canvas!.style.height = h + 'px'
      ctx!.scale(dpr, dpr)
      init()
    }

    function loop(time: number) {
      const { w, h } = dims()
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      const t = time / 1000
      const baseV = speed * particleSpread * 0.015

      for (const s of stars) {
        // Mouse repulsion
        if (moveParticlesOnHover) {
          const dx = s.x - mouseRef.current.x
          const dy = s.y - mouseRef.current.y
          const dist = Math.hypot(dx, dy)
          if (dist < 170 && dist > 0) {
            const f = ((170 - dist) / 170) * 0.22
            s.vx += (dx / dist) * f
            s.vy += (dy / dist) * f
          }
        }

        // Spring return to origin
        s.vx += (s.ox - s.x) * 0.004
        s.vy += (s.oy - s.y) * 0.004

        s.vx *= 0.93
        s.vy *= 0.93
        if (Math.abs(s.vx) < baseV * 0.15) s.vx += (Math.random() - 0.5) * baseV * 0.08
        if (Math.abs(s.vy) < baseV * 0.15) s.vy += (Math.random() - 0.5) * baseV * 0.08

        s.x += s.vx
        s.y += s.vy

        if (s.x < 0)  { s.x += w; s.ox += w }
        if (s.x > w)  { s.x -= w; s.ox -= w }
        if (s.y < 0)  { s.y += h; s.oy += h }
        if (s.y > h)  { s.y -= h; s.oy -= h }

        // Twinkling
        const twinkle = 0.75 + 0.25 * Math.sin(t * s.twinkleFreq + s.twinklePhase)
        const alpha = s.alpha * twinkle

        // Draw star sprite (bloom + core)
        const sw = s.sprite.width
        const sh = s.sprite.height
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.drawImage(s.sprite, s.x - sw / 2, s.y - sh / 2)
        ctx.restore()

        // Diffraction spikes for bright stars
        if (s.bright) {
          ctx.save()
          ctx.globalAlpha = alpha * 0.55
          const r = parseInt(s.color.slice(1,3),16)
          const g = parseInt(s.color.slice(3,5),16)
          const b = parseInt(s.color.slice(5,7),16)
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
          for (const [dx, dy] of dirs) {
            const grd = ctx.createLinearGradient(s.x, s.y, s.x + dx * s.spikeLen, s.y + dy * s.spikeLen)
            grd.addColorStop(0,   `rgba(255,255,255,0.9)`)
            grd.addColorStop(0.3, `rgba(${r},${g},${b},0.4)`)
            grd.addColorStop(1,   `rgba(${r},${g},${b},0)`)
            ctx.strokeStyle = grd
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(s.x, s.y)
            ctx.lineTo(s.x + dx * s.spikeLen, s.y + dy * s.spikeLen)
            ctx.stroke()
          }
          ctx.restore()
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    resize()
    rafId = requestAnimationFrame(loop)

    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function onMouseLeave() { mouseRef.current = { x: -9999, y: -9999 } }

    if (moveParticlesOnHover) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseleave', onMouseLeave)
    }

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
}
