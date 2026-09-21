import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { NavigatorScreenParams } from '@react-navigation/native'
import MainNavigator from './MainNavigator'
import SettingsScreen from '../screens/SettingsScreen'
import CollegesScreen from '../screens/CollegesScreen'
import GpaSimulatorScreen from '../screens/grades/GpaSimulatorScreen'
import type { MainTabParamList } from './MainNavigator'
import { colors, fonts } from '../theme/tokens'

// ---------------------------------------------------------------------------
// Route param list — exported so nested screens can navigate up to this level
// via navigation.getParent<NativeStackNavigationProp<MainStackParamList>>()
// ---------------------------------------------------------------------------

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined
  Settings: undefined
  Colleges: undefined
  GpaSimulator: undefined
}

const Stack = createNativeStackNavigator<MainStackParamList>()

const PUSH_SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontFamily: fonts.semiBold,
    fontWeight: '600' as const,
  },
  headerShadowVisible: false,
} as const

// ---------------------------------------------------------------------------
// MainStack — outer native-stack. The first screen (MainTabs) renders the
// floating-tab navigator; Settings, Colleges, and GpaSimulator are pushed on
// top of it (no tab bar visible) and gain a back arrow automatically.
// ---------------------------------------------------------------------------

export default function MainStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainNavigator} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ ...PUSH_SCREEN_OPTIONS, headerShown: true, title: 'Settings' }}
      />
      <Stack.Screen
        name="Colleges"
        component={CollegesScreen}
        options={{ ...PUSH_SCREEN_OPTIONS, headerShown: true, title: 'Colleges' }}
      />
      <Stack.Screen
        name="GpaSimulator"
        component={GpaSimulatorScreen}
        options={{ ...PUSH_SCREEN_OPTIONS, headerShown: true, title: 'What-If Calculator' }}
      />
    </Stack.Navigator>
  )
}
