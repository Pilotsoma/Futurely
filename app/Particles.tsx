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
  meteorMinMs?: number
  meteorMaxMs?: number
}

interface Star {
  x: number; y: number
  ox: number; oy: number
  vx: number; vy: number
  radius: number
  alpha: number
  color: string
  bright: boolean
  spikeLen: number
}

interface Meteor {
  x: number; y: number
  vx: number; vy: number
  life: number    // 0 → 1 (dead)
  alpha: number
  length: number  // trail length in px
}

const STAR_COLORS = [
  '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF',
  '#EEF4FF', '#EEF4FF', '#EEF4FF',
  '#C8DCFF', '#C8DCFF',
  '#FFF2DC',
]

export default function Particles({
  particleCount = 200,
  particleSpread = 10,
  speed = 0.1,
  particleBaseSize = 100,
  moveParticlesOnHover = false,
  alphaParticles = false,
  meteorMinMs = 5000,
  meteorMaxMs = 13000,
}: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const mouseRef   = useRef({ x: -9999, y: -9999 })
  const meteorRef  = useRef<Meteor | null>(null)
  const nextMeteor = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    let stars: Star[] = []
    const dpr = window.devicePixelRatio || 1

    function dims() {
      const p = canvas!.parentElement
      return { w: p?.offsetWidth ?? window.innerWidth, h: p?.offsetHeight ?? window.innerHeight }
    }

    function init() {
      const { w, h } = dims()
      const baseV = speed * particleSpread * 0.015
      stars = Array.from({ length: particleCount }, () => {
        const x = Math.random() * w
        const y = Math.random() * h
        const t = Math.pow(Math.random(), 2.5) // power-law: many small, few large
        const radius = particleBaseSize * 0.009 * (0.3 + t * 1.8)
        const bright = radius > particleBaseSize * 0.016
        const color  = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
        return {
          x, y, ox: x, oy: y,
          vx: (Math.random() - 0.5) * baseV,
          vy: (Math.random() - 0.5) * baseV,
          radius,
          alpha: alphaParticles
            ? 0.3 + Math.random() * 0.7
            : bright ? 0.9 + Math.random() * 0.1 : 0.35 + Math.random() * 0.55,
          color,
          bright,
          spikeLen: radius * 14,
        }
      })
    }

    function resize() {
      const { w, h } = dims()
      canvas!.width  = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width  = w + 'px'
      canvas!.style.height = h + 'px'
      ctx!.scale(dpr, dpr)
      init()
    }

    function spawnMeteor(w: number, h: number) {
      // Start from a random top or left edge, travel diagonally down-right
      const fromTop = Math.random() > 0.4
      const x = fromTop ? Math.random() * w * 0.7 : 0
      const y = fromTop ? 0 : Math.random() * h * 0.4
      const angle = (Math.PI / 5) + Math.random() * (Math.PI / 8) // ~36–58° from horizontal
      const spd = 380 + Math.random() * 240
      meteorRef.current = {
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        alpha: 0.9 + Math.random() * 0.1,
        length: 120 + Math.random() * 180,
      }
    }

    function drawMeteor(m: Meteor, dt: number, w: number, h: number) {
      // Decay life based on distance traveled
      m.x += m.vx * dt
      m.y += m.vy * dt
      m.life -= dt * 0.85  // takes ~1.2s to cross and fade

      if (m.life <= 0 || m.x > w + 50 || m.y > h + 50) {
        meteorRef.current = null
        return
      }

      const speed = Math.hypot(m.vx, m.vy)
      const nx = m.vx / speed
      const ny = m.vy / speed
      const tailX = m.x - nx * m.length * (1 - m.life * 0.3)
      const tailY = m.y - ny * m.length * (1 - m.life * 0.3)

      const alpha = m.alpha * Math.min(1, m.life * 3) // fade in quickly, fade out slowly

      // Trail gradient
      const grd = ctx!.createLinearGradient(tailX, tailY, m.x, m.y)
      grd.addColorStop(0,   'rgba(255,255,255,0)')
      grd.addColorStop(0.6, `rgba(210,230,255,${(alpha * 0.25).toFixed(3)})`)
      grd.addColorStop(1,   `rgba(255,255,255,${alpha.toFixed(3)})`)

      ctx!.save()
      ctx!.strokeStyle = grd
      ctx!.lineWidth = 1.5
      ctx!.lineCap = 'round'
      ctx!.beginPath()
      ctx!.moveTo(tailX, tailY)
      ctx!.lineTo(m.x, m.y)
      ctx!.stroke()

      // Bright head glow
      ctx!.shadowBlur = 10
      ctx!.shadowColor = '#ffffff'
      ctx!.globalAlpha = alpha
      ctx!.fillStyle = '#ffffff'
      ctx!.beginPath()
      ctx!.arc(m.x, m.y, 1.8, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.restore()
    }

    let lastTime = 0
    function loop(time: number) {
      const dt = Math.min((time - lastTime) / 1000, 0.05)
      lastTime = time
      const { w, h } = dims()
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      const baseV = speed * particleSpread * 0.015

      // Stars
      for (const s of stars) {
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

        // Spring return
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

        ctx.save()
        ctx.globalAlpha = s.alpha
        ctx.shadowBlur  = s.radius * 7
        ctx.shadowColor = s.color
        ctx.fillStyle   = '#ffffff'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
        ctx.fill()

        // Diffraction spikes for bright stars
        if (s.bright) {
          ctx.shadowBlur = 0
          ctx.globalAlpha = s.alpha * 0.45
          const dirs: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1]]
          for (const [dx, dy] of dirs) {
            const g = ctx.createLinearGradient(s.x, s.y, s.x + dx * s.spikeLen, s.y + dy * s.spikeLen)
            g.addColorStop(0,   'rgba(255,255,255,0.85)')
            g.addColorStop(0.4, `rgba(200,220,255,0.3)`)
            g.addColorStop(1,   'rgba(180,210,255,0)')
            ctx.strokeStyle = g
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(s.x, s.y)
            ctx.lineTo(s.x + dx * s.spikeLen, s.y + dy * s.spikeLen)
            ctx.stroke()
          }
        }
        ctx.restore()
      }

      // Shooting stars
      if (!meteorRef.current && time > nextMeteor.current) {
        spawnMeteor(w, h)
        nextMeteor.current = time + meteorMinMs + Math.random() * (meteorMaxMs - meteorMinMs)
      }
      if (meteorRef.current) drawMeteor(meteorRef.current, dt, w, h)

      rafId = requestAnimationFrame(loop)
    }

    resize()
    nextMeteor.current = 2000 + Math.random() * 4000
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
