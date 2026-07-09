import './global.css'
import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter'
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import { AuthProvider } from './src/context/AuthContext'
import { SchoolSessionProvider } from './src/context/SchoolSessionContext'
import RootNavigator from './src/navigation/RootNavigator'

// preventAutoHideAsync/hideAsync are no-ops on web (no native splash there).
void SplashScreen.preventAutoHideAsync().catch(() => { /* no-op on web */ })

export default function App(): React.JSX.Element | null {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    SpaceGrotesk_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => { /* no-op on web */ })
    }
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SchoolSessionProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SchoolSessionProvider>
    </GestureHandlerRootView>
  )
}
