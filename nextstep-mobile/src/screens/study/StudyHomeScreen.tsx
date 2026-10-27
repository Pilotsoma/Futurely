import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ErrorRetryBlock } from '../../components/ui/ErrorRetryBlock'
import { errorMessage } from '../../components/study/util'
import { listSets, type QuestionSet } from '../../api/setsApi'
import type { StudyStackParamList } from '../../navigation/StudyNavigator'
import { colors, spacing, typography } from '../../theme/tokens'

interface HubRowProps {
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  subtitle: string
  onPress: () => void
}

function HubRow({ icon, title, subtitle, onPress }: HubRowProps): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      <Card style={styles.row}>
        <Feather name={icon} size={20} color={colors.text} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  )
}

export default function StudyHomeScreen(): React.JSX.Element {
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
          <Text style={styles.rowSub}>No sets yet. Tap "New set" to make your first one.</Text>
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
  content: { gap: spacing.ms, paddingBottom: spacing.massive },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  section: { ...typography.h2, color: colors.text, marginTop: spacing.sm },
  newBtn: { height: 40, minHeight: 40, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  rowText: { flex: 1 },
  rowTitle: { ...typography.h3, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
})
