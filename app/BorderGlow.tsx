'use client'
import { useRef, useState, useCallback } from 'react'
import React from 'react'

interface Props {
  children: React.ReactNode
  edgeSensitivity?: number
  glowColor?: string
  backgroundColor?: string
  borderRadius?: number
  glowRadius?: number
  glowIntensity?: number
  coneSpread?: number
  animated?: boolean
  colors?: string[]
  style?: React.CSSProperties
}

export default function BorderGlow({
  children,
  glowColor = '40 80 80',
  backgroundColor = '#120F17',
  borderRadius = 20,
  glowRadius = 40,
  glowIntensity = 1,
  animated = false,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  style,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [bg, setBg] = useState(`rgb(${glowColor} / 0.25)`)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const stops = colors.map((c, i) => {
      const pct = Math.round((i / Math.max(colors.length - 1, 1)) * 80)
      return `${c} ${pct}%`
    }).join(', ')
    setBg(`radial-gradient(${glowRadius * 2.5}px circle at ${x}px ${y}px, ${stops}, transparent)`)
  }, [colors, glowRadius])

  const onMouseLeave = useCallback(() => {
    setBg(`rgb(${glowColor} / 0.25)`)
  }, [glowColor])

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'relative',
        borderRadius,
        padding: 1.5,
        background: bg,
        opacity: glowIntensity,
        transition: animated ? 'background 0.35s ease' : undefined,
        height: '100%',
        ...style,
      }}
    >
      <div style={{
        background: backgroundColor,
        borderRadius: borderRadius - 1,
        height: '100%',
      }}>
        {children}
      </div>
    </div>
  )
}
