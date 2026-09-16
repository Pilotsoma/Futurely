'use client'

import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

export default function Reveal({
  children, delay = 0, y = 32, style,
}: {
  children: React.ReactNode; delay?: number; y?: number; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} style={style}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.75, ease: [0.19, 1, 0.22, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
