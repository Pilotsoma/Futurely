import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useDisplayPreferences } from '../../../preferences/displayPreferences'
import type { GradeDisplay } from '../../../features/grades/portal/shared'
import { colors, fonts } from '../../../theme/tokens'

interface GradeChipProps {
  grade: GradeDisplay
  size?: 'sm' | 'md'
}

const DIMENSION = { sm: 28, md: 32 } as const

// The rounded-square letter chip from the Grades hub. The colour follows the
// student's grade colour preference; letters the portal sent that are not
// A to F ("P", "I") stay neutral.
export function GradeChip({ grade, size = 'sm' }: GradeChipProps): React.JSX.Element | null {
  const { gradeColors } = useDisplayPreferences()
  if (grade.label === null) return null
  const color = grade.letter === null ? colors.textSecondary : gradeColors[grade.letter]
  return (
    <View
      accessibilityLabel={`Grade ${grade.label}`}
      style={[
        styles.chip,
        { minWidth: DIMENSION[size], height: DIMENSION[size], borderColor: `${color}66`, backgroundColor: `${color}18` },
      ]}
    >
      <Text style={[styles.text, { color }]}>{grade.label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  text: { fontFamily: fonts.jakartaBold, fontWeight: '700', fontSize: 13 },
})
