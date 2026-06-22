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

interface Particle {
  x: number; y: number
  vx: number; vy: number
  radius: number
  color: string
  alpha: number
}

export default function Particles({
  particleColors = ['#ffffff'],
  particleCount = 200,
  particleSpread = 10,
  speed = 0.1,
  particleBaseSize = 100,
  moveParticlesOnHover = false,
  alphaParticles = false,
  pixelRatio = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    let particles: Particle[] = []

    function dims() {
      const parent = canvas!.parentElement
      return { w: parent?.offsetWidth ?? window.innerWidth, h: parent?.offsetHeight ?? window.innerHeight }
    }

    function init() {
      const { w, h } = dims()
      const baseV = speed * particleSpread * 0.015
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * baseV,
        vy: (Math.random() - 0.5) * baseV,
        radius: particleBaseSize * 0.025 * (0.5 + Math.random() * 1.0),
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        alpha: alphaParticles ? 0.2 + Math.random() * 0.8 : 0.5 + Math.random() * 0.5,
      }))
    }

    function resize() {
      const { w, h } = dims()
      canvas!.width = w * pixelRatio
      canvas!.height = h * pixelRatio
      canvas!.style.width = w + 'px'
      canvas!.style.height = h + 'px'
      ctx!.scale(pixelRatio, pixelRatio)
      init()
    }

    function loop() {
      const { w, h } = dims()
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      const baseV = speed * particleSpread * 0.015

      for (const p of particles) {
        if (moveParticlesOnHover) {
          const dx = p.x - mouseRef.current.x
          const dy = p.y - mouseRef.current.y
          const dist = Math.hypot(dx, dy)
          if (dist < 160 && dist > 0) {
            const f = ((160 - dist) / 160) * 0.25
            p.vx += (dx / dist) * f
            p.vy += (dy / dist) * f
          }
        }

        p.vx *= 0.98
        p.vy *= 0.98
        if (Math.abs(p.vx) < baseV * 0.2) p.vx += (Math.random() - 0.5) * baseV * 0.1
        if (Math.abs(p.vy) < baseV * 0.2) p.vy += (Math.random() - 0.5) * baseV * 0.1

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x += w
        if (p.x > w) p.x -= w
        if (p.y < 0) p.y += h
        if (p.y > h) p.y -= h

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      rafId = requestAnimationFrame(loop)
    }

    resize()
    loop()

    const ro = new ResizeObserver(resize)
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function onMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 }
    }
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

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  )
}
