import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import RoadmapScreen from '../screens/grades/RoadmapScreen'
import FutureHomeScreen from '../screens/future/FutureHomeScreen'
import CounselorChatScreen from '../screens/future/CounselorChatScreen'
import { colors, fonts } from '../theme/tokens'

export type FutureStackParamList = {
  FutureHome: { tab?: 'roadmap' | 'colleges' } | undefined
  Roadmap: undefined
  CounselorChat: undefined
}

const Stack = createNativeStackNavigator<FutureStackParamList>()

export default function FutureNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="FutureHome"
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semiBold, fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="FutureHome" component={FutureHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Roadmap" component={RoadmapScreen} options={{ title: 'Roadmap' }} />
      <Stack.Screen name="CounselorChat" component={CounselorChatScreen} options={{ title: 'My counselor' }} />
    </Stack.Navigator>
  )
}
