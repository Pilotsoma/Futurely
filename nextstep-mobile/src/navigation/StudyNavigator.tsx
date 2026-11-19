import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import StudyHomeScreen from '../screens/study/StudyHomeScreen'
import StudyFeedScreen from '../screens/StudyFeedScreen'
import SetDetailScreen from '../screens/study/SetDetailScreen'
import SetEditScreen from '../screens/study/SetEditScreen'
import FlashcardsScreen from '../screens/study/FlashcardsScreen'
import PlayHubScreen from '../screens/study/PlayHubScreen'
import GameScreen from '../screens/study/GameScreen'
import { renderStackHeader } from '../components/ui/ScreenHeader'

export type StudyStackParamList = {
  StudyHome: undefined
  StudyFeed: undefined
  SetDetail: { setId: number }
  /** No setId = create a new set. */
  SetEdit: { setId?: number }
  Flashcards: { setId: number }
  PlayHub: undefined
  Game: { code: string }
}

const Stack = createNativeStackNavigator<StudyStackParamList>()

export default function StudyNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        // One JS header on every pushed screen: same look on iOS, Android and web,
        // and a back chevron even when the screen was opened by deep link.
        header: (props) => renderStackHeader(props, 'StudyHome'),
      }}
    >
      <Stack.Screen name="StudyHome" component={StudyHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StudyFeed" component={StudyFeedScreen} options={{ title: 'Study Feed' }} />
      <Stack.Screen name="SetDetail" component={SetDetailScreen} options={{ title: 'Study set' }} />
      <Stack.Screen
        name="SetEdit"
        component={SetEditScreen}
        options={({ route }) => ({ title: route.params?.setId ? 'Edit set' : 'New set' })}
      />
      <Stack.Screen name="Flashcards" component={FlashcardsScreen} options={{ title: 'Practice' }} />
      <Stack.Screen name="PlayHub" component={PlayHubScreen} options={{ title: 'Play' }} />
      <Stack.Screen name="Game" component={GameScreen} options={{ title: 'Game' }} />
    </Stack.Navigator>
  )
}
