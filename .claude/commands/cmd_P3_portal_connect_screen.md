# CMD P3 — Mobile: Create PortalConnectScreen

## Context
Students currently have no way to connect their school portal in the app. This task
creates the screen where a student enters their district URL, username, and password
to connect to HAC or PowerSchool.

This screen handles sensitive credentials. The password field must use `secureTextEntry`.
The password must NEVER be saved to AsyncStorage, state outside this component, or
any persistent storage. It exists only in the TextInput's local state and is discarded
the moment the API call returns.

## Step 1 — Read existing screens for style reference

Read these files to understand the visual style used across the app:
- `nextstep-mobile/src/screens/GradePortalDashboard.tsx` — color usage, StyleSheet patterns
- `nextstep-mobile/src/components/ui/Text.tsx` — Text component variants
- `nextstep-mobile/src/components/ui/BranchHeader.tsx` — header pattern (if exists)
- `nextstep-mobile/src/constants/colors.ts` — color constants

Print the `colors` export so you know the exact color values available.

## Step 2 — Read the portalApi.ts you just created

Read `nextstep-mobile/src/api/portalApi.ts` — specifically the `connectHac` and
`connectPowerSchool` function signatures and the `ConnectResult` type. You will call
these functions from this screen.

## Step 3 — Create PortalConnectScreen.tsx

Create `nextstep-mobile/src/screens/PortalConnectScreen.tsx` with this implementation.
Adapt colors and StyleSheet patterns to match the existing app — do not hardcode hex
values that are already in `colors.ts`.

