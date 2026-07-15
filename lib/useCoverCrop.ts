'use client'

import { useEffect, useState } from 'react'

/** object-fit: cover crops a background image asymmetrically depending on how
 *  the viewport's aspect ratio compares to the image's — e.g. on a wider-than
 *  -image viewport it's cropped top/bottom (scaled to viewport width), and vice
 *  versa. Glow accents are authored as percentages of the *original* image, so
 *  this tracks how much has been cropped off each edge and remaps those
 *  percentages into the visible, on-screen coordinate space. */
export function useCoverCrop(imageAspect: number) {
  const [crop, setCrop] = useState({ xPct: 0, yPct: 0 })
  useEffect(() => {
    function update() {
      const w = window.innerWidth, h = window.innerHeight
      const viewportAspect = w / h
      if (viewportAspect > imageAspect) {
        const imgH = w / imageAspect
        setCrop({ xPct: 0, yPct: ((imgH - h) / 2 / imgH) * 100 })
      } else {
        const imgW = h * imageAspect
        setCrop({ xPct: ((imgW - w) / 2 / imgW) * 100, yPct: 0 })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [imageAspect])
  return crop
}

export function mapCoverPct(rawPct: number, cropPct: number) {
  return ((rawPct - cropPct) / (100 - 2 * cropPct)) * 100
}
