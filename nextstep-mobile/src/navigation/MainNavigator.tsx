import React from 'react'
import { StyleSheet, View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
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

  // Adds a little extra clearance above Android's system navigation/gesture bar.
  const safeBottom = Math.max(insets.bottom, 8)
  const contentLift = 7

  return (
    <Tab.Navigator
      layout={({ state, navigation, children }) => (
        <AIContextProvider>
          <View style={styles.flex}>
            {children}
            <AIFab
              routeName={state.routes[state.index]?.name ?? ''}
              tabBarHeight={64 + safeBottom + contentLift}
              openChat={(params) => navigation.navigate('AIChat', params)}
            />
          </View>
        </AIContextProvider>
      )}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#C5AEFF',
        tabBarInactiveTintColor: '#8190A7',
        tabBarStyle: [
          styles.tabBar,
          {
            height: 64 + safeBottom + contentLift,
            paddingBottom: safeBottom + contentLift,
          },
        ],
        tabBarItemStyle: styles.tabItem,
        tabBarIconStyle: styles.tabIcon,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Today',
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
    backgroundColor: '#071522',
    borderTopWidth: 1,
    borderTopColor: 'rgba(102, 128, 165, 0.30)',
    paddingTop: 7,
    paddingHorizontal: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -5 },
    elevation: 18,
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
  },
  tabIcon: {
    marginTop: 0,
  },
  tabLabel: {
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
  },
  iconWrap: {
    width: 36,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryDim,
    borderColor: 'rgba(197, 174, 255, 0.28)',
  },
})
