import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { CommonActions } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import DashboardScreen from '../screens/DashboardScreen'
import GradesNavigator from './GradesNavigator'
import PlannerScreen from '../screens/PlannerScreen'
import RoadmapScreen from '../screens/grades/RoadmapScreen'
import AIChatScreen from '../screens/AIChatScreen'
import StudyFeedScreen from '../screens/StudyFeedScreen'
import type { GradesStackParamList } from './GradesNavigator'
// import type only — avoids a runtime circular dependency since MainStack imports
// MainNavigator at runtime, but we only need MainStackParamList as a type here.
import type { MainStackParamList } from './MainStack'
import { FloatingTabBar, type FloatingTabBarItem, type FloatingTabBarProps } from '../components/ui/FloatingTabBar'
import {
  GridIcon,
  BarChartIcon,
  CalendarIcon,
  MapIcon,
  RobotIcon,
  SettingsIcon,
} from '../components/icons'

// ---------------------------------------------------------------------------
// Route param list
// ---------------------------------------------------------------------------

export type MainTabParamList = {
  Dashboard: undefined
  Grades: NavigatorScreenParams<GradesStackParamList> | undefined
  Planner: { assignmentId?: number } | undefined
  Roadmap: undefined
  AIChat: { initialPrompt?: string; requestId?: number } | undefined
  StudyFeed: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

// ---------------------------------------------------------------------------
// Tab bar configuration maps
// ---------------------------------------------------------------------------

// Routes that should never appear in the floating tab bar.
const HIDDEN_ROUTES = new Set<string>(['StudyFeed'])

// Display label for each tab route key. Dashboard → "Home", AIChat → "Chat"
// keeps deep-link route keys stable while showing the design-approved labels.
const TAB_LABELS: Record<string, string> = {
  Dashboard: 'Home',
  Grades: 'Grades',
  Planner: 'Planner',
  Roadmap: 'Roadmap',
  AIChat: 'Chat',
}

// Icon render function for each tab route key.
const TAB_ICONS: Record<string, (p: { color: string; size: number }) => React.ReactNode> = {
  Dashboard: (p) => <GridIcon color={p.color} size={p.size} />,
  Grades: (p) => <BarChartIcon color={p.color} size={p.size} />,
  Planner: (p) => <CalendarIcon color={p.color} size={p.size} />,
  Roadmap: (p) => <MapIcon color={p.color} size={p.size} />,
  AIChat: (p) => <RobotIcon color={p.color} size={p.size} />,
}

const SETTINGS_ICON = (p: { color: string; size: number }): React.ReactNode => (
  <SettingsIcon color={p.color} size={p.size} />
)

// ---------------------------------------------------------------------------
// FloatingTabBar adapter
//
// Maps React Navigation's BottomTabBarProps into FloatingTabBar's declarative
// items/settingsItem shape. Defined outside MainNavigator so the function
// reference is stable across renders (no new component created each render).
// ---------------------------------------------------------------------------

function TabBarAdapter({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const items: FloatingTabBarItem[] = state.routes
    .filter((route) => !HIDDEN_ROUTES.has(route.name))
    .map((route) => {
      const isActive = state.routes[state.index].key === route.key
      const label = TAB_LABELS[route.name] ?? route.name
      const icon = TAB_ICONS[route.name] ?? TAB_ICONS['Dashboard']

      return {
        key: route.key,
        label,
        icon,
        active: isActive,
        onPress: () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isActive && !event.defaultPrevented) {
            navigation.dispatch(
              CommonActions.navigate({ name: route.name, merge: true }),
            )
          }
        },
        accessibilityLabel: label,
      }
    })

  const settingsItem: FloatingTabBarProps['settingsItem'] = {
    icon: SETTINGS_ICON,
    // Navigate up to the outer MainStack to push Settings (no tab bar visible).
    onPress: () => {
      navigation
        .getParent<NativeStackNavigationProp<MainStackParamList>>()
        ?.navigate('Settings')
    },
    accessibilityLabel: 'Settings',
  }

  return <FloatingTabBar items={items} settingsItem={settingsItem} />
}

// ---------------------------------------------------------------------------
// MainNavigator — inner 5-tab bottom-tab navigator.
// Tab order: Dashboard, Grades, Planner, Roadmap, AIChat.
// StudyFeed is registered but filtered out of the tab bar by TabBarAdapter.
// ---------------------------------------------------------------------------

export default function MainNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={TabBarAdapter}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Grades" component={GradesNavigator} />
      <Tab.Screen name="Planner" component={PlannerScreen} />
      <Tab.Screen name="Roadmap" component={RoadmapScreen} />
      <Tab.Screen name="AIChat" component={AIChatScreen} />
      <Tab.Screen name="StudyFeed" component={StudyFeedScreen} />
    </Tab.Navigator>
  )
}
