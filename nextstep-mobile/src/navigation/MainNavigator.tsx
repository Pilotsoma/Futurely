import React from 'react'
import { StyleSheet, View } from 'react-native'
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
import { colors } from '../theme/tokens'
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

  // Floating pill tab bar sits above the device's safe-area bottom, with a
  // small additional offset so it clears gesture handles.
  const tabBarBottom = Math.max(insets.bottom, 12) + 8

  return (
    <Tab.Navigator
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
        tabBarShowLabel: false,
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
              <Feather name="home" size={22} color={color} />
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
              <Feather name="bar-chart-2" size={22} color={color} />
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
              <Feather name="calendar" size={22} color={color} />
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
              <Feather name="book-open" size={22} color={color} />
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
              <Feather name="compass" size={22} color={color} />
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
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(13,24,41,0.92)',
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
    // Center icons vertically within the 64pt bar.
    // react-navigation bottom-tabs adds default label padding; override all of it.
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    // Eliminate any top offset react-navigation bottom-tabs injects when labels are hidden.
    width: 44,
    height: 44,
    marginTop: 0,
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primaryDim,
  },
})
