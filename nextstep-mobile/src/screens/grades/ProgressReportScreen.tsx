import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../../components/ui/Screen'
import { PortalDataState } from '../../components/grades/PortalDataState'
import { GradeChip, PortalCard, PortalFallback, PortalRow } from '../../components/grades/portal'
import { isEmptyPortalData } from '../../components/ui/RawDataView'
import {
  parseProgressReport,
  type ProgressCourse,
  type ProgressReportModel,
} from '../../features/grades/portal/progressReport'
import { colors, spacing, typography } from '../../theme/tokens'

function CourseGrade({ course }: { course: ProgressCourse }): React.JSX.Element {
  const shown = course.grade.percent !== null ? `${course.grade.percent}%` : course.rawAverage
  return (
    <>
      {shown !== null ? <Text style={styles.percent}>{shown}</Text> : null}
      <GradeChip grade={course.grade} />
    </>
  )
}

function ProgressView({ model }: { model: ProgressReportModel }): React.JSX.Element {
  return (
    <PortalCard
      title="Current grades"
      meta={model.asOf !== null ? `As of ${model.asOf}` : undefined}
      testID="progress-report-card"
    >
      {model.courses.map((course, index) => (
        <PortalRow
          key={`${course.name}-${index}`}
          testID={`progress-course-${index}`}
          title={course.name}
          subtitle={course.subtitle ?? undefined}
          trailing={<CourseGrade course={course} />}
          isLast={index === model.courses.length - 1}
        />
      ))}
    </PortalCard>
  )
}

export default function ProgressReportScreen(): React.JSX.Element {
  const { data, loading, unsupported, error, reload } = usePortalFetch(() => gradesApi.getProgressReport())
  const content = data
  const model = useMemo(() => parseProgressReport(data), [data])

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PortalDataState
          loading={loading}
          unsupported={unsupported}
          error={error}
          onRetry={reload}
          feature="Progress report"
          isEmpty={isEmptyPortalData(content) || (model !== null && model.courses.length === 0)}
          emptyIcon="trending-up"
          emptyTitle="No progress report yet"
          emptyMessage="Progress reports appear here once your school posts interim grades."
        >
          {model ? <ProgressView model={model} /> : <PortalFallback data={content} />}
        </PortalDataState>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: SCROLL_BOTTOM_CLEARANCE },
  percent: { ...typography.numeric, fontSize: 17, lineHeight: 22, color: colors.text },
})
