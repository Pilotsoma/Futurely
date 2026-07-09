import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import BranchHeader from '../components/ui/BranchHeader'
import { colors } from '../constants/colors'
import type { GradePortalParamList } from '../navigation/GradePortalNavigator'
import {
  getPortalStatus,
  disconnectPortal,
  type PortalStatus,
} from '../api/portalApi'
import {
  LinkIcon,
  ClipboardIcon,
  DocumentIcon,
  ClockIcon,
  CalculatorIcon,
  EnvelopeIcon,
  type IconProps,
} from '../components/icons'
import { shadows } from '../constants/shadows'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<GradePortalParamList>

type TileScreen = 'GradeViewer' | 'Transcript' | 'ClassSchedule' | 'WhatIfCalculator' | 'ContactTeachers'

interface Tile {
  title: string
  description: string
  Icon: React.FC<IconProps>
  iconColor: string
  screen: TileScreen
}

// ─── Tiles (Progress Report removed — no backend endpoint in Phase 1) ─────────

const TILES: Tile[] = [
  {
    title: 'Report Card',
    description: 'Grades & letter grades',
    Icon: ClipboardIcon,
    iconColor: colors.primary,
    screen: 'GradeViewer',
  },
  {
    title: 'Transcript',
    description: 'Credits & GPA history',
    Icon: DocumentIcon,
    iconColor: colors.info,
    screen: 'Transcript',
  },
  {
    title: 'Class Schedule',
    description: 'Your class periods',
    Icon: ClockIcon,
    iconColor: colors.warning,
    screen: 'ClassSchedule',
  },
  {
    title: 'What-If Calculator',
    description: 'Simulate grade changes',
    Icon: CalculatorIcon,
    iconColor: colors.success,
    screen: 'WhatIfCalculator',
  },
  {
    title: 'Contact Teachers',
    description: 'Email your teachers',
    Icon: EnvelopeIcon,
    iconColor: colors.orange,
    screen: 'ContactTeachers',
  },
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function GradePortalDashboard(): React.JSX.Element {
  const navigation = useNavigation<NavProp>()

  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    void loadPortalStatus()
  }, [])

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadPortalStatus()
    })
    return unsubscribe
  }, [navigation])

  const loadPortalStatus = async (): Promise<void> => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const status = await getPortalStatus()
      setPortalStatus(status)
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Could not check portal status')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleSync = async (): Promise<void> => {
    setSyncing(true)
    try {
      await loadPortalStatus()
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = (): void => {
    Alert.alert(
      'Disconnect Portal',
      'Are you sure you want to disconnect your school portal? Your grades will no longer sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: (): void => {
            void (async () => {
              setDisconnecting(true)
              try {
                await disconnectPortal()
                setPortalStatus(null)
                await loadPortalStatus()
              } catch (err: unknown) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Failed to disconnect')
              } finally {
                setDisconnecting(false)
              }
            })()
          },
        },
      ]
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BranchHeader />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Portal Status Card ── */}
        {statusLoading ? (
          <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : statusError ? (
          <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="caption" style={{ color: colors.textSecondary }}>
              Could not load portal status. Tap to retry.
            </Text>
            <TouchableOpacity
              onPress={() => void loadPortalStatus()}
              style={{ marginTop: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Retry loading portal status"
            >
              <Text variant="caption" style={{ color: colors.primary }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : portalStatus?.connected ? (
          <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statusCardRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text variant="h3" style={{ color: colors.success }}>Connected</Text>
              <Text variant="caption" style={{ color: colors.textSecondary, marginLeft: 4 }}>
                · {portalStatus.systemType ?? ''}
              </Text>
            </View>
            <View style={styles.statusCardMeta}>
              <Text variant="caption" style={{ color: colors.textSecondary }} numberOfLines={1}>
                {portalStatus.districtUrl ?? ''}
              </Text>
              <Text variant="caption" style={{ color: colors.textMuted }}>
                {portalStatus.lastSynced
                  ? `Last synced: ${new Date(portalStatus.lastSynced).toLocaleDateString()}`
                  : 'Never synced'}
              </Text>
            </View>
            <View style={styles.statusCardActions}>
              <TouchableOpacity
                style={[styles.statusActionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => void handleSync()}
                disabled={syncing}
                accessibilityRole="button"
                accessibilityLabel="Sync grades"
              >
                {syncing
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={[styles.statusActionText, { color: '#000' }]}>Sync Grades</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleDisconnect}
                disabled={disconnecting}
                accessibilityRole="button"
                accessibilityLabel="Disconnect portal"
              >
                {disconnecting
                  ? <ActivityIndicator color={colors.textSecondary} size="small" />
                  : <Text style={[styles.statusActionText, { color: colors.textSecondary }]}>Disconnect</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.connectBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <LinkIcon size={28} color={colors.textSecondary} />
            <Text style={[styles.connectBannerText, { color: colors.textPrimary }]}>
              Connect your school portal to see live grades
            </Text>
            <TouchableOpacity
              style={[styles.connectBannerButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('PortalConnect')}
              accessibilityRole="button"
              accessibilityLabel="Connect School Portal"
            >
              <Text style={styles.connectBannerButtonText}>Connect School Portal</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text variant="heading" style={styles.title}>Grade Portal</Text>
        <View style={styles.grid}>
          {TILES.map(tile => (
            <TouchableOpacity
              key={tile.title}
              style={styles.tile}
              onPress={() => navigation.navigate(tile.screen)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={tile.title}
            >
              <View style={[styles.iconSquare, { backgroundColor: tile.iconColor + '26' }]}>
                <tile.Icon size={24} color={tile.iconColor} />
              </View>
              <Text variant="h3" style={styles.tileTitle}>{tile.title}</Text>
              <Text variant="caption" style={styles.tileDesc}>{tile.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: { marginBottom: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    ...shadows.raised,
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  iconSquare: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { marginTop: 10 },
  tileDesc: { marginTop: 4 },
  // Portal connection card
  statusCard: {
    ...shadows.raised,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  statusCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusCardMeta: {
    marginTop: 10,
  },
  statusCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statusActionButton: {
    ...shadows.raised,
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  connectBanner: {
    ...shadows.raised,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
    gap: 10,
  },
  connectBannerText: {
    textAlign: 'center',
    fontSize: 14,
  },
  connectBannerButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 4,
  },
  connectBannerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
})
