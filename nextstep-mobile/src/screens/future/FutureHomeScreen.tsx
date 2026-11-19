import React, { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { Feather } from '@expo/vector-icons'
import { Screen } from '../../components/ui/Screen'
import { ScreenHeader } from '../../components/ui/ScreenHeader'
import { useAIContext } from '../../components/ai/AIContext'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { RoadmapPanel } from '../../components/future/RoadmapPanel'
import { CollegesPanel } from '../../components/future/CollegesPanel'
import * as counselorApi from '../../api/counselorApi'
import { countUnread } from '../../components/future/chatUtils'
import { loadLastSeenId } from '../../components/future/chatSeen'
import type { FutureStackParamList } from '../../navigation/FutureNavigator'
import type { MainTabParamList } from '../../navigation/MainNavigator'
import { colors, fonts, spacing } from '../../theme/tokens'

type FutureHomeProps = NativeStackScreenProps<FutureStackParamList, 'FutureHome'>

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<FutureStackParamList, 'FutureHome'>,
  BottomTabNavigationProp<MainTabParamList>
>

const SEGMENTS = ['Roadmap', 'Colleges'] as const
type Segment = (typeof SEGMENTS)[number]

export default function FutureHomeScreen(): React.JSX.Element {
  // The floating AI button is the one AI entry point on this tab; this gives it the college prompt.
  useAIContext(
    'My Future',
    'Based on my grades and college list, what should I focus on to reach my college and career goals?',
  )
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

  function openCounselorChat(): void {
    navigation.navigate('CounselorChat')
  }

  return (
    <Screen edges={['top', 'left', 'right']} padded={false}>
      <ScreenHeader
        variant="root"
        title="My Future"
        padded
        right={
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
        }
      />

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
          <RoadmapPanel />
        ) : (
          <CollegesPanel />
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
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
    fontSize: 11,
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
})
