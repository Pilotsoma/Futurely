/**
 * AppNavigator — root stack for the authenticated app.
 *
 * Structure:
 *   MainTabs     → MainTabNavigator (bottom tabs: Home / Grades / Planner / Colleges / Settings)
 *   PortalConnect→ PortalConnectScreen (from Settings › School Portal)
 *   AIChat       → MainAIScreen     (from AI entry point on Dashboard)
 */

import React from 'react'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MainTabNavigator, { type MainTabParamList } from './MainTabNavigator'
import PortalConnectScreen from '../screens/PortalConnectScreen'
import MainAIScreen from '../screens/MainAIScreen'

export type AppParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>
  PortalConnect: undefined
  AIChat: undefined
}

const Stack = createNativeStackNavigator<AppParamList>()

export default function AppNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="PortalConnect"
        component={PortalConnectScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AIChat"
        component={MainAIScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  )
}
