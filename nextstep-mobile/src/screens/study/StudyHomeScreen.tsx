import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import type { StudyStackParamList } from '../../navigation/StudyNavigator'
import { colors, spacing, typography } from '../../theme/tokens'

// Placeholder hub — to be fleshed out.
export default function StudyHomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<StudyStackParamList, 'StudyHome'>>()

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <Text style={styles.title}>Study</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Study Feed"
        onPress={() => navigation.navigate('StudyFeed')}
      >
        <Card style={styles.row}>
          <Feather name="users" size={20} color={colors.text} />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Study Feed</Text>
            <Text style={styles.rowSub}>See what other students are sharing</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </Card>
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  rowText: { flex: 1 },
  rowTitle: { ...typography.h3, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
})
