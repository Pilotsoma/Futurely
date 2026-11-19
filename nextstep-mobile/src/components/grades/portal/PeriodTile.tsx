import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, typography } from '../../../theme/tokens'

interface PeriodTileProps {
  /** The class period as the portal prints it ("1", "2A"). Longer than 3 characters is truncated. */
  label: string
}

const MAX_CHARS = 3

export function PeriodTile({ label }: PeriodTileProps): React.JSX.Element {
  return (
    <View style={styles.tile} accessibilityLabel={`Period ${label}`}>
      <Text style={styles.text} numberOfLines={1}>
        {label.slice(0, MAX_CHARS)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { ...typography.numericSm, fontSize: 15, lineHeight: 20, color: colors.accentLight },
})
