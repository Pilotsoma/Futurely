import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useAuth } from '../context/AuthContext'
import * as authApi from '../api/authApi'
import { ApiRequestError } from '../api/client'
import { GoogleLogo } from '../components/ui/GoogleLogo'
import {
  OTP_LENGTH,
  PASSWORD_PLACEHOLDER,
  PASSWORD_REQUIREMENTS,
  type SignupField,
  isSignupField,
  normalizeEmail,
  normalizeOtp,
  validateDisplayName,
  validateEmail,
  validateOtp,
  validatePassword,
} from '../../../backend/src/shared/signupValidation'
import {
  elevation,
  fonts,
  spacing,
} from '../theme/tokens'

type Mode = 'login' | 'register'
type RegisterStep = 'dob' | 'account' | 'terms'
type AccountField = 'name' | 'email' | 'password'
type FieldErrors = Partial<Record<SignupField, string>>
type FeatherName = React.ComponentProps<typeof Feather>['name']

const APP_LOGO = require('../../assets/logo.png')

const REGISTER_STEPS: {
  key: RegisterStep
  label: string
}[] = [
  { key: 'dob', label: 'Age' },
  { key: 'account', label: 'Account' },
  { key: 'terms', label: 'Finish' },
]

function calculateAge(dateOfBirth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null

  const dob = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return null

  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDifference = now.getMonth() - dob.getMonth()

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && now.getDate() < dob.getDate())
  ) {
    age -= 1
  }

  return age
}

interface AuthFieldProps {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  icon: FeatherName
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'number-pad'
    | 'numbers-and-punctuation'
  autoCapitalize?: 'none' | 'sentences' | 'words'
  textContentType?:
    | 'emailAddress'
    | 'password'
    | 'newPassword'
    | 'name'
    | 'oneTimeCode'
  secureTextEntry?: boolean
  rightAction?: React.ReactNode
  maxLength?: number
  autoComplete?: TextInputProps['autoComplete']
  onBlur?: () => void
  /** Inline validation error shown directly under the input. */
  error?: string
}

function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  textContentType,
  secureTextEntry,
  rightAction,
  maxLength,
  autoComplete,
  onBlur,
  error,
}: AuthFieldProps): React.JSX.Element {
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.fieldWrap}>
      <Text allowFontScaling={false} style={styles.fieldLabel}>
        {label}
      </Text>

      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
        ]}
      >
        <View style={styles.inputIcon}>
          <Feather
            name={icon}
            size={17}
            color={focused ? '#A996FF' : '#71829C'}
          />
        </View>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#566781"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          textContentType={textContentType}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          autoComplete={autoComplete}
          accessibilityLabel={label}
          accessibilityHint={error}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            onBlur?.()
          }}
        />

        {rightAction}
      </View>

      {error ? (
        <Text
          style={styles.fieldErrorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  )
}

interface ActionButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  icon?: FeatherName
  variant?: 'primary' | 'secondary' | 'ghost'
}

function ActionButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = 'primary',
}: ActionButtonProps): React.JSX.Element {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' && styles.primaryButton,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'ghost' && styles.ghostButton,
        pressed && !disabled && !loading && styles.actionButtonPressed,
        (disabled || loading) && styles.actionButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : '#BFAFFF'}
        />
      ) : icon ? (
        <Feather
          name={icon}
          size={16}
          color={variant === 'primary' ? '#FFFFFF' : '#BFAFFF'}
        />
      ) : null}

      <Text
        allowFontScaling={false}
        style={[
          styles.actionButtonText,
          variant !== 'primary' && styles.secondaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

interface ErrorBannerProps {
  message: string
}

function ErrorBanner({ message }: ErrorBannerProps): React.JSX.Element {
  return (
    <View style={styles.errorBanner}>
      <View style={styles.errorIcon}>
        <Feather name="alert-circle" size={16} color="#FF8185" />
      </View>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  )
}

interface CheckboxRowProps {
  checked: boolean
  onToggle: () => void
  label: string
  subtitle: string
}

function CheckboxRow({
  checked,
  onToggle,
  label,
  subtitle,
}: CheckboxRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.checkboxRow,
        pressed && styles.checkboxRowPressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.checkboxBox,
          checked && styles.checkboxBoxChecked,
        ]}
      >
        {checked ? (
          <Feather name="check" size={14} color="#FFFFFF" />
        ) : null}
      </View>

      <View style={styles.checkboxCopy}>
        <Text allowFontScaling={false} style={styles.checkboxLabel}>
          {label}
        </Text>
        <Text style={styles.checkboxSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  )
}

