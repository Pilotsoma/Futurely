import React, { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { PortalDataState } from '../../components/grades/PortalDataState'
import { GradeChip, PortalCard, PortalFallback, PortalRow } from '../../components/grades/portal'
import { isEmptyPortalData } from '../../components/ui/RawDataView'
import {
  parseReportCard,
  type ReportCardModel,
  type ReportCardRow,
  type ReportCardSection,
} from '../../features/grades/portal/reportCard'
import { colors, spacing, typography } from '../../theme/tokens'

const DEFAULT_EMPTY_MESSAGE = 'Report cards appear here after each grading period closes.'
const MIN_SWITCHER_SECTIONS = 2
const MAX_SWITCHER_SECTIONS = 3

function breakdownLine(row: ReportCardRow): string | undefined {
  if (row.breakdown.length === 0) return undefined
  return row.breakdown.map((item) => `${item.label} ${item.value}`).join(' · ')
}

function RowTrailing({ row }: { row: ReportCardRow }): React.JSX.Element {
  return (
    <View style={styles.trailing}>
      <View style={styles.gradeLine}>
        {row.grade.percent !== null ? <Text style={styles.percent}>{`${row.grade.percent}%`}</Text> : null}
        <GradeChip grade={row.grade} />
      </View>
      {row.creditsText !== null ? <Text style={styles.credits}>{row.creditsText}</Text> : null}
    </View>
  )
}

function SectionCard({ section }: { section: ReportCardSection }): React.JSX.Element {
  // Credits are only worth totalling once the section has grades; before that they are just the course's.
  const meta = section.hasGrades ? (section.creditsTotalText ?? undefined) : undefined
  return (
    <PortalCard title={section.label} meta={meta} testID="report-card-section">
      {section.hasGrades ? (
        section.rows.map((row, index) => (
          <PortalRow
            key={`${row.name}-${index}`}
            testID={`report-card-course-${index}`}
            title={row.name}
            subtitle={row.subtitle ?? undefined}
            caption={breakdownLine(row)}
            trailing={<RowTrailing row={row} />}
            isLast={index === section.rows.length - 1}
          />
        ))
      ) : (
        <Text style={styles.notPosted}>{`Grades for ${section.label} have not been posted yet.`}</Text>
      )}
    </PortalCard>
  )
}

function ReportCardView({ model }: { model: ReportCardModel }): React.JSX.Element {
  const { sections } = model
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const hasSwitcher = sections.length >= MIN_SWITCHER_SECTIONS && sections.length <= MAX_SWITCHER_SECTIONS
  if (!hasSwitcher) {
    // One section needs no switcher; four or more are shown stacked.
    return (
      <>
        {sections.map((section) => (
          <SectionCard key={section.label} section={section} />
        ))}
      </>
    )
  }
  const selected = sections.find((section) => section.label === selectedLabel) ?? sections[model.initialIndex]
  return (
    <>
      <SegmentedControl
        segments={sections.map((section) => section.label)}
        value={selected.label}
        onChange={setSelectedLabel}
      />
      <SectionCard section={selected} />
    </>
  )
}

export default function ReportCardScreen(): React.JSX.Element {
  const { data, loading, unsupported, error, reload } = usePortalFetch(() => gradesApi.getReportCard())
  const model = useMemo(() => parseReportCard(data), [data])

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PortalDataState
          loading={loading}
          unsupported={unsupported}
          error={error}
          onRetry={reload}
          feature="Report card"
          isEmpty={isEmptyPortalData(data) || (model !== null && model.sections.length === 0)}
          emptyIcon="clipboard"
          emptyTitle="No report card yet"
          emptyMessage={model?.portalMessage ?? DEFAULT_EMPTY_MESSAGE}
        >
          {model ? <ReportCardView model={model} /> : <PortalFallback data={data} />}
        </PortalDataState>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: SCROLL_BOTTOM_CLEARANCE },
  trailing: { alignItems: 'flex-end', gap: 2 },
  gradeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  percent: { ...typography.numeric, fontSize: 17, lineHeight: 22, color: colors.text },
  credits: { ...typography.bodySm, color: colors.textSecondary },
  notPosted: { ...typography.bodyMd, color: colors.textSecondary, paddingVertical: spacing.sm },
})
