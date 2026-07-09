/**
 * LoginScreen — handles sign-in, registration (3-step: form → OTP → consent), and forgot-password.
 *
 * Registration steps:
 *   1. 'register' — collect name / email / password / confirm-password
 *   2. 'otp'      — 6-digit email verification code
 *   3. 'consent'  — scrollable ToS + Privacy Policy with three agreement checkboxes
 *
 * Login and forgot-password paths are unchanged from the previous implementation.
 *
 * NOTE: Google OAuth (Firebase Sign-In with Google) is NOT implemented here.
 * The mobile project is missing google-services.json / GoogleService-Info.plist
 * and the Firebase Google Sign-In SDK. This is flagged as a blocked item for
 * DevOps / Integration to configure before Google Sign-In can be wired up.
 */
import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { colors } from '../constants/colors'
import { API_BASE_URL } from '../constants/api'
import {
  LEGAL_EFFECTIVE_DATE,
  TOS_INTRO,
  TOS_SECTIONS,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
} from '../constants/legalText'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Text from '../components/ui/Text'
import FuturelyLogo from '../components/ui/FuturelyLogo'
import { CheckIcon } from '../components/icons'

type AuthStackParamList = {
  Login: undefined
  SchoolLogin: undefined
}

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'login' | 'register' | 'otp' | 'consent' | 'forgot'

// ─── Forgot-password API call ─────────────────────────────────────────────────

async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    let message = 'Failed to send reset email. Please try again.'
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }
}

// ─── Forgot-password sub-screen ───────────────────────────────────────────────

interface ForgotPanelProps {
  onBack: () => void
}

