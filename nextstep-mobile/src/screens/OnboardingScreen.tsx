import React, { useRef, useState } from 'react'
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { useReducedMotion } from 'react-native-reanimated'

import type { AuthStackParamList } from '../navigation/AuthNavigator'
import { Screen } from '../components/ui/Screen'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { GradeBadge } from '../components/ui/GradeBadge'
import { useDisplayPreferences } from '../preferences/displayPreferences'
import {
  colors,
  fonts,
  radii,
  spacing,
  typography,
} from '../theme/tokens'

const SCREEN_WIDTH = Dimensions.get('window').width
const SLIDE_COUNT = 3

// ---------------------------------------------------------------------------
// Slide preview card components — sized-down glimpses of the real app UI
// ---------------------------------------------------------------------------

function GpaPreviewCard(): React.JSX.Element {
  return (
    <Card variant="glass" style={styles.previewCard}>
      <Text style={styles.previewEyebrow}>CUMULATIVE GPA</Text>
      <View style={styles.previewGpaRow}>
        <Text style={styles.previewGpaNumber}>3.9</Text>
        <View style={styles.previewGpaBadge}>
          <Text style={styles.previewGpaBadgeText}>A</Text>
        </View>
      </View>
      <View style={styles.previewBarTrack}>
        <View style={[styles.previewBarFill, { width: '90%' }]} />
      </View>
      <Text style={styles.previewCaption}>Top 5% of class · Spring semester</Text>
    </Card>
  )
}

function GradesBadgePreviewCard(): React.JSX.Element {
  const grades: { subject: string; letter: 'A' | 'B' | 'C' }[] = [
    { subject: 'Calculus', letter: 'A' },
    { subject: 'English', letter: 'B' },
    { subject: 'Chemistry', letter: 'A' },
    { subject: 'History', letter: 'B' },
  ]

  return (
    <Card variant="glass" style={styles.previewCard}>
      <Text style={styles.previewEyebrow}>THIS SEMESTER</Text>
      <View style={styles.previewGradeRows}>
        {grades.map((item) => (
          <View key={item.subject} style={styles.previewGradeRow}>
            <GradeBadge letter={item.letter} size="sm" />
            <Text style={styles.previewGradeSubject}>{item.subject}</Text>
          </View>
        ))}
      </View>
    </Card>
  )
}

