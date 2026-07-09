import React from 'react'
import { Image } from 'react-native'

interface Props {
  size?: number
}

// Source aspect ratio (width / height) of assets/futurely-logo.png — the
// graduation-cap-over-"F" mark also used on web (public/logo.png). `size`
// controls the rendered height; width is derived to preserve the ratio.
const LOGO_ASPECT_RATIO = 426 / 512

export default function FuturelyLogo({ size = 40 }: Props): React.JSX.Element {
  return (
    <Image
      source={require('../../../assets/futurely-logo.png')}
      style={{ width: Math.round(size * LOGO_ASPECT_RATIO), height: size }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="myFuturely logo"
    />
  )
}
