import React, { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import { getCanvasGrades, type CanvasConnectionGrades } from '../api/canvasApi'
import {
  BookOpenIcon,
  ChevronRightIcon,
  LinkIcon,
  WarningIcon,
} from '../components/icons'
import type { CanvasNavigatorParamList } from '../navigation/CanvasNavigator'

// ── Types ─────────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<CanvasNavigatorParamList>

// ── Sub-components ────────────────────────────────────────────────────────────

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
      {[0, 1].map(i => (
        <View key={i} style={styles.connectionRowSkeleton}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Skeleton width="65%" height={15} style={{ marginBottom: 6 }} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={20} height={20} radius={4} />
        </View>
      ))}
    </View>
  )
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <Text variant="h3" color={colors.error} style={styles.stateTitle}>Unable to Load Connections</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>{message}</Text>
      <Button label="Try Again" onPress={onRetry} />
    </View>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <View style={styles.centerState}>
      <BookOpenIcon size={40} color={colors.textSecondary} />
      <Text variant="h3" style={styles.stateTitle}>No Canvas Accounts</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.stateMessage}>
        Connect a Canvas LMS account to view your courses and grades here.
      </Text>
      <Button label="Add Canvas Account" onPress={onAdd} />
    </View>
  )
}

interface ConnectionErrorBadgeProps {
  errorType: 'TOKEN_EXPIRED' | 'FETCH_FAILED'
}

function ConnectionErrorBadge({ errorType }: ConnectionErrorBadgeProps): React.JSX.Element {
  const label = errorType === 'TOKEN_EXPIRED' ? 'Token Expired' : 'Sync Failed'
  return (
    <View style={styles.errorBadge}>
      <WarningIcon size={12} color={colors.error} />
      <Text style={styles.errorBadgeText}>{label}</Text>
    </View>
  )
}

interface ConnectionRowProps {
  connection: CanvasConnectionGrades
  connectionId: number
  onPress: () => void
}

function ConnectionRow({ connection, connectionId: _connectionId, onPress }: ConnectionRowProps): React.JSX.Element {
  const displayName = connection.canvasUserName ?? connection.canvasInstanceUrl
  const courseCount = connection.courses.length

  return (
    <TouchableOpacity
      style={styles.connectionRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Canvas account: ${displayName}. ${courseCount} course${courseCount !== 1 ? 's' : ''}.`}
    >
      <View style={styles.connectionIconWrap}>
        <BookOpenIcon size={22} color={colors.primary} />
      </View>
      <View style={styles.connectionInfo}>
        <Text variant="h3" style={styles.connectionName} numberOfLines={1}>{displayName}</Text>
        <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
          {connection.canvasInstanceUrl}
        </Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
          {courseCount} course{courseCount !== 1 ? 's' : ''}
        </Text>
        {connection.error !== undefined && (
          <View style={{ marginTop: 4 }}>
            <ConnectionErrorBadge errorType={connection.error} />
          </View>
        )}
      </View>
      <ChevronRightIcon size={16} color={colors.textMuted} />
    </TouchableOpacity>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CanvasConnectionsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connections, setConnections] = useState<CanvasConnectionGrades[]>([])

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getCanvasGrades()
      setConnections(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Canvas connections.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Reload when returning from CanvasConnect (in case a new account was added)
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const handleAddAccount = useCallback((): void => {
    navigation.navigate('CanvasConnect')
  }, [navigation])

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Canvas" />
        <LoadingSkeleton />
      </View>
    )
  }

  if (error !== null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Canvas" />
        <ErrorView message={error} onRetry={() => void load()} />
      </View>
    )
  }

  if (connections.length === 0) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Canvas" />
        <EmptyState onAdd={handleAddAccount} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Canvas" />
      <FlatList
        data={connections}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => (
          <ConnectionRow
            connection={item}
            connectionId={index}
            onPress={() =>
              navigation.navigate('CanvasCourses', {
                connectionId: index,
                instanceUrl: item.canvasInstanceUrl,
                displayName: item.canvasUserName ?? item.canvasInstanceUrl,
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text variant="label" color={colors.textSecondary} style={styles.sectionLabel}>
            Connected Accounts
          </Text>
        }
        ListFooterComponent={
          <View style={styles.addAccountFooter}>
            <TouchableOpacity
              style={styles.addAccountBtn}
              onPress={handleAddAccount}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Add Canvas account"
            >
              <LinkIcon size={18} color={colors.primary} />
              <Text style={styles.addAccountText}>Add Canvas Account</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  stateTitle: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  stateMessage: {
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  connectionRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  connectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  connectionInfo: {
    flex: 1,
    marginRight: 12,
  },
  connectionName: {
    marginBottom: 2,
  },
  errorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.error + '18',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  errorBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.error,
    lineHeight: 14,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  addAccountFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    minHeight: 44,
  },
  addAccountText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    lineHeight: 20,
  },
})
