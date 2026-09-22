import React, { useMemo, useState } from 'react'
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
  View,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

import { useAuth } from '../context/AuthContext'
import * as authApi from '../api/authApi'
import { ApiRequestError } from '../api/client'
import { GoogleLogo } from '../components/ui/GoogleLogo'
import { LinkIcon } from '../components/icons'
import { Card } from '../components/ui/Card'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Screen } from '../components/ui/Screen'
import {
  colors,
  elevation,
  fonts,
  radii,
  spacing,
  typography,
  touchTarget,
} from '../theme/tokens'

type Mode = 'login' | 'register'
type AccountType = 'Student' | 'Parent'
type RegisterStep = 'dob' | 'account' | 'terms'
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

type ModeLabel = 'Sign in' | 'Create account'

const MODE_LABEL_SEGMENTS: readonly ModeLabel[] = ['Sign in', 'Create account']
const MODE_VALUE_TO_LABEL: Record<Mode, ModeLabel> = {
  login: 'Sign in',
  register: 'Create account',
}
const MODE_LABEL_TO_VALUE: Record<ModeLabel, Mode> = {
  'Sign in': 'login',
  'Create account': 'register',
}

const ACCOUNT_TYPE_SEGMENTS: readonly AccountType[] = ['Student', 'Parent']

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
}: AuthFieldProps): React.JSX.Element {
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>

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
            color={focused ? colors.accent : colors.textFaint}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          textContentType={textContentType}
          secureTextEntry={secureTextEntry}
          maxLength={maxLength}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
        />

        {rightAction}
      </View>
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
  const isDisabled = disabled === true || loading === true

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'primary' && styles.primaryButton,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'ghost' && styles.ghostButton,
        pressed && !isDisabled && styles.actionButtonPressed,
        isDisabled && styles.actionButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : colors.accent}
        />
      ) : icon !== undefined ? (
        <Feather
          name={icon}
          size={16}
          color={variant === 'primary' ? '#FFFFFF' : colors.textDim}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}

      <Text
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
    <View style={styles.errorBanner} accessibilityRole="alert">
      <View style={styles.errorIcon}>
        <Feather
          name="alert-circle"
          size={16}
          color={colors.tierRed}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
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
          <Feather
            name="check"
            size={14}
            color="#FFFFFF"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ) : null}
      </View>

      <View style={styles.checkboxCopy}>
        <Text style={styles.checkboxLabel}>{label}</Text>
        <Text style={styles.checkboxSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// "Connect school account" placeholder box — Sign Up mode only
// Visual placeholder — no navigation, no OAuth, no API call.
// ---------------------------------------------------------------------------

function ConnectSchoolPlaceholder(): React.JSX.Element {
  return (
    <View style={styles.connectSchoolBox} accessibilityRole="none">
      <View style={styles.connectSchoolHeader}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <LinkIcon size={16} color={colors.accent} />
        </View>
        <Text style={styles.connectSchoolTitle}>School Account</Text>
        <View style={styles.requiredBadge}>
          <Text style={styles.requiredBadgeText}>Required</Text>
        </View>
      </View>

      <Text style={styles.connectSchoolBody}>
        {"Connect your school's portal so we can sync grades and assignments automatically."}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.connectSchoolButton,
          pressed && styles.connectSchoolButtonPressed,
        ]}
        onPress={() => {
          // Placeholder — OAuth/integration wiring handled separately via
          // RootNavigator's hasPortalConnection gate (post-signup flow).
        }}
        accessibilityRole="button"
        accessibilityLabel="Connect HAC, Canvas, or district SIS"
      >
        <Feather
          name="external-link"
          size={14}
          color={colors.accent}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text style={styles.connectSchoolButtonText}>
          Connect HAC, Canvas, or district SIS
        </Text>
      </Pressable>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function LoginScreen(): React.JSX.Element {
  const { signIn, register, signInWithGoogle } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [accountType, setAccountType] = useState<AccountType>('Student')

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
  const [otpLoading, setOtpLoading] = useState(false)
  const [acceptedTos, setAcceptedTos] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerLoading, setRegisterLoading] = useState(false)

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

  function handleDobContinue(): void {
    const age = calculateAge(dateOfBirth)

    if (age === null) {
      setRegisterError('Enter your date of birth as YYYY-MM-DD.')
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
    const normalizedEmail = email.trim()

    if (!normalizedEmail || !password) {
      setRegisterError('Enter your email and password first.')
      return
    }

    if (password.length < 8) {
      setRegisterError('Use a password with at least 8 characters.')
      return
    }

    setRegisterError(null)
    setOtpLoading(true)

    try {
      await authApi.sendOtp({ email: normalizedEmail })
      setOtpSent(true)
    } catch (error) {
      setRegisterError(
        error instanceof ApiRequestError
          ? error.message
          : 'Could not send code. Try again.',
      )
    } finally {
      setOtpLoading(false)
    }
  }

  function handleAccountContinue(): void {
    if (!otpSent || !otp.trim()) {
      setRegisterError('Enter the verification code sent to your email.')
      return
    }

    setRegisterError(null)
    setRegisterStep('terms')
  }

  async function handleRegisterSubmit(): Promise<void> {
    if (!acceptedTos || !acceptedPrivacy) {
      setRegisterError(
        'You must accept the Terms of Service and Privacy Policy.',
      )
      return
    }

    setRegisterError(null)
    setRegisterLoading(true)

    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
        otp: otp.trim(),
        dateOfBirth,
        agreedTos: true,
        agreedPrivacy: true,
        agreedAge: true,
      })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const messages: Record<string, string> = {
          COPPA_BLOCK:
            'You must be at least 13 years old to create an account.',
          CONFLICT: 'An account with this email already exists.',
          NAME_TAKEN: 'That display name is already taken.',
          INVALID_OTP:
            'That code is incorrect or has expired. Request a new one.',
          OTP_REQUIRED:
            'Enter the verification code sent to your email.',
        }

        setRegisterError(
          (error.code && messages[error.code]) || error.message,
        )
      } else {
        setRegisterError('Something went wrong. Please try again.')
      }
    } finally {
      setRegisterLoading(false)
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

  return (
    <Screen padded={false} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoShell}>
              <Image
                source={APP_LOGO}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Futurely app logo"
              />
            </View>

            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>myFuturely</Text>
              <Text style={styles.brandTag}>AI academic copilot</Text>
            </View>

            <View style={styles.securePill}>
              <Feather
                name="shield"
                size={12}
                color={colors.accent2}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={styles.securePillText}>Secure</Text>
            </View>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>YOUR FUTURE, ONE STEP CLOSER</Text>
            <Text style={styles.heroTitle}>
              Plan smarter.{'\n'}
              <Text style={styles.heroTitleAccent}>Move forward.</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Keep grades, assignments, college planning and personalized AI
              guidance together in one place.
            </Text>
          </View>

          {/* Feature chips */}
          <View style={styles.featureRow}>
            <View style={styles.featureChip}>
              <Feather
                name="bar-chart-2"
                size={14}
                color={colors.accent2}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={styles.featureChipText}>Live grades</Text>
            </View>

            <View style={styles.featureChip}>
              <Feather
                name="calendar"
                size={14}
                color={colors.accent}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={styles.featureChipText}>Smart planner</Text>
            </View>

            <View style={styles.featureChip}>
              <Feather
                name="zap"
                size={14}
                color={colors.purple}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
              <Text style={styles.featureChipText}>AI guidance</Text>
            </View>
          </View>

          {/* Auth card */}
          <Card variant="glass" disableBlur={Platform.OS === 'android'} style={styles.authCardInner}>
            {/* Log In / Sign Up mode toggle */}
            <SegmentedControl
              segments={MODE_LABEL_SEGMENTS}
              value={MODE_VALUE_TO_LABEL[mode]}
              onChange={(label) => switchMode(MODE_LABEL_TO_VALUE[label])}
            />

            {/* Student / Parent toggle */}
            <SegmentedControl
              segments={ACCOUNT_TYPE_SEGMENTS}
              value={accountType}
              onChange={setAccountType}
            />

            {/* Form header */}
            <View style={styles.formHeader}>
              <View style={styles.formHeaderCopy}>
                <Text style={styles.formEyebrow}>
                  {mode === 'login' ? 'WELCOME BACK' : 'JOIN MYFUTURELY'}
                </Text>

                <Text style={styles.formTitle}>
                  {mode === 'login'
                    ? 'Continue your journey'
                    : registerStep === 'dob'
                      ? 'Let\'s get started'
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
                  color={colors.accent}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              </View>
            </View>

            {/* Registration step progress */}
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
                              accessibilityElementsHidden
                              importantForAccessibility="no-hide-descendants"
                            />
                          ) : (
                            <Text
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

            {/* Google sign-in button */}
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
              accessibilityState={{ busy: googleLoading }}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#12141D" />
              ) : (
                <GoogleLogo size={19} />
              )}

              <Text style={styles.googleButtonText}>
                {googleLoading
                  ? 'Opening Google…'
                  : mode === 'login'
                    ? 'Sign in with Google'
                    : 'Continue with Google'}
              </Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH EMAIL</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Forms */}
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
                        color={colors.textDim}
                      />
                    </Pressable>
                  }
                />

                {currentError !== null ? (
                  <ErrorBanner message={currentError} />
                ) : null}

                <ActionButton
                  label="Sign in"
                  icon="arrow-right"
                  onPress={() => void handleLogin()}
                  loading={loginLoading}
                />

                <View style={styles.trustRow}>
                  <Feather
                    name="lock"
                    size={12}
                    color={colors.textFaint}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
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
                      }}
                      placeholder="YYYY-MM-DD"
                      icon="calendar"
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      maxLength={10}
                    />

                    <View style={styles.infoBanner}>
                      <View style={styles.infoIcon}>
                        <Feather
                          name="shield"
                          size={16}
                          color={colors.accent}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        />
                      </View>
                      <Text style={styles.infoText}>
                        Students must be at least 13 years old to create an
                        account.
                      </Text>
                    </View>

                    {coppaBlocked ? (
                      <ErrorBanner message="You must be at least 13 years old. Please ask a parent or guardian for help." />
                    ) : currentError !== null ? (
                      <ErrorBanner message={currentError} />
                    ) : null}

                    <ActionButton
                      label="Continue"
                      icon="arrow-right"
                      onPress={handleDobContinue}
                      disabled={coppaBlocked}
                    />
                  </>
                ) : null}

                {registerStep === 'account' ? (
                  <>
                    <AuthField
                      label="Display name"
                      value={name}
                      onChangeText={setName}
                      placeholder="What should we call you?"
                      icon="user"
                      autoCapitalize="words"
                      textContentType="name"
                    />

                    <AuthField
                      label="Email address"
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value)
                        setOtpSent(false)
                        setOtp('')
                      }}
                      placeholder="you@example.com"
                      icon="mail"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      textContentType="emailAddress"
                    />

                    <AuthField
                      label="Password"
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value)
                        setOtpSent(false)
                        setOtp('')
                      }}
                      placeholder="At least 8 characters"
                      icon="lock"
                      secureTextEntry={!showRegisterPassword}
                      autoCapitalize="none"
                      textContentType="newPassword"
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
                            color={colors.textDim}
                          />
                        </Pressable>
                      }
                    />

                    <View style={styles.passwordHint}>
                      <View
                        style={[
                          styles.passwordDot,
                          password.length >= 8 && styles.passwordDotComplete,
                        ]}
                      />
                      <Text style={styles.passwordHintText}>
                        Use at least 8 characters
                      </Text>
                    </View>

                    {otpSent ? (
                      <AuthField
                        label="Verification code"
                        value={otp}
                        onChangeText={setOtp}
                        placeholder="6-digit code"
                        icon="key"
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        textContentType="oneTimeCode"
                        maxLength={6}
                      />
                    ) : null}

                    {otpSent ? (
                      <View style={styles.codeSentBanner}>
                        <Feather
                          name="check-circle"
                          size={15}
                          color={colors.tierGreen}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        />
                        <Text style={styles.codeSentText}>
                          Verification code sent to {email.trim()}.
                        </Text>
                      </View>
                    ) : null}

                    {currentError !== null ? (
                      <ErrorBanner message={currentError} />
                    ) : null}

                    <ActionButton
                      label={
                        otpSent
                          ? 'Resend verification code'
                          : 'Send verification code'
                      }
                      icon={otpSent ? 'refresh-cw' : 'send'}
                      onPress={() => void handleSendOtp()}
                      loading={otpLoading}
                      variant="secondary"
                    />

                    <ActionButton
                      label="Continue"
                      icon="arrow-right"
                      onPress={handleAccountContinue}
                      disabled={!otpSent || otp.trim().length === 0}
                    />

                    {/* Connect school account placeholder — shown on the account step
                        before the user finishes registration, per design spec */}
                    <ConnectSchoolPlaceholder />
                  </>
                ) : null}

                {registerStep === 'terms' ? (
                  <>
                    <View style={styles.summaryCard}>
                      <View style={styles.summaryIcon}>
                        <Feather
                          name="user"
                          size={19}
                          color={colors.accent}
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        />
                      </View>
                      <View style={styles.summaryCopy}>
                        <Text style={styles.summaryTitle}>
                          {name.trim() || 'New myFuturely student'}
                        </Text>
                        <Text style={styles.summaryEmail}>
                          {email.trim()}
                        </Text>
                      </View>
                      <Feather
                        name="check-circle"
                        size={18}
                        color={colors.tierGreen}
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
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

                    {currentError !== null ? (
                      <ErrorBanner message={currentError} />
                    ) : null}

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
          </Card>

          <Text style={styles.footerText}>
            {"By continuing, you're joining a student-first platform designed to help you make confident academic decisions."}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  // Brand header
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
  },
  logoShell: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandTag: {
    marginTop: 1,
    color: colors.textFaint,
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    lineHeight: 14,
  },
  securePill: {
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.accent2Dim,
    borderWidth: 1,
    borderColor: 'rgba(34,211,181,0.25)',
  },
  securePillText: {
    color: colors.accent2,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    fontWeight: '700',
  },

  // Hero
  hero: {
    gap: spacing.xs,
  },
  heroEyebrow: {
    ...typography.label,
    color: colors.textDim,
  },
  heroTitle: {
    ...typography.display,
    color: colors.text,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  heroTitleAccent: {
    color: colors.accent,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textDim,
    marginTop: 2,
  },

  // Feature chips
  featureRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  featureChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  featureChipText: {
    ...typography.caption,
    color: colors.textDim,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
  },

  // Auth card inner content (Card component provides the glass wrapper)
  authCardInner: {
    gap: spacing.md,
  },

  // Form header
  formHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.ms,
  },
  formHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  formEyebrow: {
    ...typography.label,
    color: colors.textDim,
  },
  formTitle: {
    marginTop: 3,
    ...typography.h2,
    color: colors.text,
    letterSpacing: -0.3,
  },
  formSubtitle: {
    marginTop: 4,
    ...typography.caption,
    color: colors.textDim,
    lineHeight: 16,
  },
  formIcon: {
    width: touchTarget,
    height: touchTarget,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(76,124,255,0.25)',
  },

  // Registration step progress
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
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  stepCircleActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  stepCircleComplete: {
    backgroundColor: colors.tierGreenBg,
    borderColor: colors.tierGreen,
  },
  stepNumber: {
    ...typography.caption,
    color: colors.textFaint,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  stepNumberActive: {
    color: colors.accent,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textFaint,
    fontFamily: fonts.bodyMedium,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: colors.accent,
  },
  stepLine: {
    flex: 1,
    height: 1,
    maxWidth: 58,
    minWidth: 36,
    marginHorizontal: 7,
    marginBottom: 16,
    backgroundColor: colors.cardBorder,
  },
  stepLineComplete: {
    backgroundColor: colors.tierGreen,
  },

  // Google button
  googleButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.input,
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
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    fontSize: 13,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerText: {
    ...typography.label,
    color: colors.textFaint,
  },

  // Form container
  form: {
    gap: spacing.ms,
  },

  // AuthField
  fieldWrap: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textDim,
  },
  inputShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: radii.input,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  inputShellFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
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
    paddingRight: spacing.ms,
    color: colors.text,
    fontFamily: fonts.bodyRegular,
    fontSize: typography.body.fontSize,
  },
  visibilityButton: {
    width: 43,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ActionButton
  actionButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    ...elevation.sm,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: colors.cardBorder,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  actionButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButtonText: {
    color: colors.textDim,
  },

  // ErrorBanner
  errorBanner: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.ms,
    borderRadius: radii.md,
    backgroundColor: colors.tierRedBg,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
  },
  errorIcon: {
    width: 29,
    height: 29,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(248,113,113,0.10)',
  },
  errorText: {
    flex: 1,
    ...typography.caption,
    color: colors.tierRed,
    lineHeight: 16,
  },

  // Info banner
  infoBanner: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.ms,
    borderRadius: radii.md,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(76,124,255,0.22)',
  },
  infoIcon: {
    width: 31,
    height: 31,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(76,124,255,0.10)',
  },
  infoText: {
    flex: 1,
    ...typography.caption,
    color: colors.textDim,
    lineHeight: 16,
  },

  // Password hint
  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: 2,
  },
  passwordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textFaint,
  },
  passwordDotComplete: {
    backgroundColor: colors.tierGreen,
  },
  passwordHintText: {
    ...typography.caption,
    color: colors.textFaint,
  },

  // Code sent banner
  codeSentBanner: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.ms,
    borderRadius: radii.md,
    backgroundColor: colors.tierGreenBg,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.22)',
  },
  codeSentText: {
    flex: 1,
    ...typography.caption,
    color: colors.tierGreen,
    lineHeight: 14,
  },

  // Summary card (terms step)
  summaryCard: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.ms,
    borderRadius: radii.card,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.accentDim,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryTitle: {
    ...typography.h3,
    color: colors.text,
  },
  summaryEmail: {
    ...typography.caption,
    color: colors.textDim,
  },

  // Checkbox row (terms step)
  checkboxRow: {
    minHeight: 63,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.ms,
    borderRadius: radii.card,
    backgroundColor: colors.cardFallback,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  checkboxBoxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  checkboxLabel: {
    ...typography.h3,
    color: colors.text,
  },
  checkboxSubtitle: {
    ...typography.caption,
    color: colors.textDim,
    lineHeight: 14,
  },

  // Connect school account placeholder
  connectSchoolBox: {
    gap: spacing.ms,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    backgroundColor: 'transparent',
  },
  connectSchoolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectSchoolTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.textDim,
  },
  requiredBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.tierRedBg,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
  },
  requiredBadgeText: {
    ...typography.caption,
    color: colors.tierRed,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
  },
  connectSchoolBody: {
    ...typography.body,
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 18,
  },
  connectSchoolButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  connectSchoolButtonPressed: {
    opacity: 0.75,
  },
  connectSchoolButtonText: {
    ...typography.body,
    fontSize: 13,
    color: colors.accent,
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
  },

  // Trust row
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  trustText: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Footer
  footerText: {
    maxWidth: 330,
    alignSelf: 'center',
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 16,
  },
})
