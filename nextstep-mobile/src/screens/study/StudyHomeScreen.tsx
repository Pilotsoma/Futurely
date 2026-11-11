import React, { useCallback, useState } from 'react'
import { useAIContext } from '../../components/ai/AIContext'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { Screen, FLOATING_TAB_CLEARANCE } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { errorMessage } from '../../components/study/util'
import { listSets, type QuestionSet } from '../../api/setsApi'
import type { StudyStackParamList } from '../../navigation/StudyNavigator'
import { colors, radii, spacing, typography } from '../../theme/tokens'

const HUB_ROW_ICON_COLORS: Record<string, { color: string; bg: string }> = {
  layers: { color: colors.primary, bg: colors.primaryDim },
  'play-circle': { color: '#10B981', bg: 'rgba(16,185,129,0.14)' },
  users: { color: colors.accent2, bg: 'rgba(0,229,255,0.12)' },
}

interface HubRowProps {
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  subtitle: string
  onPress: () => void
}

function HubRow({ icon, title, subtitle, onPress }: HubRowProps): React.JSX.Element {
  const palette = HUB_ROW_ICON_COLORS[icon as string] ?? { color: colors.textSecondary, bg: colors.surface2 }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.84, transform: [{ scale: 0.985 }] }]}
    >
      <Card style={styles.row}>
        <View style={[styles.rowIconTile, { backgroundColor: palette.bg }]}>
          <Feather name={icon} size={19} color={palette.color} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  )
}

export default function StudyHomeScreen(): React.JSX.Element {
  useAIContext('Study', 'Help me make a study plan for my next test.')
  const navigation = useNavigation<NativeStackNavigationProp<StudyStackParamList, 'StudyHome'>>()
  const [sets, setSets] = useState<QuestionSet[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSets(await listSets({ mine: true }))
    } catch (err) {
      setError(errorMessage(err, 'Could not load your study sets.'))
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Study</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.section}>My study sets</Text>
          <Button label="New set" onPress={() => navigation.navigate('SetEdit', {})} style={styles.newBtn} />
        </View>
        {error ? (
          <ErrorRetryBlock
            message={error}
            retrying={retrying}
            onRetry={() => {
              setRetrying(true)
              void load().finally(() => setRetrying(false))
            }}
          />
        ) : sets === null ? (
          <ActivityIndicator color={colors.primary} />
        ) : sets.length === 0 ? (
          <Text style={styles.rowSub}>No sets yet. Tap &quot;New set&quot; to make your first one.</Text>
        ) : (
          sets.map((s) => (
            <HubRow
              key={s.id}
              icon="layers"
              title={s.title}
              subtitle={[s.subject, `${s._count?.questions ?? 0} questions`].filter(Boolean).join(' · ')}
              onPress={() => navigation.navigate('SetDetail', { setId: s.id })}
            />
          ))
        )}

        <Text style={styles.section}>Play</Text>
        <HubRow
          icon="play-circle"
          title="Play a game"
          subtitle="Join with a code, or host one of your sets"
          onPress={() => navigation.navigate('PlayHub')}
        />

        <Text style={styles.section}>Community</Text>
        <HubRow
          icon="users"
          title="Study Feed"
          subtitle="See what other students are sharing"
          onPress={() => navigation.navigate('StudyFeed')}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.ms, paddingBottom: FLOATING_TAB_CLEARANCE },
  title: { ...typography.title, color: colors.text, marginBottom: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  section: { ...typography.h2, color: colors.text, marginTop: spacing.sm },
  newBtn: { height: 40, minHeight: 40, paddingHorizontal: spacing.md, borderRadius: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, paddingVertical: 4 },
  rowIconTile: { width: 42, height: 42, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { ...typography.h3, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
})
