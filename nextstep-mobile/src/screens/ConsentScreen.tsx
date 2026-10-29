import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'

import { ApiRequestError } from '../api/client'
import { Button } from '../components/ui/Button'
import { Screen } from '../components/ui/Screen'
import { useAuth } from '../context/AuthContext'
import { colors, radii, spacing, typography } from '../theme/tokens'

interface ConsentRowProps {
  checked: boolean
  onToggle: () => void
  label: string
  subtitle: string
}

function ConsentRow({ checked, onToggle, label, subtitle }: ConsentRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  )
}

export default function ConsentScreen(): React.JSX.Element {
  const { acceptConsent, signOut } = useAuth()
  const [tos, setTos] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [age, setAge] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue(): Promise<void> {
    setError(null)
    setLoading(true)
    try {
      await acceptConsent()
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'We could not save your agreement. Please try again.',
      )
      setLoading(false)
    }
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.icon}>
          <Feather name="file-text" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>One last step</Text>
        <Text style={styles.description}>Please review and agree before you continue to myFuturely.</Text>

        <View style={styles.rows}>
          <ConsentRow
            checked={tos}
            onToggle={() => setTos((v) => !v)}
            label="I agree to the Terms of Service"
            subtitle="I agree to use myFuturely responsibly."
          />
          <ConsentRow
            checked={privacy}
            onToggle={() => setPrivacy((v) => !v)}
            label="I agree to the Privacy Policy"
            subtitle="I understand how my information is handled."
          />
          <ConsentRow
            checked={age}
            onToggle={() => setAge((v) => !v)}
            label="I'm 13 or older"
            subtitle="myFuturely is for students aged 13 and up."
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Continue"
          onPress={() => void handleContinue()}
          loading={loading}
          disabled={!tos || !privacy || !age}
        />
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  icon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: radii.lg,
    backgroundColor: colors.primaryDim,
  },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  rows: { gap: spacing.sm, marginVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  box: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderHover,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: { ...typography.body, color: colors.text, fontWeight: '600' },
  rowSubtitle: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.error, textAlign: 'center' },
})
