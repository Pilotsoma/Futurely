import React, { useCallback, useState } from 'react'
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Text from '../components/ui/Text'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import { useAuth } from '../context/AuthContext'
import { fetchStudentData, patchProfile, type StudentData, type ProfilePatchBody } from '../api/studentApi'
import { shadows } from '../constants/shadows'
import type { AppParamList } from '../navigation/AppNavigator'
import type { MainTabParamList } from '../navigation/MainTabNavigator'

// ─── Navigation ───────────────────────────────────────────────────────────────

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Settings'>,
  NativeStackNavigationProp<AppParamList>
>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name) return 'S'
  const parts = name.trim().split(' ')
  return parts.map(p => p.charAt(0).toUpperCase()).join('').slice(0, 2)
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function openUrl(url: string): void {
  void Linking.openURL(url).catch(() => {
    Alert.alert('Could not open link', 'Please visit myfuturely.ai in your browser.')
  })
}

// ─── Edit modal field type ────────────────────────────────────────────────────

type EditField = 'sat' | 'act' | 'plan'

interface EditModalState {
  field: EditField
  value: string
}

const EDIT_FIELD_LABELS: Record<EditField, string> = {
  sat: 'SAT Score',
  act: 'ACT Score',
  plan: 'Future Plan',
}

// ─── Row components ───────────────────────────────────────────────────────────

interface SettingsRowProps {
  label: string
  value?: string
  onPress?: () => void
  showChevron?: boolean
  destructive?: boolean
}

function SettingsRow({ label, value, onPress, showChevron = true, destructive = false }: SettingsRowProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
    >
      <Text variant="body" style={[{ flex: 1 }, destructive && { color: colors.error }]}>{label}</Text>
      {value !== undefined && (
        <Text variant="caption" style={{ marginRight: showChevron ? 4 : 0 }}>{value}</Text>
      )}
      {showChevron && onPress && (
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>›</Text>
      )}
    </TouchableOpacity>
  )
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <View style={styles.settingsRow} accessibilityRole="none">
      <Text variant="body" style={{ flex: 1 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={value ? colors.primary : colors.textMuted}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
      />
    </View>
  )
}

