'use client'

import { motion, useScroll } from 'framer-motion'

export default function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  return (
    <motion.div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 200,
      background: 'var(--primary)',
      scaleX: scrollYProgress, transformOrigin: '0%',
      opacity: 0.8,
    }} />
  )
}
