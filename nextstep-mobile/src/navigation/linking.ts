import type { LinkingOptions } from '@react-navigation/native'

import type { AuthStackParamList } from './AuthNavigator'
import type { ConnectSchoolStackParamList } from './ConnectSchoolNavigator'
import type { MainStackParamList } from './MainStack'
import type { MainTabParamList } from './MainNavigator'

// Flat intersection: all route keys from every navigator level so that
// LinkingOptions can resolve any screen name, including nested ones.
type RootLinkingParamList = AuthStackParamList &
  ConnectSchoolStackParamList &
  MainStackParamList &
  MainTabParamList

export const linking: LinkingOptions<RootLinkingParamList> = {
  prefixes: ['futurely://'],
  config: {
    screens: {
      Onboarding: 'onboarding',
      Login: 'login',
      ConnectSchool: 'connect-school',
      MainTabs: {
        screens: {
          Dashboard: {
            path: 'dashboard',
            alias: [''],
          },
          Grades: {
            path: 'grades',
            screens: {
              GradesHub: '',
              Attendance: 'attendance',
              Classwork: 'classwork',
              ContactTeachers: 'contact',
              ProgressReport: 'progress',
              ReportCard: 'report-card',
              Schedule: 'schedule',
              Transcript: 'transcript',
            },
          },
          AIChat: 'ai',
          Planner: {
            path: 'planner/:assignmentId?',
            parse: {
              assignmentId: Number,
            },
            stringify: {
              assignmentId: String,
            },
          },
          Roadmap: 'roadmap',
          // StudyFeed is hidden from the tab bar but retains its deep-link path
          // so that existing futurely://feed links continue to work.
          StudyFeed: 'feed',
        },
      },
      Settings: 'settings',
      Colleges: 'colleges',
      GpaSimulator: 'what-if',
    },
  },
}