function SectionTitle({ title }: { title: string }): React.JSX.Element {
  return (
    <Text variant="label" color={colors.textSecondary} style={styles.sectionTitle}>
      {title}
    </Text>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>()
  const { user, logout } = useAuth()
  const [data, setData] = useState<StudentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Edit modal state
  const [editModal, setEditModal] = useState<EditModalState | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Hide GPA privacy toggle
  const [hideGpa, setHideGpa] = useState(false)

  const hideGpaKey = `settings_hideGpa_${user?.id ?? 'anon'}`

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true)
      void (async () => {
        const [studentData, rawHide] = await Promise.all([
          fetchStudentData().catch((): null => null),
          AsyncStorage.getItem(hideGpaKey).catch((): null => null),
        ])
        setData(studentData)
        setHideGpa(rawHide === 'true')
        setIsLoading(false)
      })()
    }, [hideGpaKey])
  )

  const profile = data?.profile ?? null
  const name = data?.name ?? null
  const gradeStr = profile?.gradeLevel ? `${ordinal(profile.gradeLevel)} Grade` : ''
  const classOf = profile?.graduationYear ? `Class of ${profile.graduationYear}` : ''

  function confirmLogout(): void {
    Alert.alert('Log Out?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => void logout() },
    ])
  }

  function openEditModal(field: EditField, currentValue: string): void {
    setEditModal({ field, value: currentValue })
  }

  function closeEditModal(): void {
    setEditModal(null)
  }

  async function handleSave(): Promise<void> {
    if (editModal === null) return
    setIsSaving(true)
    try {
      const body: ProfilePatchBody = {}
      if (editModal.field === 'sat') {
        const n = parseInt(editModal.value, 10)
        body.satScore = editModal.value.trim() === '' ? null : (isNaN(n) ? null : n)
      } else if (editModal.field === 'act') {
        const n = parseInt(editModal.value, 10)
        body.actScore = editModal.value.trim() === '' ? null : (isNaN(n) ? null : n)
      } else {
        body.futureDecision = editModal.value.trim() || null
      }
      const updatedProfile = await patchProfile(body)
      setData(prev => prev !== null ? { ...prev, profile: updatedProfile } : prev)
      closeEditModal()
    } catch {
      Alert.alert('Save Failed', 'Could not update your profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleHideGpaToggle(value: boolean): Promise<void> {
    setHideGpa(value)
    try {
      await AsyncStorage.setItem(hideGpaKey, value ? 'true' : 'false')
    } catch {
      // AsyncStorage failure is non-fatal — state is still updated in memory
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Settings" showBack={false} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {isLoading ? (
              <Skeleton width={40} height={40} radius={20} />
            ) : (
              <Text style={styles.avatarText}>{initials(name)}</Text>
            )}
          </View>
          {isLoading ? (
            <>
              <Skeleton width={160} height={18} style={{ marginTop: 12, borderRadius: 6 }} />
              <Skeleton width={120} height={14} style={{ marginTop: 8, borderRadius: 6 }} />
            </>
          ) : (
            <>
              <Text style={styles.profileName}>{name ?? 'Student'}</Text>
              <Text variant="caption" style={{ marginTop: 4 }}>
                {[gradeStr, classOf].filter(Boolean).join(' · ')}
              </Text>
            </>
          )}
        </View>

        {/* Account */}
        <SectionTitle title="Account" />
        <View style={styles.settingsGroup}>
          <SettingsRow
            label="School Portal"
            onPress={() => navigation.navigate('PortalConnect')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="Login Settings"
            onPress={() => openUrl('https://myfuturely.ai/account')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="Manage Account"
            onPress={() => openUrl('https://myfuturely.ai/account')}
          />
        </View>

        {/* Academic info */}
        <SectionTitle title="Academic Info" />
        <View style={styles.settingsGroup}>
          <SettingsRow
            label="SAT Score"
            value={profile?.satScore?.toString() ?? 'Not set'}
            onPress={() =>
              openEditModal('sat', profile?.satScore?.toString() ?? '')
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="ACT Score"
            value={profile?.actScore?.toString() ?? 'Not set'}
            onPress={() =>
              openEditModal('act', profile?.actScore?.toString() ?? '')
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="Future Plan"
            value={profile?.futureDecision ?? 'Not set'}
            onPress={() =>
              openEditModal('plan', profile?.futureDecision ?? '')
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="Counselor"
            value={profile?.counselorName ?? 'Unassigned'}
            showChevron={false}
          />
          <View style={styles.rowDivider} />
          <ToggleRow
            label="Hide GPA"
            value={hideGpa}
            onValueChange={value => void handleHideGpaToggle(value)}
          />
        </View>

        {/* Support */}
        <SectionTitle title="Support" />
        <View style={styles.settingsGroup}>
          <SettingsRow
            label="Contact Support"
            onPress={() => openUrl('mailto:support@myfuturely.ai')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="Terms of Service"
            onPress={() => openUrl('https://myfuturely.ai/terms')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => openUrl('https://myfuturely.ai/privacy')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="Leave a Review"
            onPress={() =>
              Alert.alert('Thank you!', 'Your feedback means the world to us.')
            }
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            label="myFuturely"
            onPress={() => openUrl('https://myfuturely.ai')}
          />
        </View>

        {/* Log Out */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={confirmLogout}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text variant="caption" style={styles.footer}>myFuturely v1.0.0</Text>
      </ScrollView>

      {/* ── Edit Field Modal ── */}
      <Modal
        visible={editModal !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
        accessibilityViewIsModal
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeEditModal}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalCard}
            onPress={() => { /* absorb tap to prevent backdrop close */ }}
          >
            <Text variant="h3" style={styles.modalTitle}>
              {editModal !== null ? EDIT_FIELD_LABELS[editModal.field] : ''}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editModal?.value ?? ''}
              onChangeText={text =>
                setEditModal(prev => prev !== null ? { ...prev, value: text } : prev)
              }
              placeholder={
                editModal?.field === 'plan'
                  ? 'e.g. Study Engineering at UT Austin'
                  : '0'
              }
              placeholderTextColor={colors.textMuted}
              keyboardType={
                editModal?.field === 'sat' || editModal?.field === 'act'
                  ? 'number-pad'
                  : 'default'
              }
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleSave()}
              accessibilityLabel={
                editModal !== null ? `Edit ${EDIT_FIELD_LABELS[editModal.field]}` : 'Edit field'
              }
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={closeEditModal}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave, isSaving && styles.modalBtnDisabled]}
                onPress={() => void handleSave()}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save"
              >
                <Text style={styles.modalBtnSaveText}>
                  {isSaving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  profileCard: {
    ...shadows.raised,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.background },
  profileName: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginTop: 12 },
  sectionTitle: { marginBottom: 8 },
  settingsGroup: {
    ...shadows.raised,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 44,
  },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: 16 },
  logoutBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  logoutText: { fontSize: 16, fontWeight: '700', color: colors.error },
  footer: { textAlign: 'center' as const, paddingBottom: 40 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    ...shadows.raised,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    width: '100%',
  },
  modalTitle: { marginBottom: 16 },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 20,
    minHeight: 44,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600' as const, color: colors.textSecondary },
  modalBtnSave: { backgroundColor: colors.primary },
  modalBtnSaveText: { fontSize: 15, fontWeight: '600' as const, color: colors.white },
  modalBtnDisabled: { opacity: 0.4 },
})
