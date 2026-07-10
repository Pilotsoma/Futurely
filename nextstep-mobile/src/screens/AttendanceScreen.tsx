import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import {
  getPortalStatus,
  getPortalAttendance,
  type PortalStatus,
  type PortalAttendanceResult,
  type AttendanceDay,
} from '../api/portalApi'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, LinkIcon } from '../components/icons'
import type { GradePortalParamList } from '../navigation/GradePortalNavigator'

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEK_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_OFFSET_MIN = -12
const SKELETON_NOTABLE_COUNT = 3

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCalendarRows(year: number, monthIndex: number): (number | null)[][] {
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
}

interface DayBadge {
  letter: string
  color: string
  label: string
}

function getDayBadge(day: AttendanceDay): DayBadge | null {
  if (day.periods.length === 0) return null
  const statuses = day.periods.map(p => p.status.toLowerCase())
  const hasMultiple = day.periods.length > 1
  const hasAbsent = statuses.some(s => s.includes('absent') && !s.includes('excused'))
  const hasTardy = statuses.some(s => s.includes('tardy'))
  const hasExcused = statuses.some(s => s.includes('excused'))
  if (hasMultiple) return { letter: 'M', color: colors.info, label: 'Multiple' }
  if (hasAbsent) return { letter: 'A', color: colors.error, label: 'Absent' }
  if (hasTardy) return { letter: 'T', color: colors.warning, label: 'Tardy' }
  if (hasExcused) return { letter: 'E', color: colors.success, label: 'Excused' }
  return { letter: '!', color: colors.orange, label: 'Other' }
}