function PlannerPreviewCard(): React.JSX.Element {
  const items = [
    { label: 'AP Calculus quiz', due: 'Tomorrow', done: true },
    { label: 'History essay draft', due: 'In 3 days', done: false },
    { label: 'SAT prep session', due: 'Friday', done: false },
  ]

  return (
    <Card variant="glass" style={styles.previewCard}>
      <Text style={styles.previewEyebrow}>UPCOMING</Text>
      <View style={styles.previewPlannerRows}>
        {items.map((item) => (
          <View key={item.label} style={styles.previewPlannerRow}>
            <View
              style={[
                styles.previewPlannerDot,
                item.done && styles.previewPlannerDotDone,
              ]}
            />
            <View style={styles.previewPlannerCopy}>
              <Text
                style={[
                  styles.previewPlannerLabel,
                  item.done && styles.previewPlannerLabelDone,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <Text style={styles.previewPlannerDue}>{item.due}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Slide content definitions
// ---------------------------------------------------------------------------

interface SlideData {
  index: string
  headline: string
  body: string
  preview: React.ReactNode
}

const SLIDES: SlideData[] = [
  {
    index: '01/03',
    headline: 'Your grades,\nalways in view.',
    body: 'Sync your school portal and see every class, assignment, and GPA trend in one glance.',
    preview: <GpaPreviewCard />,
  },
  {
    index: '02/03',
    headline: 'Every class.\nEvery mark.',
    body: 'Color-coded grade badges, progress signals, and at-a-glance summaries for all your courses.',
    preview: <GradesBadgePreviewCard />,
  },
  {
    index: '03/03',
    headline: 'Plan ahead.\nStay confident.',
    body: 'AI-powered recommendations, assignment reminders, and your full academic timeline — organized for you.',
    preview: <PlannerPreviewCard />,
  },
]

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

type OnboardingNav = NativeStackNavigationProp<AuthStackParamList, 'Onboarding'>

export default function OnboardingScreen(): React.JSX.Element {
  const navigation = useNavigation<OnboardingNav>()
  const scrollRef = useRef<ScrollView>(null)
  const [activeSlide, setActiveSlide] = useState(0)

  const systemReduceMotion = useReducedMotion()
  const { reduceMotion: preferenceReduceMotion } = useDisplayPreferences()
  const reduceMotion = systemReduceMotion || preferenceReduceMotion

  function navigateToLogin(): void {
    navigation.navigate('Login')
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    const offsetX = event.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / SCREEN_WIDTH)
    setActiveSlide(index)
  }

  function goToSlide(index: number): void {
    if (reduceMotion) {
      scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: false })
    } else {
      scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true })
    }
    setActiveSlide(index)
  }

  function handlePrimary(): void {
    if (activeSlide < SLIDE_COUNT - 1) {
      goToSlide(activeSlide + 1)
    } else {
      navigateToLogin()
    }
  }

  const isLastSlide = activeSlide === SLIDE_COUNT - 1

  return (
    <Screen padded={false} edges={['top', 'left', 'right', 'bottom']}>
      {/* Skip link */}
      <View style={styles.topBar}>
        <Pressable
          onPress={navigateToLogin}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding and go to login"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        style={styles.carouselScroll}
        contentContainerStyle={styles.carouselContent}
        decelerationRate="fast"
        bounces={false}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.index} style={styles.slide}>
            <View style={styles.slideIndex}>
              <Text style={styles.slideIndexText}>{slide.index}</Text>
            </View>
            <View style={styles.slidePreview}>{slide.preview}</View>
            <View style={styles.slideCopy}>
              <Text style={styles.slideHeadline}>{slide.headline}</Text>
              <Text style={styles.slideBody}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      <View style={styles.dots} accessibilityRole="tablist">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <Pressable
            key={i}
            onPress={() => goToSlide(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === activeSlide }}
            accessibilityLabel={`Slide ${i + 1} of ${SLIDE_COUNT}`}
            style={styles.dotHitTarget}
          >
            <View
              style={[
                styles.dot,
                i === activeSlide
                  ? styles.dotActive
                  : styles.dotInactive,
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* CTA area */}
      <View style={styles.cta}>
        <Button
          label={isLastSlide ? 'Get Started' : 'Next'}
          onPress={handlePrimary}
          variant="primary"
          style={styles.primaryButton}
        />

        <Pressable
          onPress={navigateToLogin}
          style={styles.loginLink}
          accessibilityRole="link"
          accessibilityLabel="Already have an account? Log in"
        >
          <Text style={styles.loginLinkText}>
            Already have an account?{' '}
            <Text style={styles.loginLinkAccent}>Log in</Text>
          </Text>
        </Pressable>
      </View>
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SLIDE_HORIZONTAL_PADDING = spacing.screenPadding

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  skipButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.body,
    color: colors.textDim,
  },

  carouselScroll: {
    flex: 1,
  },
  carouselContent: {
    // no additional styles needed — paging handles width via slide styles
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: SLIDE_HORIZONTAL_PADDING,
    paddingTop: spacing.md,
    gap: spacing.xl,
  },
  slideIndex: {},
  slideIndexText: {
    ...typography.label,
    color: colors.accent,
  },
  slidePreview: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  slideCopy: {
    gap: spacing.sm,
  },
  slideHeadline: {
    ...typography.h1,
    color: colors.text,
    lineHeight: 30,
  },
  slideBody: {
    ...typography.body,
    color: colors.textDim,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  dotHitTarget: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    height: 6,
    borderRadius: radii.pill,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.accent,
  },
  dotInactive: {
    width: 6,
    backgroundColor: colors.cardBorder,
  },

  cta: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  primaryButton: {
    // full width — Button already fills its parent by default
  },
  loginLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginLinkText: {
    ...typography.body,
    color: colors.textDim,
    textAlign: 'center',
  },
  loginLinkAccent: {
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
    fontWeight: '500',
  },

  // --------------- Preview card shared styles ---------------
  previewCard: {
    width: '100%',
    gap: spacing.sm,
  },
  previewEyebrow: {
    ...typography.label,
    color: colors.textFaint,
  },

  // GPA preview
  previewGpaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  previewGpaNumber: {
    fontSize: 40,
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 44,
  },
  previewGpaBadge: {
    marginBottom: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.tierGreenBg,
    borderWidth: 1,
    borderColor: colors.tierGreen,
  },
  previewGpaBadgeText: {
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.tierGreen,
  },
  previewBarTrack: {
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.cardBorder,
    overflow: 'hidden',
  },
  previewBarFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.accent2,
  },
  previewCaption: {
    ...typography.caption,
    color: colors.textFaint,
  },

  // Grades preview
  previewGradeRows: {
    gap: spacing.xs,
  },
  previewGradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewGradeSubject: {
    ...typography.body,
    fontSize: 13,
    color: colors.textDim,
    flex: 1,
  },

  // Planner preview
  previewPlannerRows: {
    gap: spacing.xs,
  },
  previewPlannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  previewPlannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: colors.accent,
    flexShrink: 0,
  },
  previewPlannerDotDone: {
    backgroundColor: colors.tierGreen,
  },
  previewPlannerCopy: {
    flex: 1,
    gap: 1,
  },
  previewPlannerLabel: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '500',
    fontSize: 13,
    color: colors.text,
  },
  previewPlannerLabelDone: {
    color: colors.textFaint,
    textDecorationLine: 'line-through',
  },
  previewPlannerDue: {
    ...typography.caption,
    color: colors.textFaint,
  },
})
