import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import CollegesScreen from '../screens/CollegesScreen'
import { colors, fonts } from '../theme/tokens'

export type FutureStackParamList = {
  Colleges: undefined
}

const Stack = createNativeStackNavigator<FutureStackParamList>()

export default function FutureNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semiBold, fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="Colleges" component={CollegesScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  )
}