function getPeriodChipColor(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('absent') && !s.includes('excused')) return colors.error
  if (s.includes('tardy')) return colors.warning
  if (s.includes('excused')) return colors.success
  return colors.orange
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <ScrollView scrollEnabled={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.monthNavRow}>
        <Skeleton width={44} height={44} radius={22} />
        <Skeleton width={140} height={20} />
        <Skeleton width={44} height={44} radius={22} />
      </View>
      <View style={styles.summaryRow}>
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} width="23%" height={76} radius={10} />
        ))}
      </View>
      <View style={styles.calendarContainer}>
        <View style={styles.weekDayRow}>
          {WEEK_DAY_LABELS.map(d => (
            <Skeleton key={d} style={{ flex: 1, marginHorizontal: 2 }} height={14} />
          ))}
        </View>
        {[0, 1, 2, 3, 4].map(ri => (
          <View key={ri} style={styles.calendarWeekRow}>
            {[0, 1, 2, 3, 4, 5, 6].map(ci => (
              <Skeleton key={ci} style={{ flex: 1, margin: 2 }} height={44} radius={6} />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.notableSection}>
        <Skeleton width={180} height={12} style={{ marginBottom: 16 }} />
        {Array.from({ length: SKELETON_NOTABLE_COUNT }, (_, i) => (
          <View key={i} style={[styles.notableRow, { marginBottom: 10 }]}>
            <Skeleton width={64} height={14} style={{ marginRight: 12 }} />
            <Skeleton width="55%" height={14} />
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={styles.stateTitle}>Unable to Load Attendance</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>{message}</Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

function ConnectPortalPrompt({ onConnect }: { onConnect: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <LinkIcon size={40} color={colors.textSecondary} />
      <Text variant="h3" style={styles.stateTitle}>Connect Your School Portal</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        Link your HAC account to view your attendance record here.
      </Text>
      <Button label="Connect School Portal" onPress={onConnect} />
    </View>
  )
}

function HacOnlyView(): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <CalendarIcon size={40} color={colors.textSecondary} />
      <Text variant="h3" style={styles.stateTitle}>HAC Accounts Only</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        Attendance is only available for HAC-connected schools. Your connected portal does not support attendance data.
      </Text>
    </View>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }): React.JSX.Element {
  return (
    <View style={[styles.summaryCard, { borderColor: color + '50' }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text variant="caption" color={colors.textSecondary} style={styles.summaryLabel}>{label}</Text>
    </View>
  )
}

function CalendarCell({
  day,
  attendanceDay,
  isToday,
}: {
  day: number | null
  attendanceDay: AttendanceDay | undefined
  isToday: boolean
}): React.JSX.Element {
  const badge = attendanceDay !== undefined ? getDayBadge(attendanceDay) : null
  const isClosed = attendanceDay?.isSchoolClosed === true

  return (
    <View style={[styles.calendarCell, isToday && styles.calendarCellToday]}>
      {day !== null && (
        <>
          <Text
            style={[
              styles.calendarDayNum,
              isToday ? { color: colors.primary, fontWeight: '700' } : undefined,
              isClosed ? { color: colors.textMuted } : undefined,
            ]}
          >
            {day}
          </Text>
          {badge !== null && (
            <View
              style={[styles.dayBadge, { backgroundColor: badge.color + '25' }]}
              accessibilityLabel={`${badge.label} on day ${day}`}
            >
              <Text style={[styles.dayBadgeText, { color: badge.color }]}>{badge.letter}</Text>
            </View>
          )}
        </>
      )}
    </View>
  )
}

function NotableEventRow({ day }: { day: AttendanceDay }): React.JSX.Element {
  return (
    <View style={styles.notableRow}>
      <Text variant="h3" style={styles.notableDateText}>
        {day.dayOfWeek.slice(0, 3)} {day.dayNum}
      </Text>
      <View style={styles.notableChips}>
        {day.periods.map((period, i) => {
          const chipColor = getPeriodChipColor(period.status)
          return (
            <View
              key={i}
              style={[styles.periodChip, { backgroundColor: chipColor + '20', borderColor: chipColor + '50' }]}
            >
              <Text style={[styles.periodChipText, { color: chipColor }]}>
                P{period.period} · {period.status}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ── Legend item ───────────────────────────────────────────────────────────────

function LegendItem({ letter, label, color }: { letter: string; label: string; color: string }): React.JSX.Element {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} accessibilityLabel={label} />
      <Text variant="caption" color={colors.textSecondary}>{letter} — {label}</Text>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AttendanceScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<GradePortalParamList>>()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMonthLoading, setIsMonthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthNavError, setMonthNavError] = useState<string | null>(null)
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null)
  const [attendanceData, setAttendanceData] = useState<PortalAttendanceResult | null>(null)
  const [monthOffset, setMonthOffset] = useState(0)

  const load = useCallback(async (refresh = false): Promise<void> => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)
    setMonthNavError(null)
    try {
      const status = await getPortalStatus()
      setPortalStatus(status)
      if (status.connected && status.systemType === 'HAC') {
        const data = await getPortalAttendance(0)
        setAttendanceData(data)
        setMonthOffset(0)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const fetchMonth = useCallback(async (offset: number): Promise<void> => {
    setIsMonthLoading(true)
    setMonthNavError(null)
    try {
      const data = await getPortalAttendance(offset)
      setAttendanceData(data)
    } catch (e) {
      setMonthNavError(e instanceof Error ? e.message : 'Failed to load this month.')
    } finally {
      setIsMonthLoading(false)
    }
  }, [])

  const handlePrevMonth = useCallback((): void => {
    if (monthOffset <= MONTH_OFFSET_MIN || isMonthLoading) return
    const next = monthOffset - 1
    setMonthOffset(next)
    void fetchMonth(next)
  }, [monthOffset, isMonthLoading, fetchMonth])

  const handleNextMonth = useCallback((): void => {
    if (monthOffset >= 0 || isMonthLoading) return
    const next = monthOffset + 1
    setMonthOffset(next)
    void fetchMonth(next)
  }, [monthOffset, isMonthLoading, fetchMonth])

  useEffect(() => {
    void load()
  }, [load])

  const dayMap = useMemo<Record<number, AttendanceDay>>(() => {
    const map: Record<number, AttendanceDay> = {}
    if (attendanceData !== null) {
      for (const day of attendanceData.days) {
        map[day.dayNum] = day
      }
    }
    return map
  }, [attendanceData])

  const calendarRows = useMemo<(number | null)[][]>(() => {
    if (attendanceData === null) return []
    return buildCalendarRows(attendanceData.year, attendanceData.monthIndex)
  }, [attendanceData])

  const notableDays = useMemo<AttendanceDay[]>(() => {
    if (attendanceData === null) return []
    return attendanceData.days.filter(d => d.periods.length > 0).sort((a, b) => a.dayNum - b.dayNum)
  }, [attendanceData])

  const todayDayNum = useMemo<number | null>(() => {
    if (monthOffset !== 0 || attendanceData === null) return null
    const now = new Date()
    if (now.getMonth() !== attendanceData.monthIndex || now.getFullYear() !== attendanceData.year) return null
    return now.getDate()
  }, [monthOffset, attendanceData])

  const prevDisabled = monthOffset <= MONTH_OFFSET_MIN || isMonthLoading
  const nextDisabled = monthOffset >= 0 || isMonthLoading

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Attendance" />
        <LoadingSkeleton />
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Attendance" />
        <ErrorView message={error} onRetry={() => void load()} />
      </View>
    )
  }

  if (portalStatus === null || !portalStatus.connected) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Attendance" />
        <ConnectPortalPrompt onConnect={() => navigation.navigate('PortalConnect')} />
      </View>
    )
  }

  if (portalStatus.systemType !== 'HAC') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Attendance" />
        <HacOnlyView />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Attendance" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Month navigation */}
        <View style={styles.monthNavRow}>
          <TouchableOpacity
            style={[styles.monthNavBtn, prevDisabled && styles.monthNavBtnDisabled]}
            onPress={handlePrevMonth}
            disabled={prevDisabled}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            accessibilityState={{ disabled: prevDisabled }}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={20} color={prevDisabled ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
          <View style={styles.monthLabelContainer}>
            {isMonthLoading ? (
              <Skeleton width={140} height={20} />
            ) : (
              <Text variant="h3" style={styles.monthLabel}>
                {attendanceData?.month ?? ''} {attendanceData?.year ?? ''}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.monthNavBtn, nextDisabled && styles.monthNavBtnDisabled]}
            onPress={handleNextMonth}
            disabled={nextDisabled}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: nextDisabled }}
            activeOpacity={0.7}
          >
            <ChevronRightIcon size={20} color={nextDisabled ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Month navigation error */}
        {monthNavError !== null && (
          <View style={styles.inlineErrorBanner}>
            <Text variant="caption" color={colors.error}>{monthNavError}</Text>
          </View>
        )}

        {/* Summary stats */}
        {attendanceData !== null && (
          <View style={styles.summaryRow}>
            <SummaryCard label="Unexcused" value={attendanceData.summary.absences} color={colors.error} />
            <SummaryCard label="Tardies" value={attendanceData.summary.tardies} color={colors.warning} />
            <SummaryCard label="Excused" value={attendanceData.summary.excused} color={colors.success} />
            <SummaryCard label="Other" value={attendanceData.summary.multiple} color={colors.info} />
          </View>
        )}

        {/* Calendar grid */}
        <View style={styles.calendarContainer}>
          {/* Day-of-week header */}
          <View style={styles.weekDayRow}>
            {WEEK_DAY_LABELS.map(d => (
              <Text key={d} variant="caption" style={styles.weekDayLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar cells (skeleton while month loading) */}
          {isMonthLoading ? (
            <>
              {[0, 1, 2, 3, 4].map(ri => (
                <View key={ri} style={styles.calendarWeekRow}>
                  {[0, 1, 2, 3, 4, 5, 6].map(ci => (
                    <Skeleton key={ci} style={{ flex: 1, margin: 2 }} height={44} radius={6} />
                  ))}
                </View>
              ))}
            </>
          ) : (
            <>
              {calendarRows.map((week, wi) => (
                <View key={wi} style={styles.calendarWeekRow}>
                  {week.map((day, di) => (
                    <CalendarCell
                      key={di}
                      day={day}
                      attendanceDay={day !== null ? dayMap[day] : undefined}
                      isToday={day !== null && day === todayDayNum}
                    />
                  ))}
                </View>
              ))}
            </>
          )}

          {/* Legend */}
          <View style={styles.legendRow}>
            <LegendItem letter="A" label="Absent" color={colors.error} />
            <LegendItem letter="T" label="Tardy" color={colors.warning} />
            <LegendItem letter="E" label="Excused" color={colors.success} />
            <LegendItem letter="M" label="Multiple" color={colors.info} />
          </View>
        </View>

        {/* Notable events */}
        <View style={styles.notableSection}>
          <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>
            Notable Events This Month
          </Text>
          {isMonthLoading ? (
            <>
              {Array.from({ length: SKELETON_NOTABLE_COUNT }, (_, i) => (
                <View key={i} style={[styles.notableRow, { marginBottom: 10 }]}>
                  <Skeleton width={64} height={14} style={{ marginRight: 12 }} />
                  <Skeleton width="55%" height={14} />
                </View>
              ))}
            </>
          ) : notableDays.length === 0 ? (
            <Text
              variant="body"
              color={colors.textMuted}
              style={styles.emptyNotable}
            >
              No attendance events recorded this month.
            </Text>
          ) : (
            notableDays.map((day, i) => (
              <React.Fragment key={day.dayNum}>
                <NotableEventRow day={day} />
                {i < notableDays.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateTitle: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  stateMessage: {
    textAlign: 'center',
    marginBottom: 24,
  },
  // Month navigation
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthNavBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthNavBtnDisabled: {
    opacity: 0.4,
  },
  monthLabelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  monthLabel: {
    textAlign: 'center',
  },
  inlineErrorBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 10,
    backgroundColor: colors.error + '18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  // Summary stats
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  summaryLabel: {
    marginTop: 4,
    textAlign: 'center',
  },
  // Calendar
  calendarContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekDayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  calendarCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: colors.primary + '60',
    backgroundColor: colors.primary + '10',
  },
  calendarDayNum: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  dayBadge: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    minWidth: 14,
    alignItems: 'center',
  },
  dayBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Notable events
  notableSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    marginBottom: 14,
  },
  notableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    gap: 12,
    flexWrap: 'wrap',
  },
  notableDateText: {
    width: 64,
    flexShrink: 0,
  },
  notableChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  periodChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  emptyNotable: {
    textAlign: 'center',
    paddingVertical: 24,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
})