export default function LoginScreen(): React.JSX.Element {
  const { signIn, register, signInWithGoogle } = useAuth()

  const [mode, setMode] = useState<Mode>('login')

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  const [registerStep, setRegisterStep] = useState<RegisterStep>('dob')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [coppaBlocked, setCoppaBlocked] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpReused, setOtpReused] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  // Blocks double-taps within the same tick, before the loading state renders.
  const inFlight = useRef(false)
  const [acceptedTos, setAcceptedTos] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerLoading, setRegisterLoading] = useState(false)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const registerStepIndex = useMemo(
    () => REGISTER_STEPS.findIndex((step) => step.key === registerStep),
    [registerStep],
  )

  function switchMode(nextMode: Mode): void {
    setMode(nextMode)
    setLoginError(null)
    setRegisterError(null)
    setGoogleError(null)
  }

  async function handleLogin(): Promise<void> {
    const normalizedEmail = loginEmail.trim()

    if (!normalizedEmail || !loginPassword) {
      setLoginError('Enter your email and password.')
      return
    }

    setLoginError(null)
    setLoginLoading(true)

    try {
      await signIn({
        email: normalizedEmail,
        password: loginPassword,
      })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === 'ACCOUNT_LOCKED') {
          const seconds = (
            error.raw as { secondsRemaining?: number }
          )?.secondsRemaining
          const minutes = seconds ? Math.ceil(seconds / 60) : null

          setLoginError(
            minutes
              ? `Account locked. Try again in ${minutes} minute(s).`
              : error.message,
          )
        } else {
          setLoginError(error.message)
        }
      } else {
        setLoginError('Something went wrong. Please try again.')
      }
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleGoogleSignIn(): Promise<void> {
    setGoogleError(null)
    setGoogleLoading(true)

    try {
      await signInWithGoogle(mode === 'login' ? 'login' : 'signup')
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === 'OAUTH_CANCELLED'
      ) {
        return
      }

      setGoogleError(
        error instanceof ApiRequestError
          ? error.message
          : 'Google sign-in failed. Please try again.',
      )
    } finally {
      setGoogleLoading(false)
    }
  }

  function accountFieldError(
    field: AccountField,
    values = { name, email, password },
  ): string | null {
    switch (field) {
      case 'name':
        return validateDisplayName(values.name, false)
      case 'email':
        return validateEmail(values.email)
      case 'password':
        return validatePassword(values.password)
    }
  }

  function validateAccountFields(): FieldErrors {
    const errors: FieldErrors = {}
    for (const field of ['name', 'email', 'password'] as const) {
      const message = accountFieldError(field)
      if (message) errors[field] = message
    }
    return errors
  }

  // Re-checks a field only if it already shows an error, so the error clears
  // as soon as the value is valid; new errors appear on blur or submit.
  function updateAccountField(
    field: AccountField,
    value: string,
    setter: (value: string) => void,
  ): void {
    setter(value)
    setFieldErrors((prev) => {
      if (prev[field] === undefined) return prev
      const next = { ...prev }
      const message = accountFieldError(field, { name, email, password, [field]: value })
      if (message) next[field] = message
      else delete next[field]
      return next
    })
  }

  function blurAccountField(field: AccountField): void {
    const message = accountFieldError(field)
    if (message) setFieldErrors((prev) => ({ ...prev, [field]: message }))
  }

  function accountPayload() {
    return {
      email: normalizeEmail(email),
      password,
      name: name.trim() || undefined,
      dateOfBirth,
    }
  }

  // Routes a server error back to the step and field that caused it.
  function applySignupError(error: unknown): void {
    if (error instanceof ApiRequestError && isSignupField(error.field)) {
      const field = error.field
      setRegisterError(null)
      if (field === 'dateOfBirth') {
        setRegisterStep('dob')
        setFieldErrors((prev) => ({ ...prev, dateOfBirth: error.message }))
      } else if (field === 'otp') {
        setRegisterStep('account')
        setOtpError(error.message)
      } else {
        setRegisterStep('account')
        setFieldErrors((prev) => ({ ...prev, [field]: error.message }))
      }
      return
    }

    setRegisterError(
      error instanceof ApiRequestError
        ? error.message
        : 'Something went wrong. Please try again.',
    )
  }

  function handleDobContinue(): void {
    const age = calculateAge(dateOfBirth)

    if (age === null) {
      setFieldErrors((prev) => ({
        ...prev,
        dateOfBirth: 'Enter your date of birth as YYYY-MM-DD.',
      }))
      return
    }

    if (age < 13) {
      setCoppaBlocked(true)
      setRegisterError(null)
      return
    }

    setCoppaBlocked(false)
    setRegisterError(null)
    setRegisterStep('account')
  }

  async function handleSendOtp(): Promise<void> {
    if (inFlight.current) return

    const errors = validateAccountFields()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    inFlight.current = true
    setRegisterError(null)
    setOtpError(null)
    setOtpLoading(true)

    try {
      // Server validates every account field before emailing a code
      const result = await authApi.sendOtp(accountPayload())
      setOtpSent(true)
      setOtpReused(!result.sent)
      setResendIn(result.resendAvailableInSeconds)
    } catch (error) {
      applySignupError(error)
    } finally {
      setOtpLoading(false)
      inFlight.current = false
    }
  }

  async function handleAccountContinue(): Promise<void> {
    if (inFlight.current) return

    const errors = validateAccountFields()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const codeError = validateOtp(otp)
    if (codeError) {
      setOtpError(codeError)
      return
    }

    inFlight.current = true
    setRegisterError(null)
    setOtpError(null)
    setVerifyLoading(true)

    try {
      await authApi.verifyOtp({ ...accountPayload(), otp })
      setRegisterStep('terms')
    } catch (error) {
      applySignupError(error)
    } finally {
      setVerifyLoading(false)
      inFlight.current = false
    }
  }

  async function handleRegisterSubmit(): Promise<void> {
    if (inFlight.current) return

    if (!acceptedTos || !acceptedPrivacy) {
      setRegisterError(
        'You must accept the Terms of Service and Privacy Policy.',
      )
      return
    }

    inFlight.current = true
    setRegisterError(null)
    setRegisterLoading(true)

    try {
      await register({
        ...accountPayload(),
        otp,
        agreedTos: true,
        agreedPrivacy: true,
        agreedAge: true,
      })
    } catch (error) {
      applySignupError(error)
    } finally {
      setRegisterLoading(false)
      inFlight.current = false
    }
  }

  function goBackRegisterStep(): void {
    setRegisterError(null)

    if (registerStep === 'terms') {
      setRegisterStep('account')
      return
    }

    if (registerStep === 'account') {
      setRegisterStep('dob')
      return
    }

    switchMode('login')
  }

  const currentError =
    mode === 'login' ? loginError || googleError : registerError || googleError

  const accountStepInvalid = Object.keys(validateAccountFields()).length > 0

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View pointerEvents="none" style={styles.backgroundTopAccent} />
      <View pointerEvents="none" style={styles.backgroundBottomAccent} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandHeader}>
          <View style={styles.logoShell}>
            <Image
              source={APP_LOGO}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.brandCopy}>
            <Text allowFontScaling={false} style={styles.brandName}>
              myFuturely
            </Text>
            <Text allowFontScaling={false} style={styles.brandTag}>
              AI academic copilot
            </Text>
          </View>

          <View style={styles.securePill}>
            <Feather name="shield" size={12} color="#69DAB8" />
            <Text allowFontScaling={false} style={styles.securePillText}>
              Secure
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text allowFontScaling={false} style={styles.heroEyebrow}>
            YOUR FUTURE, ONE STEP CLOSER
          </Text>

          <Text allowFontScaling={false} style={styles.heroTitle}>
            Plan smarter.{'\n'}
            <Text style={styles.heroTitleAccent}>Move forward.</Text>
          </Text>

          <Text style={styles.heroSubtitle}>
            Keep grades, assignments, college planning and personalized AI
            guidance together in one place.
          </Text>
        </View>

        <View style={styles.featureRow}>
          <View style={styles.featureChip}>
            <Feather name="bar-chart-2" size={14} color="#62D9BB" />
            <Text allowFontScaling={false} style={styles.featureChipText}>
              Live grades
            </Text>
          </View>

          <View style={styles.featureChip}>
            <Feather name="calendar" size={14} color="#78AFFF" />
            <Text allowFontScaling={false} style={styles.featureChipText}>
              Smart planner
            </Text>
          </View>

          <View style={styles.featureChip}>
            <Feather name="zap" size={14} color="#B69AFF" />
            <Text allowFontScaling={false} style={styles.featureChipText}>
              AI guidance
            </Text>
          </View>
        </View>

        <View style={styles.authCard}>
          <View style={styles.modeSwitch}>
            <Pressable
              onPress={() => switchMode('login')}
              style={[
                styles.modeButton,
                mode === 'login' && styles.modeButtonActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'login' }}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.modeButtonText,
                  mode === 'login' && styles.modeButtonTextActive,
                ]}
              >
                Sign in
              </Text>
            </Pressable>

            <Pressable
              onPress={() => switchMode('register')}
              style={[
                styles.modeButton,
                mode === 'register' && styles.modeButtonActive,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'register' }}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.modeButtonText,
                  mode === 'register' && styles.modeButtonTextActive,
                ]}
              >
                Create account
              </Text>
            </Pressable>
          </View>

          <View style={styles.formHeader}>
            <View style={styles.formHeaderCopy}>
              <Text allowFontScaling={false} style={styles.formEyebrow}>
                {mode === 'login' ? 'WELCOME BACK' : 'JOIN MYFUTURELY'}
              </Text>

              <Text allowFontScaling={false} style={styles.formTitle}>
                {mode === 'login'
                  ? 'Continue your journey'
                  : registerStep === 'dob'
                    ? 'Let’s get started'
                    : registerStep === 'account'
                      ? 'Create your account'
                      : 'Review and finish'}
              </Text>

              <Text style={styles.formSubtitle}>
                {mode === 'login'
                  ? 'Sign in to access your academic command center.'
                  : registerStep === 'dob'
                    ? 'We use your age to keep your account safe.'
                    : registerStep === 'account'
                      ? 'Verify your email to protect your student profile.'
                      : 'Confirm the final details before creating your account.'}
              </Text>
            </View>

            <View style={styles.formIcon}>
              <Feather
                name={mode === 'login' ? 'log-in' : 'user-plus'}
                size={19}
                color="#B9A5FF"
              />
            </View>
          </View>

          {mode === 'register' ? (
            <View style={styles.stepProgress}>
              {REGISTER_STEPS.map((step, index) => {
                const complete = index < registerStepIndex
                const active = index === registerStepIndex

                return (
                  <React.Fragment key={step.key}>
                    <View style={styles.stepItem}>
                      <View
                        style={[
                          styles.stepCircle,
                          complete && styles.stepCircleComplete,
                          active && styles.stepCircleActive,
                        ]}
                      >
                        {complete ? (
                          <Feather
                            name="check"
                            size={12}
                            color="#FFFFFF"
                          />
                        ) : (
                          <Text
                            allowFontScaling={false}
                            style={[
                              styles.stepNumber,
                              active && styles.stepNumberActive,
                            ]}
                          >
                            {index + 1}
                          </Text>
                        )}
                      </View>

                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.stepLabel,
                          active && styles.stepLabelActive,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>

                    {index < REGISTER_STEPS.length - 1 ? (
                      <View
                        style={[
                          styles.stepLine,
                          complete && styles.stepLineComplete,
                        ]}
                      />
                    ) : null}
                  </React.Fragment>
                )
              })}
            </View>
          ) : null}

          <Pressable
            onPress={() => void handleGoogleSignIn()}
            disabled={googleLoading}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && !googleLoading && styles.googleButtonPressed,
              googleLoading && styles.actionButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#12141D" />
            ) : (
              <GoogleLogo size={19} />
            )}

            <Text
              allowFontScaling={false}
              style={styles.googleButtonText}
            >
              {googleLoading
                ? 'Opening Google…'
                : mode === 'login'
                  ? 'Sign in with Google'
                  : 'Continue with Google'}
            </Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text allowFontScaling={false} style={styles.dividerText}>
              OR CONTINUE WITH EMAIL
            </Text>
            <View style={styles.dividerLine} />
          </View>

          {mode === 'login' ? (
            <View style={styles.form}>
              <AuthField
                label="Email address"
                value={loginEmail}
                onChangeText={setLoginEmail}
                placeholder="you@example.com"
                icon="mail"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
              />

              <AuthField
                label="Password"
                value={loginPassword}
                onChangeText={setLoginPassword}
                placeholder="Enter your password"
                icon="lock"
                secureTextEntry={!showLoginPassword}
                autoCapitalize="none"
                textContentType="password"
                rightAction={
                  <Pressable
                    onPress={() =>
                      setShowLoginPassword((current) => !current)
                    }
                    style={styles.visibilityButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showLoginPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    <Feather
                      name={showLoginPassword ? 'eye-off' : 'eye'}
                      size={17}
                      color="#7D8EA7"
                    />
                  </Pressable>
                }
              />

              {currentError ? <ErrorBanner message={currentError} /> : null}

              <ActionButton
                label="Sign in"
                icon="arrow-right"
                onPress={() => void handleLogin()}
                loading={loginLoading}
              />

              <View style={styles.trustRow}>
                <Feather name="lock" size={12} color="#71839E" />
                <Text style={styles.trustText}>
                  Your academic data stays private and protected.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              {registerStep === 'dob' ? (
                <>
                  <AuthField
                    label="Date of birth"
                    value={dateOfBirth}
                    onChangeText={(value) => {
                      setDateOfBirth(value)
                      setCoppaBlocked(false)
                      setRegisterError(null)
                      setFieldErrors((prev) => ({ ...prev, dateOfBirth: undefined }))
                    }}
                    onBlur={() => {
                      if (dateOfBirth && calculateAge(dateOfBirth) === null) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          dateOfBirth: 'Enter your date of birth as YYYY-MM-DD.',
                        }))
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                    icon="calendar"
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                    maxLength={10}
                    error={fieldErrors.dateOfBirth}
                  />

                  <View style={styles.infoBanner}>
                    <View style={styles.infoIcon}>
                      <Feather
                        name="shield"
                        size={16}
                        color="#78AFFF"
                      />
                    </View>
                    <Text style={styles.infoText}>
                      Students must be at least 13 years old to create an
                      account.
                    </Text>
                  </View>

                  {coppaBlocked ? (
                    <ErrorBanner message="You must be at least 13 years old. Please ask a parent or guardian for help." />
                  ) : currentError ? (
                    <ErrorBanner message={currentError} />
                  ) : null}

                  <ActionButton
                    label="Continue"
                    icon="arrow-right"
                    onPress={handleDobContinue}
                    disabled={coppaBlocked || calculateAge(dateOfBirth) === null}
                  />
                </>
              ) : null}

              {registerStep === 'account' ? (
                <>
                  <AuthField
                    label="Display name"
                    value={name}
                    onChangeText={(value) =>
                      updateAccountField('name', value, setName)
                    }
                    onBlur={() => blurAccountField('name')}
                    placeholder="What should we call you?"
                    icon="user"
                    autoCapitalize="words"
                    textContentType="name"
                    error={fieldErrors.name}
                  />

                  <AuthField
                    label="Email address"
                    value={email}
                    onChangeText={(value) => {
                      updateAccountField('email', value, setEmail)
                      setOtpSent(false)
                      setOtp('')
                      setOtpError(null)
                      setResendIn(0)
                    }}
                    onBlur={() => blurAccountField('email')}
                    placeholder="you@example.com"
                    icon="mail"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textContentType="emailAddress"
                    autoComplete="email"
                    error={fieldErrors.email}
                  />

                  <AuthField
                    label="Password"
                    value={password}
                    onChangeText={(value) => {
                      updateAccountField('password', value, setPassword)
                      setOtpSent(false)
                      setOtp('')
                      setOtpError(null)
                    }}
                    onBlur={() => blurAccountField('password')}
                    placeholder={PASSWORD_PLACEHOLDER}
                    icon="lock"
                    secureTextEntry={!showRegisterPassword}
                    autoCapitalize="none"
                    textContentType="newPassword"
                    autoComplete="new-password"
                    error={fieldErrors.password}
                    rightAction={
                      <Pressable
                        onPress={() =>
                          setShowRegisterPassword((current) => !current)
                        }
                        style={styles.visibilityButton}
                        accessibilityRole="button"
                        accessibilityLabel={
                          showRegisterPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                      >
                        <Feather
                          name={
                            showRegisterPassword ? 'eye-off' : 'eye'
                          }
                          size={17}
                          color="#7D8EA7"
                        />
                      </Pressable>
                    }
                  />

                  {PASSWORD_REQUIREMENTS.map((requirement) => (
                    <View key={requirement.id} style={styles.passwordHint}>
                      <View
                        style={[
                          styles.passwordDot,
                          requirement.test(password) &&
                            styles.passwordDotComplete,
                        ]}
                      />
                      <Text style={styles.passwordHintText}>
                        {requirement.label}
                      </Text>
                    </View>
                  ))}

                  {otpSent ? (
                    // No maxLength: it would truncate a pasted "123 456"
                    // before normalizeOtp strips the non-digits.
                    <AuthField
                      label="Verification code"
                      value={otp}
                      onChangeText={(value) => {
                        setOtp(normalizeOtp(value))
                        setOtpError(null)
                      }}
                      placeholder={`${OTP_LENGTH}-digit code`}
                      icon="key"
                      keyboardType="number-pad"
                      autoCapitalize="none"
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      error={otpError ?? undefined}
                    />
                  ) : null}

                  {otpSent ? (
                    <View style={styles.codeSentBanner}>
                      <Feather
                        name="check-circle"
                        size={15}
                        color="#5ED6AE"
                      />
                      <Text style={styles.codeSentText}>
                        {otpReused
                          ? `A code was already sent to ${email.trim()} and is still valid.`
                          : `Verification code sent to ${email.trim()}.`}
                      </Text>
                    </View>
                  ) : null}

                  {currentError ? <ErrorBanner message={currentError} /> : null}

                  <ActionButton
                    label={
                      !otpSent
                        ? 'Send verification code'
                        : resendIn > 0
                          ? `Resend code in ${resendIn}s`
                          : 'Resend verification code'
                    }
                    icon={otpSent ? 'refresh-cw' : 'send'}
                    onPress={() => void handleSendOtp()}
                    loading={otpLoading}
                    disabled={
                      accountStepInvalid || (otpSent && resendIn > 0)
                    }
                    variant="secondary"
                  />

                  <ActionButton
                    label="Continue"
                    icon="arrow-right"
                    onPress={() => void handleAccountContinue()}
                    loading={verifyLoading}
                    disabled={
                      accountStepInvalid ||
                      !otpSent ||
                      otp.length !== OTP_LENGTH
                    }
                  />
                </>
              ) : null}

              {registerStep === 'terms' ? (
                <>
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryIcon}>
                      <Feather name="user" size={19} color="#B9A5FF" />
                    </View>
                    <View style={styles.summaryCopy}>
                      <Text
                        allowFontScaling={false}
                        style={styles.summaryTitle}
                      >
                        {name.trim() || 'New myFuturely student'}
                      </Text>
                      <Text
                        allowFontScaling={false}
                        style={styles.summaryEmail}
                      >
                        {email.trim()}
                      </Text>
                    </View>
                    <Feather name="check-circle" size={18} color="#5ED6AE" />
                  </View>

                  <CheckboxRow
                    checked={acceptedTos}
                    onToggle={() => setAcceptedTos((current) => !current)}
                    label="Terms of Service"
                    subtitle="I agree to use myFuturely responsibly."
                  />

                  <CheckboxRow
                    checked={acceptedPrivacy}
                    onToggle={() =>
                      setAcceptedPrivacy((current) => !current)
                    }
                    label="Privacy Policy"
                    subtitle="I understand how my information is handled."
                  />

                  {currentError ? <ErrorBanner message={currentError} /> : null}

                  <ActionButton
                    label="Create my account"
                    icon="check"
                    onPress={() => void handleRegisterSubmit()}
                    loading={registerLoading}
                    disabled={!acceptedTos || !acceptedPrivacy}
                  />
                </>
              ) : null}

              <ActionButton
                label={
                  registerStep === 'dob'
                    ? 'Back to sign in'
                    : 'Back'
                }
                icon="arrow-left"
                onPress={goBackRegisterStep}
                variant="ghost"
              />
            </View>
          )}
        </View>

        <Text style={styles.footerText}>
          By continuing, you’re joining a student-first platform designed
          to help you make confident academic decisions.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#02040B',
  },
  backgroundTopAccent: {
    position: 'absolute',
    top: -120,
    right: -145,
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: '#14103A',
    opacity: 0.72,
  },
  backgroundBottomAccent: {
    position: 'absolute',
    bottom: -170,
    left: -180,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#071D2B',
    opacity: 0.62,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: Platform.OS === 'android' ? 34 : 22,
    paddingBottom: 30,
    gap: 18,
  },

  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoShell: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#071528',
    borderWidth: 1,
    borderColor: '#1A4D6B',
    ...elevation.sm,
  },
  logo: {
    width: 38,
    height: 38,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    color: '#F4F6FF',
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandTag: {
    marginTop: 1,
    color: '#71839F',
    fontFamily: fonts.regular,
    fontSize: 9.5,
    lineHeight: 13,
  },
  securePill: {
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  securePillText: {
    color: '#69DAB8',
    fontFamily: fonts.bold,
    fontSize: 8.5,
    fontWeight: '700',
  },

  hero: {
    gap: 6,
  },
  heroEyebrow: {
    color: '#7D92BA',
    fontFamily: fonts.bold,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#F5F7FF',
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  heroTitleAccent: {
    color: '#A78BFA',
  },
  heroSubtitle: {
    maxWidth: 345,
    color: '#8B9AB0',
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
  },

  featureRow: {
    flexDirection: 'row',
    gap: 7,
  },
  featureChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#0B1422',
    borderWidth: 1,
    borderColor: '#1D3049',
  },
  featureChipText: {
    color: '#A4B1C5',
    fontFamily: fonts.semiBold,
    fontSize: 8.2,
    fontWeight: '600',
  },

  authCard: {
    gap: 16,
    padding: 15,
    borderRadius: 22,
    backgroundColor: '#0C1422',
    borderWidth: 1,
    borderColor: '#263B58',
    ...elevation.md,
  },
  modeSwitch: {
    minHeight: 44,
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    backgroundColor: '#070D17',
    borderWidth: 1,
    borderColor: '#1D2B40',
  },
  modeButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: '#21184A',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  modeButtonText: {
    color: '#71819A',
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: '700',
  },
  modeButtonTextActive: {
    color: '#D1C5FF',
  },

  formHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  formHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  formEyebrow: {
    color: '#7892BB',
    fontFamily: fonts.bold,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  formTitle: {
    marginTop: 2,
    color: '#F4F6FF',
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  formSubtitle: {
    marginTop: 4,
    color: '#7D8DA5',
    fontFamily: fonts.regular,
    fontSize: 9.8,
    lineHeight: 14,
  },
  formIcon: {
    width: 39,
    height: 39,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#21184A',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
  },

  stepProgress: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#111B2B',
    borderWidth: 1,
    borderColor: '#2A3C56',
  },
  stepCircleActive: {
    backgroundColor: '#6741DE',
    borderColor: '#8D6BFF',
  },
  stepCircleComplete: {
    backgroundColor: '#168765',
    borderColor: '#34B38D',
  },
  stepNumber: {
    color: '#71819A',
    fontFamily: fonts.bold,
    fontSize: 8.5,
    fontWeight: '700',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    color: '#64758F',
    fontFamily: fonts.medium,
    fontSize: 7.5,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#C7B9FF',
  },
  stepLine: {
    flex: 1,
    height: 1,
    maxWidth: 58,
    minWidth: 36,
    marginHorizontal: 7,
    marginBottom: 16,
    backgroundColor: '#24354D',
  },
  stepLineComplete: {
    backgroundColor: '#2FA67F',
  },

  googleButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#F8F9FC',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  googleButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  googleButtonText: {
    color: '#12141D',
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: '700',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#22324A',
  },
  dividerText: {
    color: '#60718C',
    fontFamily: fonts.bold,
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0.65,
  },

  form: {
    gap: 13,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: '#8798B2',
    fontFamily: fonts.bold,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  inputShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#080F1A',
    borderWidth: 1,
    borderColor: '#263954',
  },
  inputShellFocused: {
    borderColor: '#7555E8',
    backgroundColor: '#0A1120',
  },
  inputIcon: {
    width: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 50,
    paddingVertical: 0,
    paddingRight: 10,
    color: '#F1F4FC',
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  visibilityButton: {
    width: 43,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionButton: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: '#7048F4',
    borderColor: '#8565FF',
  },
  secondaryButton: {
    backgroundColor: '#151F31',
    borderColor: '#304764',
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  actionButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 10.5,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#C3B5FA',
  },

  errorBanner: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(255,99,103,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,99,103,0.25)',
  },
  errorIcon: {
    width: 29,
    height: 29,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,99,103,0.10)',
  },
  errorText: {
    flex: 1,
    color: '#E7A1A4',
    fontFamily: fonts.regular,
    fontSize: 9.5,
    lineHeight: 13.5,
  },

  infoBanner: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(59,130,246,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  infoIcon: {
    width: 31,
    height: 31,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.10)',
  },
  infoText: {
    flex: 1,
    color: '#91A5C2',
    fontFamily: fonts.regular,
    fontSize: 9.2,
    lineHeight: 13.5,
  },

  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },
  passwordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#485B76',
  },
  passwordDotComplete: {
    backgroundColor: '#36C595',
  },
  fieldErrorText: {
    paddingLeft: 2,
    color: '#FF8185',
    fontFamily: fonts.regular,
    fontSize: 9.5,
    lineHeight: 13.5,
  },
  passwordHintText: {
    color: '#6F809A',
    fontFamily: fonts.regular,
    fontSize: 8.5,
  },

  codeSentBanner: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.22)',
  },
  codeSentText: {
    flex: 1,
    color: '#8FC9B5',
    fontFamily: fonts.regular,
    fontSize: 8.8,
    lineHeight: 12,
  },

  summaryCard: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 14,
    backgroundColor: '#141F33',
    borderWidth: 1,
    borderColor: '#2A4160',
  },
  summaryIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#21184A',
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryTitle: {
    color: '#EDF1FA',
    fontFamily: fonts.semiBold,
    fontSize: 10.5,
    fontWeight: '600',
  },
  summaryEmail: {
    color: '#7C8EA8',
    fontFamily: fonts.regular,
    fontSize: 8.8,
  },

  checkboxRow: {
    minHeight: 63,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 13,
    backgroundColor: '#101A2A',
    borderWidth: 1,
    borderColor: '#273D59',
  },
  checkboxRowPressed: {
    opacity: 0.86,
  },
  checkboxBox: {
    width: 23,
    height: 23,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: '#09111D',
    borderWidth: 1,
    borderColor: '#3A4C65',
  },
  checkboxBoxChecked: {
    backgroundColor: '#7048F4',
    borderColor: '#8D71FF',
  },
  checkboxCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  checkboxLabel: {
    color: '#EBEFF8',
    fontFamily: fonts.semiBold,
    fontSize: 10.5,
    fontWeight: '600',
  },
  checkboxSubtitle: {
    color: '#71829A',
    fontFamily: fonts.regular,
    fontSize: 8.5,
    lineHeight: 12,
  },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trustText: {
    color: '#667791',
    fontFamily: fonts.regular,
    fontSize: 8.2,
    lineHeight: 11,
    textAlign: 'center',
  },

  footerText: {
    maxWidth: 330,
    alignSelf: 'center',
    color: '#586A84',
    fontFamily: fonts.regular,
    fontSize: 8.2,
    lineHeight: 12,
    textAlign: 'center',
  },
})
