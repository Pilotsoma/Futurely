import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../../components/ui/Screen'
import { PortalDataState } from '../../components/grades/PortalDataState'
import { PeriodTile, PortalCard, PortalFallback, PortalRow } from '../../components/grades/portal'
import { isEmptyPortalData } from '../../components/ui/RawDataView'
import { parseSchedule, type ScheduleModel } from '../../features/grades/portal/schedule'
import { colors, fonts, spacing, typography } from '../../theme/tokens'

function ScheduleView({ model }: { model: ScheduleModel }): React.JSX.Element {
  return (
    <PortalCard testID="schedule-card">
      {model.rows.map((row, index) => (
        <PortalRow
          key={`${row.period ?? ''}-${row.course}-${index}`}
          testID={`schedule-row-${index}`}
          leading={row.period !== null ? <PeriodTile label={row.period} /> : undefined}
          title={row.course}
          subtitle={row.subtitle ?? undefined}
          trailing={
            row.room !== null ? (
              <Text style={styles.room} numberOfLines={1}>
                {row.room}
              </Text>
            ) : undefined
          }
          isLast={index === model.rows.length - 1}
        />
      ))}
    </PortalCard>
  )
}

export default function ScheduleScreen(): React.JSX.Element {
  const { data, loading, unsupported, error, reload } = usePortalFetch(() => gradesApi.getSchedule())
  const content = data?.schedule
  const model = useMemo(() => parseSchedule(data), [data])

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PortalDataState
          loading={loading}
          unsupported={unsupported}
          error={error}
          onRetry={reload}
          feature="Schedule"
          isEmpty={isEmptyPortalData(content)}
          emptyIcon="clock"
          emptyTitle="No schedule posted"
          emptyMessage="Your school hasn't published a schedule for this term."
        >
          {model ? <ScheduleView model={model} /> : <PortalFallback data={content} />}
        </PortalDataState>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: SCROLL_BOTTOM_CLEARANCE },
  room: {
    ...typography.bodySm,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.textSecondary,
    maxWidth: 96,
    textAlign: 'right',
  },
})
