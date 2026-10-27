import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import StudyHomeScreen from '../screens/study/StudyHomeScreen'
import StudyFeedScreen from '../screens/StudyFeedScreen'
import { colors, fonts } from '../theme/tokens'

export type StudyStackParamList = {
  StudyHome: undefined
  StudyFeed: undefined
}

const Stack = createNativeStackNavigator<StudyStackParamList>()

export default function StudyNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semiBold, fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="StudyHome" component={StudyHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StudyFeed" component={StudyFeedScreen} options={{ title: 'Study Feed' }} />
    </Stack.Navigator>
  )
}
