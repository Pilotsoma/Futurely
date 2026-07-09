import React from 'react'
import { StyleSheet, View } from 'react-native'
import Card from '../ui/Card'
import Text from '../ui/Text'
import { colors } from '../../constants/colors'
import { TrendUpIcon, TrendDownIcon, TrendNeutralIcon } from '../icons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeltaCardProps {
  currentGpa:            number | null
  projectedGpa:          number | null
  currentUnweightedGpa:  number | null
  projectedUnweightedGpa: number | null
  hasChanges:            boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gpaColor(value: number): string {
  if (value >= 3.5) return colors.primary
  if (value >= 3.0) return colors.info
  if (value >= 2.5) return colors.warning
  return colors.error
}

function deltaConfig(delta: number): { color: string; icon: React.ReactNode; sign: string } {
  if (delta > 0.005)  return { color: colors.success,   icon: <TrendUpIcon size={13} color={colors.success}/>,        sign: '+' }
  if (delta < -0.005) return { color: colors.error,     icon: <TrendDownIcon size={13} color={colors.error}/>,        sign: '' }
  return                     { color: colors.textMuted, icon: <TrendNeutralIcon size={13} color={colors.textMuted}/>, sign: '+' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeltaCard({
  currentGpa,
  projectedGpa,
  currentUnweightedGpa,
  projectedUnweightedGpa,
  hasChanges,
}: DeltaCardProps): React.JSX.Element {
  const currentColor   = currentGpa !== null ? gpaColor(currentGpa) : colors.textMuted
  const projectedColor = projectedGpa !== null && hasChanges ? gpaColor(projectedGpa) : colors.textMuted

  const delta = currentGpa !== null && projectedGpa !== null && hasChanges
    ? projectedGpa - currentGpa
    : null
  const dcfg = delta !== null ? deltaConfig(delta) : null

  const uwDelta = currentUnweightedGpa !== null && projectedUnweightedGpa !== null && hasChanges
    ? projectedUnweightedGpa - currentUnweightedGpa
    : null
  const uwDcfg = uwDelta !== null ? deltaConfig(uwDelta) : null

  return (
    <Card>
      {/* ── Row 1: Weighted GPA ── */}
      <View style={deltaStyles.row}>
        {/* Left column — current */}
        <View style={deltaStyles.col}>
          <Text variant="label" color={colors.textSecondary}>Current GPA</Text>
          <Text variant="display" color={currentColor} style={deltaStyles.gpaValue}>
            {currentGpa !== null ? currentGpa.toFixed(2) : '—'}
          </Text>
          <Text variant="caption" color={colors.textMuted}>Weighted</Text>
        </View>

        <View style={deltaStyles.vDivider} />

        {/* Right column — projected */}
        <View style={deltaStyles.col}>
          <Text variant="label" color={colors.textSecondary}>Projected GPA</Text>
          {hasChanges && projectedGpa !== null ? (
            <>
              <Text variant="display" color={projectedColor} style={deltaStyles.gpaValue}>
                {projectedGpa.toFixed(2)}
              </Text>
              {dcfg !== null && delta !== null && (
                <View
                  style={[deltaStyles.deltaPill, { backgroundColor: `${dcfg.color}1A` }]}
                  accessibilityLabel={`Weighted GPA change: ${dcfg.sign}${delta.toFixed(2)}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Text style={[deltaStyles.deltaPillText, { color: dcfg.color }]}>
                      {dcfg.sign}{delta.toFixed(2)}
                    </Text>
                    {dcfg.icon}
                  </View>
                </View>
              )}
            </>
          ) : (
            <Text variant="caption" color={colors.textMuted} style={deltaStyles.simulateHint}>
              Adjust a grade{'\n'}below to simulate
            </Text>
          )}
        </View>
      </View>

      {/* ── Row 2: Unweighted GPA ── */}
      {(currentUnweightedGpa !== null || projectedUnweightedGpa !== null) && (
        <>
          <View style={deltaStyles.hDivider} />
          <View style={deltaStyles.row}>
            <View style={deltaStyles.col}>
              <Text variant="caption" color={colors.textMuted}>Unweighted</Text>
              <Text
                variant="h3"
                color={currentUnweightedGpa !== null ? gpaColor(currentUnweightedGpa) : colors.textMuted}
                style={{ marginTop: 4 }}
              >
                {currentUnweightedGpa !== null ? currentUnweightedGpa.toFixed(2) : '—'}
              </Text>
            </View>

            <View style={deltaStyles.vDivider} />

            <View style={deltaStyles.col}>
              <Text variant="caption" color={colors.textMuted}>Projected Unwtd.</Text>
              {hasChanges && projectedUnweightedGpa !== null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text
                    variant="h3"
                    color={gpaColor(projectedUnweightedGpa)}
                  >
                    {projectedUnweightedGpa.toFixed(2)}
                  </Text>
                  {uwDcfg !== null && uwDelta !== null && (
                    <Text
                      style={[deltaStyles.uwDeltaText, { color: uwDcfg.color }]}
                      accessibilityLabel={`Unweighted GPA change: ${uwDcfg.sign}${uwDelta.toFixed(2)}`}
                    >
                      {uwDcfg.sign}{uwDelta.toFixed(2)}
                    </Text>
                  )}
                </View>
              ) : (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>—</Text>
              )}
            </View>
          </View>
        </>
      )}
    </Card>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const deltaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  col: {
    flex: 1,
  },
  gpaValue: {
    marginTop: 8,
    marginBottom: 8,
  },
  simulateHint: {
    marginTop: 12,
    lineHeight: 20,
  },
  vDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  hDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  deltaPill: {
    alignSelf: 'flex-start',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  deltaPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  uwDeltaText: {
    fontSize: 12,
    fontWeight: '600',
  },
})
