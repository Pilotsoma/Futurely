import React, { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { errorMessage } from '../../components/study/util'
import { createGame, joinGame } from '../../api/gamesApi'
import { listSets, type QuestionSet } from '../../api/setsApi'
import type { StudyStackParamList } from '../../navigation/StudyNavigator'
import { colors, spacing, typography } from '../../theme/tokens'

export default function PlayHubScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<StudyStackParamList, 'PlayHub'>>()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [sets, setSets] = useState<QuestionSet[] | null>(null)
  const [hostingId, setHostingId] = useState<number | null>(null)

  useFocusEffect(
    useCallback(() => {
      listSets({ mine: true })
        .then(setSets)
        .catch(() => setSets([]))
    }, []),
  )

  async function join(): Promise<void> {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) {
      setJoinError('Enter the game code from your host.')
      return
    }
    setJoining(true)
    setJoinError(null)
    try {
      const game = await joinGame(trimmed)
      navigation.navigate('Game', { code: game.joinCode })
    } catch (err) {
      setJoinError(errorMessage(err, 'Could not join that game.'))
    } finally {
      setJoining(false)
    }
  }

  async function host(set: QuestionSet): Promise<void> {
    setHostingId(set.id)
    try {
      const game = await createGame(set.id)
      navigation.navigate('Game', { code: game.joinCode })
    } catch (err) {
      Alert.alert('Could not host game', errorMessage(err))
    } finally {
      setHostingId(null)
    }
  }

  return (
    <Screen>
      <FlatList
        data={sets ?? []}
        keyExtractor={(s) => String(s.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Card style={styles.joinCard}>
              <Text style={styles.h}>Join a game</Text>
              <Input
                label="Game code"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                placeholder="ABC123"
                error={joinError ?? undefined}
              />
              <Button label="Join" onPress={() => void join()} loading={joining} />
            </Card>
            <Text style={styles.h}>Host a game from your sets</Text>
            {sets === null ? <ActivityIndicator color={colors.primary} /> : null}
            {sets !== null && sets.length === 0 ? (
              <Text style={styles.sub}>Create a study set first, then host it here.</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.setCard}>
            <View style={styles.setText}>
              <Text style={styles.setTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.sub}>{item._count?.questions ?? 0} questions</Text>
            </View>
            <Button
              label="Host"
              variant="secondary"
              disabled={(item._count?.questions ?? 0) === 0}
              loading={hostingId === item.id}
              onPress={() => void host(item)}
            />
          </Card>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingVertical: spacing.md, paddingBottom: spacing.massive },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  joinCard: { gap: spacing.md },
  h: { ...typography.h3, color: colors.text },
  sub: { ...typography.caption, color: colors.textSecondary },
  setCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  setText: { flex: 1 },
  setTitle: { ...typography.h3, color: colors.text },
})