```typescript
import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput as TextInputType,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import Text from '../components/ui/Text'
import { colors } from '../constants/colors'
import { connectHac, connectPowerSchool } from '../api/portalApi'

// ── Types ─────────────────────────────────────────────────────────────────────

type PortalType = 'HAC' | 'PowerSchool'

type ConnectionState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'success'; portalType: PortalType }
  | { status: 'error'; message: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const PORTAL_OPTIONS: { type: PortalType; label: string; placeholder: string }[] = [
  {
    type: 'HAC',
    label: 'HAC (Home Access Center)',
    placeholder: 'https://hac.katyisd.org',
  },
  {
    type: 'PowerSchool',
    label: 'PowerSchool',
    placeholder: 'https://powerschool.yourdistrict.org',
  },
]

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PortalConnectScreen(): React.JSX.Element {
  const navigation = useNavigation()

  // Form state
  const [portalType, setPortalType] = useState<PortalType>('HAC')
  const [districtUrl, setDistrictUrl] = useState('')
  const [username, setUsername] = useState('')
  // Password lives only in local state and is never persisted
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Connection state machine
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'idle' })

  // Refs for keyboard navigation between fields
  const usernameRef = useRef<TextInputType>(null)
  const passwordRef = useRef<TextInputType>(null)

  const isConnecting = connectionState.status === 'connecting'
  const selectedPortal = PORTAL_OPTIONS.find(p => p.type === portalType)!

  // Validate inputs before attempting connection
  const validate = useCallback((): string | null => {
    const url = districtUrl.trim()
    const user = username.trim()
    const pass = password  // do not trim passwords

    if (!url) return 'Please enter your district portal URL.'
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'District URL must start with http:// or https://'
    }
    if (!user) return 'Please enter your username.'
    if (!pass) return 'Please enter your password.'
    if (pass.length < 4) return 'Password seems too short — please check it.'
    return null
  }, [districtUrl, username, password])

  const handleConnect = useCallback(async (): Promise<void> => {
    const validationError = validate()
    if (validationError) {
      setConnectionState({ status: 'error', message: validationError })
      return
    }

    setConnectionState({ status: 'connecting' })

    const url = districtUrl.trim()
    const user = username.trim()
    // Password used once in the API call, then the local state will be cleared on success
    const pass = password

    try {
      if (portalType === 'HAC') {
        await connectHac(url, user, pass)
      } else {
        await connectPowerSchool(url, user, pass)
      }

      // Success — clear the password from local state immediately
      setPassword('')
      setConnectionState({ status: 'success', portalType })

      // Navigate back after a short delay so the user sees the success message
      setTimeout(() => {
        navigation.goBack()
      }, 1800)

    } catch (err: unknown) {
      // Never log the password in error messages
      const message =
        err instanceof Error
          ? err.message.replace(pass, '[hidden]')
          : 'Connection failed. Check your URL and credentials and try again.'
      // Clear password on error too — student should re-enter it
      setPassword('')
      setConnectionState({ status: 'error', message })
    }
  }, [validate, districtUrl, username, password, portalType, navigation])

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text variant="heading" style={styles.headerTitle}>
            Connect School Portal
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Portal type selector ── */}
          <Text variant="label" style={styles.sectionLabel}>Portal Type</Text>
          <View style={styles.toggleRow}>
            {PORTAL_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.type}
                style={[
                  styles.toggleButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  portalType === option.type && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + '18',
                  },
                ]}
                onPress={() => {
                  setPortalType(option.type)
                  setDistrictUrl('')
                  setConnectionState({ status: 'idle' })
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: portalType === option.type }}
                accessibilityLabel={option.label}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: portalType === option.type ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── District URL ── */}
          <Text variant="label" style={styles.sectionLabel}>District Portal URL</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder={selectedPortal.placeholder}
            placeholderTextColor={colors.textMuted}
            value={districtUrl}
            onChangeText={text => {
              setDistrictUrl(text)
              setConnectionState({ status: 'idle' })
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
            editable={!isConnecting}
            accessibilityLabel="District portal URL"
          />

          {/* ── Username ── */}
          <Text variant="label" style={styles.sectionLabel}>Username</Text>
          <TextInput
            ref={usernameRef}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Your school username"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={text => {
              setUsername(text)
              setConnectionState({ status: 'idle' })
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!isConnecting}
            accessibilityLabel="Username"
          />

          {/* ── Password ── */}
          <Text variant="label" style={styles.sectionLabel}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordRef}
              style={[
                styles.input,
                styles.passwordInput,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
              ]}
              placeholder="Your school password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={text => {
                setPassword(text)
                setConnectionState({ status: 'idle' })
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleConnect}
              editable={!isConnecting}
              accessibilityLabel="Password"
            />
            <TouchableOpacity
              style={[styles.eyeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowPassword(v => !v)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* ── Error / Success states ── */}
          {connectionState.status === 'error' && (
            <View style={[styles.statusBanner, { backgroundColor: '#F851491A', borderColor: '#F85149' }]}>
              <Ionicons name="alert-circle-outline" size={18} color="#F85149" />
              <Text style={[styles.statusText, { color: '#F85149' }]}>
                {connectionState.message}
              </Text>
            </View>
          )}

          {connectionState.status === 'success' && (
            <View style={[styles.statusBanner, { backgroundColor: colors.primary + '1A', borderColor: colors.primary }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.statusText, { color: colors.primary }]}>
                Connected! Returning to Grade Portal…
              </Text>
            </View>
          )}

          {/* ── Connect button ── */}
          <TouchableOpacity
            style={[
              styles.connectButton,
              { backgroundColor: colors.primary },
              isConnecting && { opacity: 0.7 },
            ]}
            onPress={handleConnect}
            disabled={isConnecting || connectionState.status === 'success'}
            accessibilityRole="button"
            accessibilityLabel="Connect to school portal"
          >
            {isConnecting ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.connectButtonText}>
                {connectionState.status === 'success' ? '✓ Connected' : 'Connect'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Disclaimer ── */}
          <View style={[styles.disclaimer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} style={styles.disclaimerIcon} />
            <Text variant="caption" style={[styles.disclaimerText, { color: colors.textMuted }]}>
              NextStep is an independent student tool and is not affiliated with, endorsed by, or
              partnered with any school district. Only connect accounts you personally own and have
              authorization to access. Your password is sent directly to your school portal and is
              never stored by NextStep.
            </Text>
          </View>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  passwordRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    width: 46,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  connectButton: {
    marginTop: 24,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  disclaimer: {
    flexDirection: 'row',
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  disclaimerIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  disclaimerText: {
    flex: 1,
    lineHeight: 18,
  },
})
```

## Step 4 — Verify color references

After creating the file, scan it for any color references. Every color used must either:
a) Come from `colors.something` (the imported colors constant), OR
b) Be a brand hex that does not exist in colors.ts (like `#F85149` for red error — acceptable)

Replace any hardcoded hex values that ARE in colors.ts with the `colors.X` reference.

## Step 5 — TypeScript check

```bash
cd nextstep-mobile && npx tsc --noEmit 2>&1 | head -60
```

Fix all errors. Common issues:
- `Text` component's `variant` prop may not include `"label"` — check Text.tsx and use
  whatever variant is closest (e.g., `"caption"`, `"body"`, or no variant)
- If `colors.textMuted` does not exist, use `colors.textSecondary` or check colors.ts
  for the actual muted color name
- Navigation `goBack` may need a typed NavProp — add it if the type checker complains

## Done

Report:
- File created: yes/no
- Colors used from colors.ts (list which ones)
- Any color constants that did NOT exist in colors.ts and needed a workaround
- TypeScript errors before fix
- TypeScript errors after fix: 0
- Disclaimer text present: yes/no
- Password secureTextEntry: yes/no
