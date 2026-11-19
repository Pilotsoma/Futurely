import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import GradesScreen from '../screens/GradesScreen'
import AttendanceScreen from '../screens/grades/AttendanceScreen'
import ClassworkScreen from '../screens/grades/ClassworkScreen'
import ContactTeachersScreen from '../screens/grades/ContactTeachersScreen'
import GpaSimulatorScreen from '../screens/grades/GpaSimulatorScreen'
import ProgressReportScreen from '../screens/grades/ProgressReportScreen'
import ReportCardScreen from '../screens/grades/ReportCardScreen'
import RoadmapScreen from '../screens/grades/RoadmapScreen'
import ScheduleScreen from '../screens/grades/ScheduleScreen'
import TranscriptScreen from '../screens/grades/TranscriptScreen'
import { renderStackHeader } from '../components/ui/ScreenHeader'

export type GradesStackParamList = {
  GradesHub: undefined
  Attendance: undefined
  Classwork: undefined
  ContactTeachers: undefined
  GpaSimulator: undefined
  ProgressReport: undefined
  ReportCard: undefined
  Roadmap: undefined
  Schedule: undefined
  Transcript: undefined
}

const Stack = createNativeStackNavigator<GradesStackParamList>()

export default function GradesNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        // One JS header on every pushed screen: same look on iOS, Android and web,
        // and a back chevron even when the screen was opened by deep link.
        header: (props) => renderStackHeader(props, 'GradesHub'),
      }}
    >
      <Stack.Screen name="GradesHub" component={GradesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Attendance' }} />
      <Stack.Screen name="Classwork" component={ClassworkScreen} options={{ title: 'Classwork' }} />
      <Stack.Screen
        name="ContactTeachers"
        component={ContactTeachersScreen}
        options={{ title: 'Teachers' }}
      />
      <Stack.Screen
        name="GpaSimulator"
        component={GpaSimulatorScreen}
        options={{ title: 'What-If' }}
      />
      <Stack.Screen
        name="ProgressReport"
        component={ProgressReportScreen}
        options={{ title: 'Progress' }}
      />
      <Stack.Screen name="ReportCard" component={ReportCardScreen} options={{ title: 'Report Card' }} />
      <Stack.Screen name="Roadmap" component={RoadmapScreen} options={{ title: 'Roadmap' }} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Schedule' }} />
      <Stack.Screen name="Transcript" component={TranscriptScreen} options={{ title: 'Transcript' }} />
    </Stack.Navigator>
  )
}
