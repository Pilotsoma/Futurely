import React, { useCallback, useState } from 'react'
import {
  SectionList,
  StyleSheet,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import { fetchStudentData, type CourseWithGrade, type StudentData } from '../api/studentApi'
import {
  getPortalStatus,
  getPortalTranscript,
  type PortalTranscriptResult,
} from '../api/portalApi'
import { shadows } from '../constants/shadows'

const GRADE_COLORS: Record<string, string> = {
  A: colors.success, B: colors.info, C: colors.warning, D: colors.orange, F: colors.error,
}

function gradeColor(letter: string): string {
  return GRADE_COLORS[letter.charAt(0).toUpperCase()] ?? colors.textMuted
}

function formatSemester(s: string): string {
  const [year, term] = s.split('-')
  if (!year || !term) return s
  if (term === 'FA') return `Fall ${year}`
  if (term === 'SP') return `Spring ${year}`
  if (term === 'SU') return `Summer ${year}`
  return s
}

function groupBySemester(courses: CourseWithGrade[]): { title: string; data: CourseWithGrade[] }[] {
  const map = new Map<string, CourseWithGrade[]>()
  for (const c of courses) {
    const sem = c.semester || 'Unknown'
    const arr = map.get(sem) ?? []
    arr.push(c)
    map.set(sem, arr)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([sem, data]) => ({ title: formatSemester(sem), data }))
}

// ── Portal transcript adapter ──────────────────────────────────────────────────

function numericToLetter(grade: string): string {
  const n = parseFloat(grade)
  if (n >= 90) return 'A'
  if (n >= 80) return 'B'
  if (n >= 70) return 'C'
  if (n >= 60) return 'D'
  return 'F'
}

function extractStartYear(yearStr: string): number {
  const match = yearStr.match(/^(\d{4})/)
  return match ? parseInt(match[1], 10) : 0
}

function adaptPortalTranscript(result: PortalTranscriptResult): CourseWithGrade[] {
  const courses: CourseWithGrade[] = []
  let id = 0
  for (const sem of result.transcript.semesters) {
    const startYear = extractStartYear(sem.year)
    // Semester "1" = fall (start year), "2" = spring (start year + 1)
    const termYear = sem.semester === '2' ? startYear + 1 : startYear
    const term = sem.semester === '2' ? 'SP' : 'FA'
    const semKey = `${termYear}-${term}`
    for (const c of sem.courses) {
      const letterGrade = numericToLetter(c.grade)
      const percentage = parseFloat(c.grade)
      courses.push({
        id: id++,
        name: c.name,
        teacher: '',
        period: 0,
        courseType: 'STANDARD',
        creditHours: parseFloat(c.credits),
        semester: semKey,
        grade: { letterGrade, percentage: isNaN(percentage) ? 0 : percentage },
      })
    }
  }
  return courses
}

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View style={{ padding: 20 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Skeleton key={i} width="100%" height={44} style={{ marginBottom: 8, borderRadius: 8 }} />
      ))}
    </View>
  )
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={styles.stateText}>Unable to Load Transcript</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateText}>{message}</Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

export default function TranscriptScreen(): React.JSX.Element {
  const [data, setData] = useState<StudentData | null>(null)
  const [portalTranscript, setPortalTranscript] = useState<PortalTranscriptResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    setPortalTranscript(null)
    try {
      const [d, status] = await Promise.all([
        fetchStudentData(),
        getPortalStatus().catch((): null => null),
      ])
      setData(d)
      if (status?.connected === true) {
        const result = await getPortalTranscript()
        setPortalTranscript(result)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transcript.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const courses: CourseWithGrade[] = portalTranscript !== null
    ? adaptPortalTranscript(portalTranscript)
    : (data?.courses ?? [])
  const sections = groupBySemester(courses)
  const totalCredits = portalTranscript !== null
    ? portalTranscript.transcript.semesters.reduce(
        (sum, sem) => sum + sem.courses.reduce((s, c) => s + parseFloat(c.credits), 0),
        0,
      )
    : courses.filter(c => c.grade !== null && c.grade.letterGrade !== 'F').length
  const uGpa = portalTranscript !== null
    ? portalTranscript.transcript.unweightedGPA
    : (data?.profile?.unweightedGpa ?? 0).toFixed(2)
  const wGpa = portalTranscript !== null
    ? portalTranscript.transcript.weightedGPA
    : (data?.profile?.weightedGpa ?? 0).toFixed(2)

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Transcript" />
      {isLoading ? (
        <LoadingSkeleton />
      ) : error !== null ? (
        <ErrorView message={error} onRetry={() => void load()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="h3">{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.courseRow}>
              <Text variant="body" style={{ flex: 1 }}>{item.name}</Text>
              {item.grade ? (
                <Text style={[styles.letterGrade, { color: gradeColor(item.grade.letterGrade) }]}>
                  {item.grade.letterGrade}
                </Text>
              ) : (
                <Text variant="caption">—</Text>
              )}
              <Text variant="caption" style={styles.credits}>1.0 cr</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: 8 }}>
                Cumulative GPA
              </Text>
              <View style={styles.gpaRow}>
                <Text variant="body">Unweighted: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{uGpa}</Text></Text>
                <Text variant="body" style={{ marginLeft: 16 }}>Weighted: <Text style={{ color: colors.primary, fontWeight: '700' }}>{wGpa}</Text></Text>
              </View>
              <Text variant="caption" style={{ marginTop: 8 }}>
                Total Credits Earned: {typeof totalCredits === 'number' && totalCredits % 1 !== 0
                  ? totalCredits.toFixed(1)
                  : totalCredits}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  stateText: { textAlign: 'center', marginBottom: 8 },
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  letterGrade: { fontSize: 14, fontWeight: '700', marginRight: 12 },
  credits: { minWidth: 44, textAlign: 'right' },
  footer: {
    ...shadows.raised,
    margin: 20,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  gpaRow: { flexDirection: 'row', flexWrap: 'wrap' },
})
