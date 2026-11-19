import React, { useMemo } from 'react'
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as gradesApi from '../../api/gradesApi'
import { usePortalFetch } from '../../hooks/usePortalFetch'
import { Screen, SCROLL_BOTTOM_CLEARANCE } from '../../components/ui/Screen'
import { PortalDataState } from '../../components/grades/PortalDataState'
import { PortalCard, PortalFallback } from '../../components/grades/portal'
import { isEmptyPortalData } from '../../components/ui/RawDataView'
import { parseTeachers, type TeacherEntry } from '../../features/grades/portal/teachers'
import { colors, fonts, spacing, touchTarget, typography } from '../../theme/tokens'

const NO_EMAIL_APP_TITLE = 'No email app found'
const NO_EMAIL_APP_MESSAGE = 'Set up an email app on this device to contact your teacher.'

// Alert.alert is a no-op on react-native-web, so the web build uses the browser's alert.
function explainNoEmailApp(): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${NO_EMAIL_APP_TITLE}\n\n${NO_EMAIL_APP_MESSAGE}`)
    return
  }
  Alert.alert(NO_EMAIL_APP_TITLE, NO_EMAIL_APP_MESSAGE)
}

// Recipient only: no subject, no body, nothing about the student in the URL.
function openEmail(address: string): void {
  Linking.openURL(`mailto:${address}`).catch(explainNoEmailApp)
}

function initialOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => word.length > 0)
  const last = words[words.length - 1] ?? ''
  return (Array.from(last)[0] ?? '?').toUpperCase()
}

// Icon fonts render as text glyphs, which would otherwise become part of the link's accessible
// name on web. Hiding them keeps the name equal to the visible address.
function DecorativeIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof Feather>['name']
  color: string
}): React.JSX.Element {
  return (
    <View aria-hidden>
      <Feather name={name} size={16} color={color} />
    </View>
  )
}

function EmailRow({ address, index }: { address: string; index: number }): React.JSX.Element {
  return (
    <Pressable
      testID={`teacher-email-${index}`}
      onPress={() => openEmail(address)}
      accessibilityRole="link"
      accessibilityHint="Opens your email app"
      style={({ pressed }) => [styles.emailRow, pressed && styles.pressed]}
    >
      <DecorativeIcon name="mail" color={colors.accentLight} />
      <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
        {address}
      </Text>
      <DecorativeIcon name="chevron-right" color={colors.textSecondary} />
    </Pressable>
  )
}

function TeacherCard({ teacher, index }: { teacher: TeacherEntry; index: number }): React.JSX.Element {
  return (
    <PortalCard testID={`teacher-card-${index}`}>
      <View style={styles.top}>
        <View style={styles.avatar} aria-hidden>
          <Text style={styles.initial}>{initialOf(teacher.name)}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{teacher.name}</Text>
          {teacher.coursesText ? <Text style={styles.detail}>{teacher.coursesText}</Text> : null}
          {teacher.placeText ? <Text style={styles.detail}>{teacher.placeText}</Text> : null}
        </View>
      </View>
      {teacher.email !== null ? (
        <>
          <View style={styles.divider} />
          <EmailRow address={teacher.email} index={index} />
        </>
      ) : null}
    </PortalCard>
  )
}

export default function ContactTeachersScreen(): React.JSX.Element {
  const { data, loading, unsupported, error, reload } = usePortalFetch(() => gradesApi.getContactTeachers())
  const content = data
  const model = useMemo(() => parseTeachers(data), [data])

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PortalDataState
          loading={loading}
          unsupported={unsupported}
          error={error}
          onRetry={reload}
          feature="Contact teachers"
          isEmpty={isEmptyPortalData(content) || (model !== null && model.teachers.length === 0)}
          emptyIcon="mail"
          emptyTitle="No teacher contacts"
          emptyMessage="Your portal didn't list contact details for your teachers."
        >
          {model ? (
            <>
              {model.teachers.map((teacher, index) => (
                <TeacherCard key={`${teacher.name}-${index}`} teacher={teacher} index={index} />
              ))}
            </>
          ) : (
            <PortalFallback data={content} />
          )}
        </PortalDataState>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingTop: spacing.lg, paddingBottom: SCROLL_BOTTOM_CLEARANCE },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.ms },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initial: { fontFamily: fonts.jakartaBold, fontWeight: '700', fontSize: 15, color: colors.accentLight },
  identity: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.h3, color: colors.text },
  detail: { ...typography.bodySm, color: colors.textSecondary },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginTop: spacing.ms,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
  },
  email: { ...typography.bodyMd, color: colors.accentLight, flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
})
