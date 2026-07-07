import React, { useCallback, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import Text from '../components/ui/Text'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import { fetchStudentData, type StudentData } from '../api/studentApi'
import { shadows } from '../constants/shadows'

interface SampleCollege {
  id: number
  name: string
  location: string
  acceptance: string
}

const SAMPLE_COLLEGES: SampleCollege[] = [
  { id: 1, name: 'University of Texas at Austin', location: 'Austin, TX', acceptance: '31%' },
  { id: 2, name: 'Texas A&M University', location: 'College Station, TX', acceptance: '57%' },
  { id: 3, name: 'University of Houston', location: 'Houston, TX', acceptance: '62%' },
]

interface CollegeCardProps {
  college: SampleCollege
}

/**
 * These cards render sample data, not the student's real saved college list
 * (that list — and its CollegeListItem ids — lives on the web app only for now).
 * Navigation to CollegeInsightsScreen is intentionally disabled here since a
 * sample college's id does not correspond to a real CollegeListItem the
 * authenticated user owns, which would otherwise 404 against the live API.
 */
function CollegeCard({ college }: CollegeCardProps): React.JSX.Element {
  return (
    <View
      style={styles.collegeCard}
      accessibilityRole="text"
      accessibilityLabel={`${college.name} — available in Phase 2`}
    >
      <View style={styles.collegeLocked}>
        <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
        <Text variant="caption" style={{ marginLeft: 6, marginTop: 2 }}>Phase 2 feature</Text>
      </View>
      <View style={{ opacity: 0.4 }}>
        <Text variant="h3">{college.name}</Text>
        <Text variant="caption" style={{ marginTop: 4 }}>{college.location}</Text>
        <Text variant="caption" style={{ marginTop: 2 }}>Acceptance: {college.acceptance}</Text>
      </View>
    </View>
  )
}

export default function CollegesScreen(): React.JSX.Element {
  const [data, setData] = useState<StudentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      setData(await fetchStudentData())
    } catch {
      // silently fail — show placeholder anyway
    } finally {
      setIsLoading(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const uGpa = (data?.profile?.unweightedGpa ?? 0).toFixed(2)
  const futureDecision = data?.profile?.futureDecision ?? null

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Colleges" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text variant="heading" style={{ marginBottom: 16 }}>Colleges</Text>

        {/* Context card */}
        <View style={styles.card}>
          <Text variant="label" color={colors.textSecondary} style={{ marginBottom: 8 }}>
            Your Profile
          </Text>
          {isLoading ? (
            <>
              <Skeleton width="60%" height={15} style={{ marginBottom: 8 }} />
              <Skeleton width="80%" height={11} />
            </>
          ) : (
            <>
              <Text variant="body">GPA: <Text style={{ color: colors.primary, fontWeight: '700' }}>{uGpa}</Text></Text>
              {futureDecision !== null && (
                <Text variant="caption" style={{ marginTop: 4 }}>Goal: {futureDecision}</Text>
              )}
            </>
          )}
        </View>

        {/* College cards */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text variant="h3" style={{ marginBottom: 12 }}>College Matches</Text>
          {SAMPLE_COLLEGES.map(c => (
            <CollegeCard key={c.id} college={c} />
          ))}
        </View>

        {/* Encourage message */}
        <View style={[styles.card, { marginTop: 12, marginBottom: 40 }]}>
          <Ionicons name="school-outline" size={32} color={colors.primary} style={{ marginBottom: 8 }} />
          <Text variant="body" style={{ lineHeight: 22 }}>
            Based on your <Text style={{ color: colors.primary, fontWeight: '700' }}>{uGpa}</Text> GPA,
            we'll match you with the best-fit schools when this feature launches in Phase 2.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  card: {
    ...shadows.raised,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  collegeCard: {
    ...shadows.raised,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 8,
  },
  collegeLocked: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
})
