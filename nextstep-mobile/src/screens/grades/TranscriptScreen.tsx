import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../../components/ui/Screen'
import { PortalDataState } from '../../components/grades/PortalDataState'
import { GradeChip, Pill, PortalCard, PortalFallback, PortalRow, StatStrip } from '../../components/grades/portal'
import { isEmptyPortalData } from '../../components/ui/RawDataView'
import { formatGpa } from '../../features/grades/academicSummary'
import {
  parseTranscript,
  type TranscriptModel,
  type TranscriptRow,
  type TranscriptSection,
  type TranscriptSummary,
} from '../../features/grades/portal/transcript'
import { useDisplayPreferences } from '../../preferences/displayPreferences'
import { colors, spacing, typography } from '../../theme/tokens'

interface StatItem {
  value: string
  label: string
}

// Unweighted first. Cumulative is only a stand-in when the portal sent neither of the other two.
function summaryItems(summary: TranscriptSummary, hideGpa: boolean): StatItem[] {
  const items: StatItem[] = []
  if (summary.unweighted !== null) items.push({ value: formatGpa(summary.unweighted, hideGpa), label: 'Unweighted' })
  if (summary.weighted !== null) items.push({ value: formatGpa(summary.weighted, hideGpa), label: 'Weighted' })
  if (summary.unweighted === null && summary.weighted === null && summary.cumulative !== null) {
    items.push({ value: formatGpa(summary.cumulative, hideGpa), label: 'Cumulative' })
  }
  // Class rank is as identifying as the GPA, so Hide GPA masks it too.
  if (summary.rankText !== null && !hideGpa) items.push({ value: summary.rankText, label: 'Class rank' })
  return items
}

function SummaryBlock({ summary }: { summary: TranscriptSummary }): React.JSX.Element | null {
  const { hideGpa } = useDisplayPreferences()
  const items = summaryItems(summary, hideGpa)
  const quartile = hideGpa ? null : summary.quartileText
  if (items.length === 0) return null
  return (
    <View style={styles.summary}>
      <StatStrip testID="transcript-summary" items={items} />
      {quartile !== null ? <Text style={styles.quartile}>{quartile}</Text> : null}
    </View>
  )
}

function TermPills({ terms }: { terms: TranscriptRow['terms'] }): React.JSX.Element | null {
  if (terms.length === 0) return null
  return (
    <View style={styles.pills}>
      {terms.map((term) => (
        <Pill key={term.label} label={`${term.label} ${term.value}`} />
      ))}
    </View>
  )
}

function hasTrailing(row: TranscriptRow): boolean {
  return row.creditsText !== null || row.grade.percent !== null || row.grade.label !== null
}

function RowTrailing({ row }: { row: TranscriptRow }): React.JSX.Element {
  const { creditsText, grade } = row
  return (
    <>
      {creditsText !== null ? <Text style={styles.credits}>{creditsText}</Text> : null}
      {grade.percent !== null ? <Text style={styles.percent}>{`${grade.percent}%`}</Text> : null}
      <GradeChip grade={grade} />
    </>
  )
}

function SectionCard({ section, index }: { section: TranscriptSection; index: number }): React.JSX.Element {
  return (
    <PortalCard
      title={section.title}
      meta={section.meta ?? undefined}
      testID={`transcript-section-${index}`}
    >
      {section.rows.map((row, rowIndex) => (
        <PortalRow
          key={`${row.name}-${rowIndex}`}
          title={row.name}
          trailing={hasTrailing(row) ? <RowTrailing row={row} /> : undefined}
          isLast={rowIndex === section.rows.length - 1}
        >
          <TermPills terms={row.terms} />
        </PortalRow>
      ))}
      {section.creditsTotalText !== null ? <Text style={styles.total}>{section.creditsTotalText}</Text> : null}
    </PortalCard>
  )
}

function TranscriptView({ model }: { model: TranscriptModel }): React.JSX.Element {
  return (
    <>
      {model.summary !== null ? <SummaryBlock summary={model.summary} /> : null}
      {model.sections.map((section, index) => (
        <SectionCard key={`${section.title}-${section.meta ?? ''}-${index}`} section={section} index={index} />
      ))}
    </>
  )
}

// Both HAC and PowerSchool support this endpoint, so it is never reported as unsupported.
export default function TranscriptScreen(): React.JSX.Element {
  const { data, loading, error, reload } = usePortalFetch(() => gradesApi.getTranscript())
  const content = data?.transcript
  const model = useMemo(() => parseTranscript(content), [content])

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PortalDataState
          loading={loading}
          unsupported={false}
          error={error}
          onRetry={reload}
          feature="Transcript"
          isEmpty={isEmptyPortalData(content)}
          emptyIcon="file-text"
          emptyTitle="No transcript yet"
          emptyMessage="Your transcript appears after your first completed semester."
        >
          {model ? <TranscriptView model={model} /> : <PortalFallback data={content} />}
        </PortalDataState>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: SCROLL_BOTTOM_CLEARANCE },
  summary: { gap: spacing.sm },
  quartile: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  credits: { ...typography.bodySm, color: colors.textSecondary },
  percent: { ...typography.numeric, fontSize: 17, lineHeight: 22, color: colors.text },
  total: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
})
