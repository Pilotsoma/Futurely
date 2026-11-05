import React from 'react'
import { View } from 'react-native'
import Svg, { Polyline } from 'react-native-svg'

interface GpaSparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  testID?: string
}

const PADDING = 4

export function GpaSparkline({
  values,
  width = 120,
  height = 40,
  color = '#67E1BD',
  testID,
}: GpaSparklineProps): React.JSX.Element {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (width - PADDING * 2) / Math.max(values.length - 1, 1)
  const points = values
    .map((value, index) => {
      const x = PADDING + index * stepX
      const y = PADDING + (1 - (value - min) / range) * (height - PADDING * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <View testID={testID} accessibilityRole="image" accessibilityLabel="GPA trend">
      <Svg width={width} height={height}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}
