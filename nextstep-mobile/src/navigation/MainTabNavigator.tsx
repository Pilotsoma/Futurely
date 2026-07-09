/**
 * MainTabNavigator — primary bottom tab bar for myFuturely mobile.
 *
 * Tabs: Home (Dashboard) · Grades (GradePortal) · Planner · Colleges · Settings
 *
 * Uses the custom SVG stroke icon system exclusively — no Ionicons.
 * Active state uses the brand gradient prop; inactive uses colors.textMuted.
 */

import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import DashboardScreen from '../screens/DashboardScreen'
import GradePortalNavigator from './GradePortalNavigator'
import PlanningNavigator from './PlanningNavigator'
import CollegeHelpNavigator from './CollegeHelpNavigator'
import SettingsScreen from '../screens/SettingsScreen'
import {
  GridIcon,
  SchoolBuildingIcon,
  CalendarIcon,
  GraduationCapIcon,
  SettingsIcon,
} from '../components/icons'
import type { IconProps } from '../components/icons'
import { colors } from '../constants/colors'

export type MainTabParamList = {
  Home: undefined
  Grades: undefined
  Planner: undefined
  Colleges: undefined
  Settings: undefined
}

type TabIconConfig = {
  component: React.FC<IconProps>
}

const TAB_ICONS: Record<keyof MainTabParamList, TabIconConfig> = {
  Home:    { component: GridIcon },
  Grades:  { component: SchoolBuildingIcon },
  Planner: { component: CalendarIcon },
  Colleges: { component: GraduationCapIcon },
  Settings: { component: SettingsIcon },
}

const Tab = createBottomTabNavigator<MainTabParamList>()

export default function MainTabNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.48,
          shadowRadius: 10,
          elevation: 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused, color }) => {
          const { component: Icon } = TAB_ICONS[route.name as keyof MainTabParamList]
          return <Icon size={22} color={focused ? colors.primary : color} gradient={focused} />
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Grades"
        component={GradePortalNavigator}
        options={{ tabBarLabel: 'Grades' }}
      />
      <Tab.Screen
        name="Planner"
        component={PlanningNavigator}
        options={{ tabBarLabel: 'Planner' }}
      />
      <Tab.Screen
        name="Colleges"
        component={CollegeHelpNavigator}
        options={{ tabBarLabel: 'Colleges' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  )
}
