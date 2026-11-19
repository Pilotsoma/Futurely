import React from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'

interface ProgressRingProps {
  /** 0-100 */
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  children?: React.ReactNode
  /** Optional 2-stop gradient for the progress stroke — backward-compatible, unused callers unaffected */
  gradientColors?: readonly [string, string]
}

// Circular progress indicator built from react-native-svg's Circle (already a
// dependency used elsewhere for gradient fills) — no new library added.
export function ProgressRing({
  progress,
  size = 84,
  strokeWidth = 8,
  color = '#FFFFFF',
  trackColor = 'rgba(255,255,255,0.22)',
  children,
  gradientColors,
}: ProgressRingProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)
  // ponytail: fixed ID is safe — each <Svg> is an isolated SVG context in RN
  const strokeColor = gradientColors ? 'url(#pgGrad)' : color

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {gradientColors ? (
          <Defs>
            <LinearGradient id="pgGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradientColors[0]} stopOpacity="1" />
              <Stop offset="1" stopColor={gradientColors[1]} stopOpacity="1" />
            </LinearGradient>
          </Defs>
        ) : null}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  content: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
})
