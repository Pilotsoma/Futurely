import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../../components/ui/Screen'
import { PortalDataState } from '../../components/grades/PortalDataState'
// These come straight from their files, not the portal barrel: the barrel also loads GradeChip and its
// preferences storage, which this screen does not use.
import { AttendanceCalendar } from '../../components/grades/portal/AttendanceCalendar'
import { PortalCard } from '../../components/grades/portal/PortalCard'
import { PortalFallback } from '../../components/grades/portal/PortalFallback'
import { PortalRow } from '../../components/grades/portal/PortalRow'
import { StatStrip } from '../../components/grades/portal/StatStrip'
import { isEmptyPortalData } from '../../components/ui/RawDataView'
import {
  monthForOffset,
  parseAttendance,
  weekdayAbbreviation,
  type AttendanceModel,
  type AttendanceMonth,
} from '../../features/grades/portal/attendance'
import { colors, spacing, touchTarget, typography } from '../../theme/tokens'

function monthName(monthOffset: number): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function DateTile({ month, day }: { month: AttendanceMonth; day: number }): React.JSX.Element {
  return (
    <View style={styles.dateTile}>
      <Text style={styles.dateWeekday}>{weekdayAbbreviation(month, day)}</Text>
      <Text style={styles.dateDay}>{day}</Text>
    </View>
  )
}

function summaryColor(count: number, color: string): string | undefined {
  return count > 0 ? color : undefined
}

interface AttendanceViewProps {
  model: AttendanceModel
  month: AttendanceMonth
  todayDay: number | null
}

function AttendanceView({ model, month, todayDay }: AttendanceViewProps): React.JSX.Element {
  // Present days only appear as a dot on the calendar; the list is for days that need a look.
  const details = model.marked.filter((entry) => entry.kind !== 'present')
  const { absences, excused, tardies } = model.counts
  return (
    <>
      <StatStrip
        testID="attendance-summary"
        items={[
          { value: String(absences), label: 'Absences', color: summaryColor(absences, colors.error) },
          { value: String(excused), label: 'Excused', color: summaryColor(excused, colors.accentLight) },
          { value: String(tardies), label: 'Tardies', color: summaryColor(tardies, colors.warning) },
        ]}
      />
      <AttendanceCalendar testID="attendance-calendar" month={month} marked={model.marked} todayDay={todayDay} />
      <PortalCard title="This month">
        {details.length === 0 ? (
          <Text style={styles.none}>No absences or tardies this month.</Text>
        ) : (
          details.map((entry, index) => (
            <PortalRow
              key={entry.day}
              leading={<DateTile month={month} day={entry.day} />}
              title={entry.description}
              subtitle={entry.periodsText ?? undefined}
              isLast={index === details.length - 1}
            />
          ))
        )}
      </PortalCard>
    </>
  )
}

export default function AttendanceScreen(): React.JSX.Element {
  const [monthOffset, setMonthOffset] = useState(0)
  const { data, loading, unsupported, error, reload } = usePortalFetch(
    () => gradesApi.getAttendance(monthOffset),
    [monthOffset],
  )
  const month = monthName(monthOffset)
  // The grid follows the month the student asked for, so it always agrees with the label above it.
  const gridMonth = useMemo(() => monthForOffset(monthOffset), [monthOffset])
  const model = useMemo(() => parseAttendance(data, gridMonth), [data, gridMonth])
  const todayDay = monthOffset === 0 ? new Date().getDate() : null
  // Attendance for a month that has not started yet does not exist.
  const atCurrentMonth = monthOffset >= 0

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => setMonthOffset((m) => m - 1)}
            style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Feather name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.monthLabel} numberOfLines={1} accessibilityLiveRegion="polite">
            {month}
          </Text>
          <Pressable
            onPress={() => setMonthOffset((m) => Math.min(0, m + 1))}
            disabled={atCurrentMonth}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.pressed,
              atCurrentMonth && styles.monthButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: atCurrentMonth }}
          >
            <Feather name="chevron-right" size={24} color={colors.text} />
          </Pressable>
        </View>

        <PortalDataState
          loading={loading}
          unsupported={unsupported}
          error={error}
          onRetry={reload}
          feature="Attendance"
          isEmpty={isEmptyPortalData(data) || (model !== null && model.marked.length === 0 && !model.hasCalendar)}
          emptyIcon="calendar"
          emptyTitle="No attendance records"
          emptyMessage={`Nothing has been posted for ${month}.`}
          skeletonRows={3}
        >
          {model ? <AttendanceView model={model} month={gridMonth} todayDay={todayDay} /> : <PortalFallback data={data} />}
        </PortalDataState>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: SCROLL_BOTTOM_CLEARANCE },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface1,
    flexShrink: 0,
  },
  monthButtonDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.75 },
  monthLabel: { ...typography.h3, color: colors.text, flex: 1, minWidth: 0, textAlign: 'center' },
  none: { ...typography.bodyMd, color: colors.textSecondary, paddingVertical: spacing.sm },
  dateTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateWeekday: { ...typography.bodySm, fontSize: 11, lineHeight: 13, color: colors.accentLight },
  dateDay: { ...typography.numeric, fontSize: 15, lineHeight: 18, color: colors.accentLight },
})