function ForgotPanel({ onBack }: ForgotPanelProps): React.JSX.Element {
  const [email, setEmail]         = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent]           = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSend(): Promise<void> {
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Please enter your email address.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await requestPasswordReset(trimmed)
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setIsLoading(false)
    }
  }

  if (sent) {
    return (
      <View>
        <Text variant="h3" style={styles.forgotTitle}>Check your inbox</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.forgotSubtitle}>
          If an account exists for{' '}
          <Text style={{ color: colors.textPrimary }}>{email.trim()}</Text>
          , you will receive a password reset link shortly.
        </Text>
        <Button label="Back to Log In" onPress={onBack} />
      </View>
    )
  }

  return (
    <View>
      <Text variant="h3" style={styles.forgotTitle}>Reset your password</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.forgotSubtitle}>
        Enter the email address associated with your account and we will send you a reset link.
      </Text>

      <Input
        label="Email"
        value={email}
        onChangeText={(v) => { setEmail(v); setError(null) }}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isLoading}
        returnKeyType="done"
        onSubmitEditing={() => void handleSend()}
      />

      {error !== null && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Button
        label={isLoading ? 'Sending…' : 'Send Reset Link'}
        onPress={() => void handleSend()}
        isLoading={isLoading}
      />

      <TouchableOpacity
        style={styles.backLink}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to log in"
      >
        <Text style={styles.switchText}>← Back to Log In</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Checkbox row ─────────────────────────────────────────────────────────────

interface CheckboxRowProps {
  checked: boolean
  onToggle: () => void
  label: string
  accessibilityLabel: string
}

function CheckboxRow({ checked, onToggle, label, accessibilityLabel }: CheckboxRowProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={onToggle}
      activeOpacity={0.75}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked && <CheckIcon size={14} color={colors.background} />}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen(): React.JSX.Element {
  const { login, sendOtp, register } = useAuth()
  const navigation = useNavigation<NavProp>()

  const [mode, setMode]                       = useState<Mode>('login')
  const [email, setEmail]                     = useState('')
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName]                       = useState('')

  // OTP step state
  const [otpCode, setOtpCode]     = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError]   = useState<string | null>(null)

  // Consent step state
  const [agreedTos, setAgreedTos]         = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [agreedAge, setAgreedAge]         = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const isRegister = mode === 'register'

  // ── Step 1 → Step 2: validate form, send OTP ────────────────────────────────

  async function handleRegisterFormSubmit(): Promise<void> {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setOtpLoading(true)
    setError(null)
    try {
      await sendOtp(email.trim())
      setOtpCode('')
      setOtpError(null)
      setMode('otp')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send verification code.')
    } finally {
      setOtpLoading(false)
    }
  }

  // ── Resend OTP ──────────────────────────────────────────────────────────────

  async function handleResendOtp(): Promise<void> {
    setOtpLoading(true)
    setOtpError(null)
    try {
      await sendOtp(email.trim())
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : 'Failed to resend code.')
    } finally {
      setOtpLoading(false)
    }
  }

  // ── Step 2 → Step 3: validate OTP digits, advance to consent ────────────────

  function handleVerifyOtp(): void {
    const trimmed = otpCode.trim()
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setOtpError('Please enter the 6-digit code sent to your email.')
      return
    }
    setAgreedTos(false)
    setAgreedPrivacy(false)
    setAgreedAge(false)
    setMode('consent')
  }

  // ── Step 3: final registration call ─────────────────────────────────────────

  async function handleConsentSubmit(): Promise<void> {
    setIsLoading(true)
    setError(null)
    try {
      await register(
        email.trim(),
        password,
        otpCode.trim(),
        agreedTos,
        agreedPrivacy,
        agreedAge,
        name.trim() || undefined,
      )
      // RootNavigator re-renders automatically when token is set in AuthContext
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Login submit ─────────────────────────────────────────────────────────────

  async function handleLoginSubmit(): Promise<void> {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await login(email.trim(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function switchMode(): void {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError(null)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setName('')
    setOtpCode('')
    setOtpError(null)
    setAgreedTos(false)
    setAgreedPrivacy(false)
    setAgreedAge(false)
  }

  const subtitleText =
    mode === 'forgot'    ? 'Account Recovery'
    : mode === 'otp'     ? 'Email Verification'
    : mode === 'consent' ? 'Terms & Privacy'
    : isRegister         ? 'Create your account'
    :                      'Your academic companion'

  const allConsentChecked = agreedTos && agreedPrivacy && agreedAge

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* OTP and consent steps use a full-page ScrollView */}
      {(mode === 'otp' || mode === 'consent') ? (
        <ScrollView
          style={styles.scrollOuter}
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand */}
          <View style={styles.brand}>
            <FuturelyLogo size={80} />
            <Text variant="display" color={colors.primary} style={{ textAlign: 'center', marginTop: 16 }}>
              myFuturely
            </Text>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: 8 }}>
              {subtitleText}
            </Text>
          </View>

          {/* ── OTP step ── */}
          {mode === 'otp' && (
            <View>
              <Text variant="body" color={colors.textSecondary} style={styles.otpInstructions}>
                We sent a 6-digit verification code to{' '}
                <Text style={{ color: colors.textPrimary }}>{email.trim()}</Text>.
                Enter it below to continue.
              </Text>

              <Input
                label="Verification Code"
                value={otpCode}
                onChangeText={(v) => { setOtpCode(v.replace(/\D/g, '').slice(0, 6)); setOtpError(null) }}
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!otpLoading}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
                testID="otp-input"
              />

              {otpError !== null && (
                <Text style={styles.errorText}>{otpError}</Text>
              )}

              <Button
                label="Verify & Continue"
                onPress={handleVerifyOtp}
                isLoading={otpLoading}
                testID="otp-verify-button"
              />

              <TouchableOpacity
                style={styles.switchLink}
                onPress={() => void handleResendOtp()}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Resend verification code"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                disabled={otpLoading}
              >
                <Text style={[styles.switchText, otpLoading && styles.disabledText]}>
                  {otpLoading ? 'Sending…' : 'Resend code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => { setMode('register'); setOtpError(null) }}
                accessibilityRole="button"
                accessibilityLabel="Back to registration form"
              >
                <Text style={styles.switchText}>← Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Consent step ── */}
          {mode === 'consent' && (
            <View>
              {/* Legal text in a bounded scroll area */}
              <View style={styles.legalScrollContainer}>
                <ScrollView
                  style={styles.legalScroll}
                  nestedScrollEnabled
                  accessibilityLabel="Terms of Service and Privacy Policy"
                >
                  <Text style={styles.legalMeta}>{LEGAL_EFFECTIVE_DATE}</Text>

                  {/* Terms of Service */}
                  <Text style={styles.legalTopHeading}>Terms of Service</Text>
                  <Text style={styles.legalBody}>{TOS_INTRO}</Text>
                  {TOS_SECTIONS.map((section) => (
                    <View key={section.heading}>
                      <Text style={styles.legalSectionHeading}>{section.heading}</Text>
                      <Text style={styles.legalBody}>{section.body}</Text>
                    </View>
                  ))}

                  {/* Privacy Policy */}
                  <Text style={[styles.legalTopHeading, styles.legalTopHeadingSpaced]}>Privacy Policy</Text>
                  <Text style={styles.legalBody}>{PRIVACY_INTRO}</Text>
                  {PRIVACY_SECTIONS.map((section) => (
                    <View key={section.heading}>
                      <Text style={styles.legalSectionHeading}>{section.heading}</Text>
                      <Text style={styles.legalBody}>{section.body}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Consent checkboxes */}
              <View style={styles.checkboxGroup}>
                <CheckboxRow
                  checked={agreedTos}
                  onToggle={() => setAgreedTos(v => !v)}
                  label="I have read and agree to the Terms of Service"
                  accessibilityLabel="Agree to Terms of Service"
                />
                <CheckboxRow
                  checked={agreedPrivacy}
                  onToggle={() => setAgreedPrivacy(v => !v)}
                  label="I have read and agree to the Privacy Policy"
                  accessibilityLabel="Agree to Privacy Policy"
                />
                <CheckboxRow
                  checked={agreedAge}
                  onToggle={() => setAgreedAge(v => !v)}
                  label="I am at least 13 years of age"
                  accessibilityLabel="Confirm you are at least 13 years old"
                />
              </View>

              {error !== null && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              <Button
                label={isLoading ? 'Creating account…' : 'Create Account'}
                onPress={() => void handleConsentSubmit()}
                isLoading={isLoading}
                disabled={!allConsentChecked || isLoading}
                testID="consent-submit-button"
              />

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => { setMode('otp'); setError(null) }}
                accessibilityRole="button"
                accessibilityLabel="Back to OTP entry"
              >
                <Text style={styles.switchText}>← Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.inner}>

          {/* ── Brand ── */}
          <View style={styles.brand}>
            <FuturelyLogo size={80} />
            <Text variant="display" color={colors.primary} style={{ textAlign: 'center', marginTop: 16 }}>
              myFuturely
            </Text>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', marginTop: 8 }}>
              {subtitleText}
            </Text>
          </View>

          {/* ── Forgot password panel ── */}
          {mode === 'forgot' ? (
            <ForgotPanel onBack={() => setMode('login')} />
          ) : (
            <View>
              {/* Display name (register only) */}
              {isRegister && (
                <Input
                  label="Display Name (optional)"
                  value={name}
                  onChangeText={(v) => { setName(v); setError(null) }}
                  placeholder="Jane Doe"
                  autoCapitalize="words"
                  editable={!otpLoading}
                  returnKeyType="next"
                />
              )}

              <Input
                label="Email"
                value={email}
                onChangeText={(v) => { setEmail(v); setError(null) }}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading && !otpLoading}
                returnKeyType="next"
                testID="email-input"
              />

              <Input
                label="Password"
                value={password}
                onChangeText={(v) => { setPassword(v); setError(null) }}
                placeholder={isRegister ? 'At least 6 characters' : 'Enter your password'}
                secureTextEntry
                editable={!isLoading && !otpLoading}
                returnKeyType={isRegister ? 'next' : 'done'}
                onSubmitEditing={() => { if (!isRegister) void handleLoginSubmit() }}
                testID="password-input"
              />

              {/* Forgot password link — login mode only */}
              {!isRegister && (
                <TouchableOpacity
                  style={styles.forgotLink}
                  onPress={() => { setError(null); setMode('forgot') }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot your password?"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {/* Confirm password (register only) */}
              {isRegister && (
                <Input
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setError(null) }}
                  placeholder="Re-enter your password"
                  secureTextEntry
                  editable={!isLoading && !otpLoading}
                  returnKeyType="done"
                  onSubmitEditing={() => void handleRegisterFormSubmit()}
                  error={error}
                />
              )}

              {!isRegister && error !== null && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              <Button
                label={
                  otpLoading
                    ? 'Sending code…'
                    : isLoading
                    ? (isRegister ? 'Creating account…' : 'Logging in…')
                    : (isRegister ? 'Continue' : 'Log In')
                }
                onPress={() => void (isRegister ? handleRegisterFormSubmit() : handleLoginSubmit())}
                isLoading={isLoading || otpLoading}
                testID="login-button"
              />

              {/* Mode switch */}
              <TouchableOpacity
                style={styles.switchLink}
                onPress={switchMode}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={isRegister ? 'Already have an account? Log In' : "Don't have an account? Create one"}
              >
                <Text style={styles.switchText}>
                  {isRegister
                    ? 'Already have an account? Log In'
                    : "Don't have an account? Create one"}
                </Text>
              </TouchableOpacity>

              {/* Student portal link — login mode only */}
              {!isRegister && (
                <TouchableOpacity
                  style={styles.switchLink}
                  onPress={() => navigation.navigate('SchoolLogin')}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Student? Sign in with your school account"
                >
                  <Text style={[styles.switchText, { color: colors.textSecondary, fontWeight: '400' }]}>
                    Student? <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign in with school account</Text>
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        </View>
      )}
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  // OTP and consent steps use a full-page scroll
  scrollOuter: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  // OTP step
  otpInstructions: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  // Consent step — bounded legal text scroll area
  legalScrollContainer: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 320,
    marginBottom: 20,
  },
  legalScroll: {
    padding: 16,
  },
  legalMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
  },
  legalTopHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 4,
    marginBottom: 6,
  },
  legalTopHeadingSpaced: {
    marginTop: 20,
  },
  legalSectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  legalBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  // Checkboxes
  checkboxGroup: {
    marginBottom: 16,
    gap: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // paddingVertical + text height brings total touch area to ≥ 44pt
    paddingVertical: 10,
    gap: 10,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // Forgot-password panel
  forgotTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  forgotSubtitle: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 12,
    // paddingVertical 8 + hitSlop 12 each side = 8+16+12+12 ≥ 44pt tap target
    paddingVertical: 8,
  },
  forgotLinkText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
    // paddingVertical 14 ensures ≥ 44pt touch target (14 + ~16 text + 14)
    paddingVertical: 14,
  },
  // Wrapper provides the 44pt touch target
  switchLink: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.4,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 8,
  },
})
