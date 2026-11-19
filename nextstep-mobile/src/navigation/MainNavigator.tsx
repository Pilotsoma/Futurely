import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import DashboardScreen from '../screens/DashboardScreen'
import GradesNavigator from './GradesNavigator'
import PlannerScreen from '../screens/PlannerScreen'
import StudyNavigator from './StudyNavigator'
import FutureNavigator from './FutureNavigator'
import AIChatScreen from '../screens/AIChatScreen'
import SettingsScreen from '../screens/SettingsScreen'
import type { GradesStackParamList } from './GradesNavigator'
import type { StudyStackParamList } from './StudyNavigator'
import type { FutureStackParamList } from './FutureNavigator'
import { colors, fonts } from '../theme/tokens'
import { TAB_BAR_HEIGHT, TAB_BAR_LIFT, TAB_BAR_MIN_INSET } from '../components/ui/tabBarConstants'
import { AIContextProvider } from '../components/ai/AIContext'
import AIFab from '../components/ai/AIFab'

export type MainTabParamList = {
  Dashboard: undefined
  Grades: NavigatorScreenParams<GradesStackParamList> | undefined
  AIChat: { initialPrompt?: string; requestId?: number } | undefined
  Planner: { assignmentId?: number } | undefined
  Study: NavigatorScreenParams<StudyStackParamList> | undefined
  Future: NavigatorScreenParams<FutureStackParamList> | undefined
  Settings: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

function TabIcon({
  focused,
  children,
}: {
  focused: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>{children}</View>
}

// Custom label so the size cap applies: the bar is a fixed 64pt, so the label
// may grow a little with the OS text size but never enough to clip.
function TabLabel({ focused, children }: { focused: boolean; children: string }): React.JSX.Element {
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={1.2}
      style={[styles.tabLabel, focused && styles.tabLabelActive]}
    >
      {children}
    </Text>
  )
}

function hideFromTabBar() {
  return {
    tabBarButton: () => null,
    // Remove the hidden routes from the tab bar layout entirely.
    // Without this, React Navigation can reserve a seventh empty tab slot.
    tabBarItemStyle: { display: 'none' as const },
  }
}

export default function MainNavigator(): React.JSX.Element {
  const insets = useSafeAreaInsets()

  // Floating pill tab bar sits above the device's safe-area bottom, with a
  // small additional offset so it clears gesture handles.
  const tabBarBottom = Math.max(insets.bottom, TAB_BAR_MIN_INSET) + TAB_BAR_LIFT

  return (
    <Tab.Navigator
      // Settings and AI Chat are hidden tab routes with a back chevron; "history"
      // makes that chevron return to the tab the user came from.
      backBehavior="history"
      layout={({ state, navigation, children }) => (
        <AIContextProvider>
          <View style={styles.flex}>
            {children}
            <AIFab
              routeName={state.routes[state.index]?.name ?? ''}
              openChat={(params) => navigation.navigate('AIChat', params)}
            />
          </View>
        </AIContextProvider>
      )}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: ({ focused, children }) => <TabLabel focused={focused}>{children}</TabLabel>,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: [
          styles.tabBar,
          { bottom: tabBarBottom },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIcon,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Today',
          tabBarAccessibilityLabel: 'Today',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <Feather name="home" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />

      <Tab.Screen
        name="Grades"
        component={GradesNavigator}
        options={{
          title: 'Grades',
          tabBarAccessibilityLabel: 'Grades',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <Feather name="bar-chart-2" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />

      <Tab.Screen
        name="Planner"
        component={PlannerScreen}
        options={{
          title: 'Planner',
          tabBarAccessibilityLabel: 'Planner',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <Feather name="calendar" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />

      <Tab.Screen
        name="Study"
        component={StudyNavigator}
        options={{
          title: 'Study',
          tabBarAccessibilityLabel: 'Study',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <Feather name="book-open" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />

      <Tab.Screen
        name="Future"
        component={FutureNavigator}
        options={{
          title: 'Future',
          tabBarAccessibilityLabel: 'Future',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <Feather name="compass" size={20} color={color} />
            </TabIcon>
          ),
        }}
      />

      <Tab.Screen name="AIChat" component={AIChatScreen} options={hideFromTabBar()} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={hideFromTabBar()} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabBar: {
    // Floating pill: positioned absolutely, left/right margins create the pill shape.
    position: 'absolute',
    left: 20,
    right: 20,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    // A step above colors.bg (navy-black) at 97%: floats off the deeper base and is
    // opaque enough that scrolled text does not ghost through.
    backgroundColor: 'rgba(12,19,34,0.97)',
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    // Shadow
    elevation: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.40,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    // Icon pill + label, centred as a pair in the bar. The whole item is the
    // touch target (full bar height, one fifth of the bar wide).
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIcon: {
    width: 48,
    height: 28,
    marginTop: 0,
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Active tab = filled pill behind the icon + bolder, brighter label, so the
  // state never depends on colour alone.
  iconWrap: {
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryDim,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: fonts.medium,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    color: colors.text,
  },
})
