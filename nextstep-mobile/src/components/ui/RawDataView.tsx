import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts, spacing, typography } from '../../theme/tokens'
import { EmptyState } from './EmptyState'

// Several grades endpoints (attendance/schedule/report-card/progress-report/
// contact-teachers) return upstream-scraped, loosely-typed payloads — the
// backend itself types these as `unknown`. This renders them defensively as
// a generic key/value tree rather than pretending a stricter shape exists;
// approximate by design, same tradeoff the web app's own equivalents make.

interface RawDataViewProps {
  data: unknown
  depth?: number
}

const EMPTY_VALUE = '—'

function formatKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function isNumericLike(value: string): boolean {
  return /^-?\d+(\.\d+)?%?$/.test(value.trim())
}

/**
 * True when a portal payload has nothing to show: null / undefined, a blank
 * string, an empty array or object, or a structure whose descendants are all
 * empty (e.g. `{ rows: [], summary: {} }`). Numbers and booleans always count
 * as content. Screens check this and render their own EmptyState.
 */
export function isEmptyPortalData(data: unknown): boolean {
  if (data === null || data === undefined) return true
  if (typeof data === 'string') return data.trim().length === 0
  if (Array.isArray(data)) return data.every(isEmptyPortalData)
  if (typeof data === 'object') return Object.values(data as Record<string, unknown>).every(isEmptyPortalData)
  return false
}

export function RawDataView({ data, depth = 0 }: RawDataViewProps): React.JSX.Element {
  if (isEmptyPortalData(data)) {
    // Safety net only: callers are expected to check isEmptyPortalData first
    // and show a specific empty state with a reason and a Refresh action.
    if (depth === 0) return <EmptyState framed={false} title="Nothing to show yet" />
    return <Text style={styles.empty}>{EMPTY_VALUE}</Text>
  }

  if (Array.isArray(data)) {
    return (
      <View style={styles.group}>
        {data.map((item, i) => (
          <View key={i} style={styles.arrayItem}>
            <RawDataView data={item} depth={depth + 1} />
          </View>
        ))}
      </View>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>)
    return (
      <View style={styles.group}>
        {entries.map(([key, value]) => (
          <View key={key} style={styles.row}>
            <Text style={styles.label}>{formatKey(key)}</Text>
            {typeof value === 'object' && value !== null ? (
              <RawDataView data={value} depth={depth + 1} />
            ) : isEmptyPortalData(value) ? (
              <Text style={styles.empty}>{EMPTY_VALUE}</Text>
            ) : (
              <Text style={[styles.value, isNumericLike(String(value)) && styles.numericValue]}>
                {String(value)}
              </Text>
            )}
          </View>
        ))}
      </View>
    )
  }

  return <Text style={styles.value}>{String(data)}</Text>
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: { gap: spacing.xs },
  arrayItem: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary },
  value: { ...typography.body, color: colors.text },
  numericValue: { color: colors.primary, fontFamily: fonts.semiBold, fontWeight: '600' },
  empty: { ...typography.body, color: colors.textSecondary },
})
