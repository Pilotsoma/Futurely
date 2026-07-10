import React from 'react'
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import BranchHeader from '../components/ui/BranchHeader'
import { colors } from '../constants/colors'
import type { GradePortalParamList } from '../navigation/GradePortalNavigator'
import {
  ClipboardIcon,
  DocumentIcon,
  ClockIcon,
  CalculatorIcon,
  EnvelopeIcon,
  GraduationCapIcon,
  CalendarIcon,
  BarChartIcon,
  BookOpenIcon,
  type IconProps,
} from '../components/icons'
import { shadows } from '../constants/shadows'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<GradePortalParamList>

type TileScreen = 'GradeViewer' | 'Transcript' | 'ClassSchedule' | 'WhatIfCalculator' | 'ContactTeachers' | 'ReportCard' | 'Attendance' | 'ProgressReport' | 'Canvas'

interface Tile {
  title: string
  description: string
  Icon: React.FC<IconProps>
  iconColor: string
  screen: TileScreen
}

// ─── Tiles ────────────────────────────────────────────────────────────────────

const TILES: Tile[] = [
  {
    title: 'Grades',
    description: 'View your class grades',
    Icon: ClipboardIcon,
    iconColor: colors.primary,
    screen: 'GradeViewer',
  },
  {
    title: 'Report Card',
    description: 'View your report card',
    Icon: GraduationCapIcon,
    iconColor: colors.purple,
    screen: 'ReportCard',
  },
  {
    title: 'Transcript',
    description: 'Credits & GPA history',
    Icon: DocumentIcon,
    iconColor: colors.info,
    screen: 'Transcript',
  },
  {
    title: 'Class Schedule',
    description: 'Your class periods',
    Icon: ClockIcon,
    iconColor: colors.warning,
    screen: 'ClassSchedule',
  },
  {
    title: 'What-If Calculator',
    description: 'Simulate grade changes',
    Icon: CalculatorIcon,
    iconColor: colors.success,
    screen: 'WhatIfCalculator',
  },
  {
    title: 'Contact Teachers',
    description: 'Email your teachers',
    Icon: EnvelopeIcon,
    iconColor: colors.orange,
    screen: 'ContactTeachers',
  },
  {
    title: 'Attendance',
    description: 'View your attendance record',
    Icon: CalendarIcon,
    iconColor: colors.teal,
    screen: 'Attendance',
  },
  {
    title: 'Progress Report',
    description: 'View your progress report',
    Icon: BarChartIcon,
    iconColor: colors.warning,
    screen: 'ProgressReport',
  },
  {
    title: 'Canvas',
    description: 'Canvas LMS courses & grades',
    Icon: BookOpenIcon,
    iconColor: colors.purple,
    screen: 'Canvas',
  },
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GradePortalDashboard(): React.JSX.Element {
  const navigation = useNavigation<NavProp>()

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BranchHeader />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" style={styles.title}>Grade Portal</Text>
        <View style={styles.grid}>
          {TILES.map(tile => (
            <TouchableOpacity
              key={tile.title}
              style={styles.tile}
              onPress={() => navigation.navigate(tile.screen)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={tile.title}
            >
              <View style={[styles.iconSquare, { backgroundColor: tile.iconColor + '26' }]}>
                <tile.Icon size={24} color={tile.iconColor} />
              </View>
              <Text variant="h3" style={styles.tileTitle}>{tile.title}</Text>
              <Text variant="caption" style={styles.tileDesc}>{tile.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: { marginBottom: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    ...shadows.raised,
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { marginTop: 10 },
  tileDesc: { marginTop: 4 },
})
