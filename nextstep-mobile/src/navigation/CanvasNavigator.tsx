import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import CanvasConnectionsScreen from '../screens/CanvasConnectionsScreen'
import CanvasCoursesScreen from '../screens/CanvasCoursesScreen'
import CanvasCourseDetailScreen from '../screens/CanvasCourseDetailScreen'
import CanvasConnectScreen from '../screens/CanvasConnectScreen'

export type CanvasNavigatorParamList = {
  CanvasConnections: undefined
  CanvasCourses: { connectionId: number; instanceUrl: string; displayName: string }
  CanvasCourseDetail: { courseId: number; courseName: string; instanceUrl: string; connectionId: number }
  CanvasConnect: undefined
}

const Stack = createNativeStackNavigator<CanvasNavigatorParamList>()

export default function CanvasNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="CanvasConnections" component={CanvasConnectionsScreen} />
      <Stack.Screen name="CanvasCourses" component={CanvasCoursesScreen} />
      <Stack.Screen name="CanvasCourseDetail" component={CanvasCourseDetailScreen} />
      <Stack.Screen name="CanvasConnect" component={CanvasConnectScreen} />
    </Stack.Navigator>
  )
}
