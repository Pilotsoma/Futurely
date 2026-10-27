import React, { useCallback, useState } from 'react'
import { useAIContext } from '../../components/ai/AIContext'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { Screen } from '../../components/ui/Screen'
import { Card } from '../../components/ui/Card'
import * as collegesApi from '../../api/collegesApi'
import * as counselorApi from '../../api/counselorApi'
import { countUnread } from '../../components/future/chatUtils'
import { loadLastSeenId } from '../../components/future/chatSeen'
import type { FutureStackParamList } from '../../navigation/FutureNavigator'
import { colors, spacing, typography } from '../../theme/tokens'

interface HubState {
  collegeCount: number | null
  counselorName: string | null
  hasCounselor: boolean | null
  unread: number
}

// The colleges API (CollegeListItem) exposes no deadline field, so there is
// deliberately no "Upcoming deadlines" card here.
export default function FutureHomeScreen(): React.JSX.Element {
  useAIContext('My future', 'Based on my grades, what colleges and next steps should I focus on?')
  const navigation = useNavigation<NativeStackNavigationProp<FutureStackParamList, 'FutureHome'>>()
  const [state, setState] = useState<HubState>({
    collegeCount: null,
    counselorName: null,
    hasCounselor: null,
    unread: 0,
  })

  useFocusEffect(
    useCallback(() => {
      let active = true
      void (async () => {
        const [colleges, links] = await Promise.all([
          collegesApi.listSavedColleges().catch(() => null),
          counselorApi.listActiveCounselorLinks().catch(() => null),
        ])
        let unread = 0
        const link = links?.[0]
        if (link) {
          const [page, lastSeen] = await Promise.all([
            counselorApi.getCounselorChat(link.counselorId).catch(() => null),
            loadLastSeenId(link.counselorId),
          ])
          if (page) unread = countUnread(page.messages, link.counselorId, lastSeen)
        }
        if (!active) return
        setState({
          collegeCount: colleges ? colleges.length : null,
          counselorName: link ? (link.counselor.name ?? link.counselor.email) : null,
          hasCounselor: links ? links.length > 0 : null,
          unread,
        })
      })()
      return () => {
        active = false
      }
    }, []),
  )

  const collegeSub =
    state.collegeCount === null
      ? 'Track and compare schools'
      : state.collegeCount === 0
        ? 'Add schools to start your list'
        : `${state.collegeCount} ${state.collegeCount === 1 ? 'college' : 'colleges'} saved`

  const counselorSub =
    state.hasCounselor === false
      ? 'No counselor linked yet'
      : (state.counselorName ?? 'Message your school counselor')

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Future</Text>
        <HubCard icon="award" title="My colleges" sub={collegeSub} onPress={() => navigation.navigate('Colleges')} />
        <HubCard icon="map" title="Roadmap" sub="Your plan for the next steps" onPress={() => navigation.navigate('Roadmap')} />
        <HubCard
          icon="message-circle"
          title="My counselor"
          sub={counselorSub}
          badge={state.unread}
          onPress={() => navigation.navigate('CounselorChat')}
        />
      </ScrollView>
    </Screen>
  )
}

function HubCard({
  icon,
  title,
  sub,
  badge,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  sub: string
  badge?: number
  onPress: () => void
}): React.JSX.Element {
  const unread = badge ?? 0
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${title}, ${unread} unread` : title}
      onPress={onPress}
    >
      <Card style={styles.row}>
        <Feather name={icon} size={20} color={colors.text} />
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{sub}</Text>
        </View>
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
        <Feather name="chevron-right" size={20} color={colors.textMuted} />
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.ms, paddingBottom: spacing.xl },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  rowText: { flex: 1 },
  rowTitle: { ...typography.h3, color: colors.text },
  rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.caption, color: colors.text, fontWeight: '600' },
})
