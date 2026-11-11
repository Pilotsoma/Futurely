import React, { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { RoadmapPanel } from '../../components/future/RoadmapPanel'
import { CollegesPanel } from '../../components/future/CollegesPanel'
import * as counselorApi from '../../api/counselorApi'
import { countUnread } from '../../components/future/chatUtils'
import { loadLastSeenId } from '../../components/future/chatSeen'
import type { FutureStackParamList } from '../../navigation/FutureNavigator'
import type { MainTabParamList } from '../../navigation/MainNavigator'
import { colors, fonts, spacing, typography } from '../../theme/tokens'

type FutureHomeProps = NativeStackScreenProps<FutureStackParamList, 'FutureHome'>

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<FutureStackParamList, 'FutureHome'>,
  BottomTabNavigationProp<MainTabParamList>
>

const SEGMENTS = ['Roadmap', 'Colleges'] as const
type Segment = (typeof SEGMENTS)[number]

export default function FutureHomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>()
  const route = useRoute<FutureHomeProps['route']>()

  const initialTab: Segment =
    route.params?.tab === 'colleges' ? 'Colleges' : 'Roadmap'

  const [segment, setSegment] = useState<Segment>(initialTab)
  const [unread, setUnread] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let active = true
      void (async () => {
        const links = await counselorApi.listActiveCounselorLinks().catch(() => null)
        const link = links?.[0]
        if (!link) {
          if (active) setUnread(0)
          return
        }
        const [page, lastSeen] = await Promise.all([
          counselorApi.getCounselorChat(link.counselorId).catch(() => null),
          loadLastSeenId(link.counselorId),
        ])
        if (!active) return
        const count = page ? countUnread(page.messages, link.counselorId, lastSeen) : 0
        setUnread(count)
      })()
      return () => { active = false }
    }, []),
  )

  // Sync segment when navigated here with a tab param
  useFocusEffect(
    useCallback(() => {
      const tab = route.params?.tab
      if (tab === 'colleges') setSegment('Colleges')
      else if (tab === 'roadmap') setSegment('Roadmap')
    }, [route.params?.tab]),
  )

  const subtitle =
    segment === 'Roadmap'
      ? 'Your graduation & milestone plan'
      : 'Search and track the colleges you want'

  function openAIChat(): void {
    navigation.navigate('AIChat', {
      initialPrompt:
        'Based on my grades and college list, what should I focus on to reach my college and career goals?',
    })
  }

  function openCounselorChat(): void {
    navigation.navigate('CounselorChat')
  }

  return (
    <Screen edges={['top', 'left', 'right']} padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>My Future</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Ask AI pill */}
          <Pressable
            onPress={openAIChat}
            style={({ pressed }) => [styles.aiPill, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Ask AI about college and roadmap planning"
          >
            <Feather name="zap" size={13} color={colors.accentLight} />
            <Text style={styles.aiPillText}>Ask AI</Text>
          </Pressable>

          {/* Counselor chat icon */}
          <Pressable
            onPress={openCounselorChat}
            style={({ pressed }) => [styles.counselorButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={
              unread > 0 ? `Counselor chat, ${unread} unread messages` : 'Counselor chat'
            }
          >
            <Feather name="message-circle" size={20} color={colors.text} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Segmented control */}
      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={SEGMENTS}
          value={segment}
          onChange={setSegment}
        />
      </View>

      {/* Panel */}
      <View style={styles.panelWrap}>
        {segment === 'Roadmap' ? (
          <View style={styles.panelInner}>
            <RoadmapPanel />
          </View>
        ) : (
          <CollegesPanel />
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.ms,
    gap: spacing.sm,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  title: { ...typography.title, color: colors.text },
  subtitle: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: colors.primaryDim,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  aiPillText: {
    fontSize: 12,
    fontFamily: fonts.jakartaBold,
    fontWeight: '700',
    color: colors.accentLight,
  },
  counselorButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: { opacity: 0.8 },
  segmentWrap: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.ms,
  },
  panelWrap: { flex: 1 },
  panelInner: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
  },
})
