import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  buildMonthGrid,
  longDate,
  type AttendanceDayModel,
  type AttendanceKind,
  type AttendanceMonth,
} from '../../../features/grades/portal/attendance'
import { colors, spacing, typography } from '../../../theme/tokens'
import { PortalCard } from './PortalCard'

interface AttendanceCalendarProps {
  month: AttendanceMonth
  /** The days that carry a status; every other day of the month is drawn plain. */
  marked: AttendanceDayModel[]
  /** The day number to ring when the month shown is the current one; null otherwise. */
  todayDay: number | null
  testID?: string
}

const KIND_LABEL: Record<AttendanceKind, string> = {
  absent: 'Absent',
  excused: 'Excused',
  tardy: 'Tardy',
  multiple: 'Multiple codes',
  closed: 'School closed',
  present: 'Present',
  other: 'Other',
}

const KIND_COLOR: Record<AttendanceKind, string> = {
  absent: colors.error,
  excused: colors.accentLight,
  tardy: colors.warning,
  multiple: colors.purple,
  closed: colors.textSecondary,
  present: colors.success,
  other: colors.accent2,
}

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
const LAST_COLUMN = WEEKDAY_HEADERS.length - 1

function WeekdayHeader(): React.JSX.Element {
  // Decoration only: the days that matter are announced by their own labels.
  return (
    <View style={styles.row} aria-hidden>
      {WEEKDAY_HEADERS.map((letter, column) => (
        <View key={column} style={styles.cell}>
          <Text style={styles.weekday}>{letter}</Text>
        </View>
      ))}
    </View>
  )
}

interface DayCellProps {
  day: number
  column: number
  entry: AttendanceDayModel | undefined
  isToday: boolean
  month: AttendanceMonth
}

function DayCell({ day, column, entry, isToday, month }: DayCellProps): React.JSX.Element {
  const weekend = column === 0 || column === LAST_COLUMN
  const box = (
    <View style={[styles.dayBox, isToday && styles.today]}>
      <Text style={[styles.dayNumber, weekend && styles.weekendNumber]}>{day}</Text>
      <View style={[styles.dot, entry !== undefined && { backgroundColor: KIND_COLOR[entry.kind] }]} />
    </View>
  )
  if (entry === undefined) {
    // An unmarked day has nothing to announce, so it stays out of the accessibility tree.
    return (
      <View style={styles.cell} accessible={false} aria-hidden>
        {box}
      </View>
    )
  }
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${longDate(month, day)}, ${entry.description}`}>
      {box}
    </View>
  )
}

function Legend({ kinds }: { kinds: AttendanceKind[] }): React.JSX.Element | null {
  if (kinds.length === 0) return null
  return (
    <View style={styles.legend}>
      {kinds.map((kind) => (
        <View key={kind} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: KIND_COLOR[kind] }]} />
          <Text style={styles.legendText}>{KIND_LABEL[kind]}</Text>
        </View>
      ))}
    </View>
  )
}

/** The kinds present this month, in the order the days appear. */
function presentKinds(marked: AttendanceDayModel[]): AttendanceKind[] {
  const kinds: AttendanceKind[] = []
  for (const entry of marked) if (!kinds.includes(entry.kind)) kinds.push(entry.kind)
  return kinds
}

// A month grid, Sunday first, with a dot under every day that carries an attendance status and a
// legend for only the dots that appear. Days are not tappable: the details are listed under it.
export function AttendanceCalendar({ month, marked, todayDay, testID }: AttendanceCalendarProps): React.JSX.Element {
  const byDay = new Map(marked.map((entry) => [entry.day, entry]))
  return (
    <PortalCard testID={testID}>
      <WeekdayHeader />
      {buildMonthGrid(month).map((week, weekIndex) => (
        <View key={weekIndex} style={styles.row}>
          {week.map((day, column) =>
            day === null ? (
              <View key={column} style={styles.cell} />
            ) : (
              <DayCell
                key={column}
                day={day}
                column={column}
                entry={byDay.get(day)}
                isToday={day === todayDay}
                month={month}
              />
            ),
          )}
        </View>
      ))}
      <Legend kinds={presentKinds(marked)} />
    </PortalCard>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center' },
  weekday: { ...typography.eyebrow, color: colors.textSecondary },
  dayBox: {
    width: 36,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  today: { borderColor: colors.primaryGlow },
  dayNumber: { ...typography.numeric, fontSize: 13, lineHeight: 16, color: colors.text },
  weekendNumber: { color: colors.textSecondary },
  // The dot slot is always 6pt high so numbers line up whether or not a day is marked.
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    marginTop: spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.bodySm, color: colors.textSecondary },
})
