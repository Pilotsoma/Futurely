import React, { useCallback, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import { connectCanvas } from '../api/canvasApi'

// ── Validation ────────────────────────────────────────────────────────────────

const HOSTNAME_PATTERN = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function normalizeInstanceHost(instanceUrl: string): string {
  return instanceUrl.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function validateForm(instanceUrl: string, accessToken: string): Record<string, string> {
  const errors: Record<string, string> = {}
  const host = normalizeInstanceHost(instanceUrl)
  if (host === '') {
    errors.instanceUrl = 'Canvas URL is required.'
  } else if (!HOSTNAME_PATTERN.test(host)) {
    errors.instanceUrl = 'Enter your Canvas hostname, e.g. canvas.instructure.com'
  }
  if (accessToken.trim() === '') {
    errors.accessToken = 'Access token is required.'
  }
  return errors
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CanvasConnectScreen(): React.JSX.Element {
  const navigation = useNavigation()

  const [instanceUrl, setInstanceUrl] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const handleConnect = useCallback(async (): Promise<void> => {
    const errors = validateForm(instanceUrl, accessToken)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsConnecting(true)
    setConnectError(null)
    try {
      await connectCanvas(normalizeInstanceHost(instanceUrl), accessToken.trim())
      navigation.goBack()
    } catch (e) {
      setConnectError(
        e instanceof Error
          ? e.message
          : 'Failed to connect to Canvas. Check your URL and token and try again.',
      )
    } finally {
      setIsConnecting(false)
    }
  }, [instanceUrl, accessToken, navigation])

  return (
    <View style={styles.container}>
      <ScreenHeader title="Connect Canvas" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="body" color={colors.textSecondary} style={styles.description}>
            Enter your Canvas LMS instance URL and a personal access token. You can generate an access token in your Canvas account settings under "Approved Integrations."
          </Text>

          <Input
            label="Canvas URL"
            value={instanceUrl}
            onChangeText={setInstanceUrl}
            placeholder="canvas.instructure.com"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isConnecting}
            error={fieldErrors.instanceUrl ?? null}
            returnKeyType="next"
            accessibilityLabel="Canvas instance URL"
          />

          <Input
            label="Access Token"
            value={accessToken}
            onChangeText={setAccessToken}
            placeholder="Paste your Canvas access token"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isConnecting}
            error={fieldErrors.accessToken ?? null}
            returnKeyType="done"
            onSubmitEditing={() => void handleConnect()}
            accessibilityLabel="Canvas access token"
          />

          {connectError !== null && (
            <View style={styles.errorBanner}>
              <Text variant="caption" color={colors.error}>{connectError}</Text>
            </View>
          )}

          <Button
            label="Connect Canvas"
            onPress={() => void handleConnect()}
            isLoading={isConnecting}
            disabled={isConnecting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  description: {
    marginBottom: 24,
    lineHeight: 22,
  },
  errorBanner: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.error + '18',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
})
