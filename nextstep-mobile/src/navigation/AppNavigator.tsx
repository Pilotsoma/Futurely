/**
 * AppNavigator — root stack for the authenticated app.
 *
 * Structure:
 *   MainTabs     → MainTabNavigator (bottom tabs: Home / Grades / Planner / Colleges / AI / Settings)
 *   PortalConnect→ PortalConnectScreen (from Settings › School Portal)
 */

import React from 'react'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import MainTabNavigator, { type MainTabParamList } from './MainTabNavigator'
import PortalConnectScreen from '../screens/PortalConnectScreen'

export type AppParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>
  PortalConnect: undefined
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
    </Stack.Navigator>
  )
}
