import React, { useCallback, useState } from 'react'
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import {
  getPortalStatus,
  getPortalReportCard,
  type PortalReportCardCourse,
  type PortalReportCardResult,
} from '../api/portalApi'
import { LinkIcon } from '../components/icons'
import type { GradePortalParamList } from '../navigation/GradePortalNavigator'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SemesterSection {
  title: string
  data: PortalReportCardCourse[]
}

interface BadgeStyle {
  text: string
  bg: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADE_BADGE_STYLES: Record<string, BadgeStyle> = {
  A: { text: colors.success, bg: `${colors.success}26` },
  B: { text: colors.info,    bg: `${colors.info}26` },
  C: { text: colors.warning, bg: `${colors.warning}26` },
  D: { text: colors.orange,  bg: `${colors.orange}26` },
  F: { text: colors.error,   bg: `${colors.error}26` },
}

const FALLBACK_BADGE: BadgeStyle = { text: colors.textMuted, bg: colors.surface }

const SKELETON_ROW_COUNT = 6

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeBadge(letterGrade: string): BadgeStyle {
  return GRADE_BADGE_STYLES[letterGrade.charAt(0).toUpperCase()] ?? FALLBACK_BADGE
}

function buildSections(result: PortalReportCardResult): SemesterSection[] {
  const sections: SemesterSection[] = []
  if (result.semesters.sem1.length > 0) {
    sections.push({ title: 'Semester 1', data: result.semesters.sem1 })
  }
  if (result.semesters.sem2.length > 0) {
    sections.push({ title: 'Semester 2', data: result.semesters.sem2 })
  }
  return sections
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <Skeleton key={i} width="100%" height={60} style={{ marginBottom: 8, borderRadius: 8 }} />
      ))}
    </View>
  )
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function ErrorView({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={styles.stateText}>
        Unable to Load Report Card
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateText}>
        {message}
      </Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

function EmptyView({ message }: { message: string }): React.JSX.Element {
  return (
    <View style={styles.emptyState}>
      <Text variant="h3" style={[styles.stateText, { color: colors.textPrimary }]}>
        No Report Card Yet
      </Text>
      <Text variant="body" style={[styles.stateText, { color: colors.textSecondary }]}>
        {message}
      </Text>
    </View>
  )
}

function NotConnectedView({
  onConnect,
}: {
  onConnect: () => void
}): React.JSX.Element {
  return (
    <View style={styles.emptyState}>
      <LinkIcon size={40} color={colors.textSecondary} />
      <Text variant="h3" style={[styles.stateText, { color: colors.textPrimary, marginTop: 12 }]}>
        Connect Your School Portal
      </Text>
      <Text variant="body" style={[styles.stateText, { color: colors.textSecondary }]}>
        Link your HAC or PowerSchool account to see your official six-weeks grades.
      </Text>
      <TouchableOpacity
        style={styles.connectButton}
        onPress={onConnect}
        accessibilityRole="button"
        accessibilityLabel="Connect school portal"
      >
        <Text style={styles.connectButtonText}>Connect School Portal</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Course Row ───────────────────────────────────────────────────────────────

function CourseRow({ course }: { course: PortalReportCardCourse }): React.JSX.Element {
  const badge = course.letterGrade !== '' ? gradeBadge(course.letterGrade) : FALLBACK_BADGE
  const displayLetter = course.letterGrade !== '' ? course.letterGrade : '—'

  return (
    <View
      style={styles.courseRow}
      accessibilityRole="text"
      accessibilityLabel={`${course.name}, ${displayLetter}, ${course.credits} credits`}
    >
      <View style={styles.courseLeft}>
        <Text variant="h3" style={styles.courseName}>{course.name}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {course.teacher !== '' ? `${course.teacher} · ` : ''}
          {course.credits} cr
        </Text>
      </View>
      <View
        style={[styles.gradeBadge, { backgroundColor: badge.bg, borderColor: badge.text }]}
      >
        <Text style={[styles.gradeBadgeText, { color: badge.text }]}>
          {displayLetter}
        </Text>
      </View>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportCardScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<GradePortalParamList>>()

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [sections, setSections] = useState<SemesterSection[]>([])
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)

  const load = useCallback(async (refresh: boolean = false): Promise<void> => {
    if (refresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)
    setEmptyMessage(null)

    try {
      const status = await getPortalStatus()
      setIsConnected(status.connected)

      if (!status.connected) {
        setSections([])
        return
      }

      const result = await getPortalReportCard()
      const built = buildSections(result)

      if (built.length === 0) {
        setSections([])
        setEmptyMessage(
          result.message ?? 'No report card data is available for the current grading period.',
        )
      } else {
        setSections(built)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report card.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const handleRefresh = useCallback((): void => {
    void load(true)
  }, [load])

  if (isLoading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Report Card" />
        <LoadingSkeleton />
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Report Card" />
        <ErrorView message={error} onRetry={() => void load()} />
      </View>
    )
  }

  if (!isConnected) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Report Card" />
        <NotConnectedView onConnect={() => navigation.navigate('PortalConnect')} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Report Card" />
      <SectionList<PortalReportCardCourse, SemesterSection>
        sections={sections}
        keyExtractor={(item, index) => `${item.name}-${item.period}-${index}`}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text variant="h3">{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => <CourseRow course={item} />}
        ListEmptyComponent={
          emptyMessage !== null ? <EmptyView message={emptyMessage} /> : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skeletonContainer: {
    padding: 20,
  },
  sectionHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  courseLeft: {
    flex: 1,
    marginRight: 12,
  },
  courseName: {
    marginBottom: 4,
  },
  gradeBadge: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  stateText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 8,
  },
  connectButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
})
