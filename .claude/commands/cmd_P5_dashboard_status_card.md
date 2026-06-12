# CMD P5 — Mobile: Update GradePortalDashboard with Portal Status Card

## Context
The current `GradePortalDashboard.tsx` is just a grid of tiles. There is no indication
of whether the student has a school portal connected, no sync button, and no way to
reach the new PortalConnectScreen from this screen.

This task adds a connection status card at the TOP of the dashboard. The tile grid
stays exactly as-is below it.

## Step 1 — Read the current file completely

Read `nextstep-mobile/src/screens/GradePortalDashboard.tsx` entirely.

Print the full file. Note the exact StyleSheet keys, the TILES array structure,
and the ScrollView layout. You will be modifying this file surgically — do not
rewrite things that work.

## Step 2 — Read portalApi.ts

Read `nextstep-mobile/src/api/portalApi.ts`. Note the exact export names and return types:
- `getPortalStatus()` → returns `PortalStatus`
- `disconnectPortal()` → returns `{ disconnected: boolean }`
- `getCurrentPortalGrades()` → not needed for this screen

Print the `PortalStatus` interface definition.

## Step 3 — Plan the minimal changes

You need to add:
1. New imports at the top
2. New state variables in the component
3. A `useEffect` that calls `getPortalStatus()` on mount
4. A new portal status card component (defined in the same file)
5. The card rendered at the top of the ScrollView, before the tile grid

You must NOT:
- Remove or reorder any of the 6 existing tiles
- Change the TILES array
- Change the tile rendering logic
- Change the BranchHeader
- Add RTK Query or Redux — use simple `useState` + `useEffect` for this screen

## Step 4 — Add new imports to GradePortalDashboard.tsx

Add these imports to the existing import block. Do not remove existing imports.

```typescript
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert } from 'react-native'
import {
  getPortalStatus,
  disconnectPortal,
  type PortalStatus,
} from '../api/portalApi'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { GradePortalParamList } from '../navigation/GradePortalNavigator'
```

Note: `useNavigation` and `Alert` and `TouchableOpacity` and `View` may already be imported.
Only add what is missing. Do not duplicate imports.

## Step 5 — Update the NavProp type

The existing NavProp type is:
```typescript
type NavProp = NativeStackNavigationProp<GradePortalParamList>
```

This should already work with the updated `GradePortalParamList` from CMD P4.
No change needed here unless the type was different.

## Step 6 — Add state variables to the component function

Inside the `GradePortalDashboard` function, after the `navigation` line, add:

```typescript
const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null)
const [statusLoading, setStatusLoading] = useState(true)
const [statusError, setStatusError] = useState<string | null>(null)
const [syncing, setSyncing] = useState(false)
const [disconnecting, setDisconnecting] = useState(false)
```

## Step 7 — Add useEffect for status loading

After the state declarations, add:

```typescript
useEffect(() => {
  loadPortalStatus()
}, [])

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
        onPress: async () => {
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
        },
      },
    ]
  )
}
```

## Step 8 — Add portal status card styles to StyleSheet

Add these new style keys to the existing `StyleSheet.create({...})` call.
Do NOT replace existing styles — only add new ones:

```typescript
// Portal connection card
statusCard: {
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
```

## Step 9 — Add portal status card to the ScrollView

In the `return` block, find the ScrollView's contentContainerStyle. Add the portal status
card as the FIRST child inside `<ScrollView>`, BEFORE the existing `<Text>` title:

```tsx
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
      <Text variant="caption" color={colors.textSecondary}>
        Could not load portal status. Tap to retry.
      </Text>
      <TouchableOpacity onPress={loadPortalStatus} style={{ marginTop: 8 }}>
        <Text variant="caption" style={{ color: colors.primary }}>Retry</Text>
      </TouchableOpacity>
    </View>
  ) : portalStatus?.connected ? (
    /* Connected state */
    <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.statusCardRow}>
        <View style={[styles.statusDot, { backgroundColor: colors.success ?? '#3FB950' }]} />
        <Text variant="h3" style={{ color: colors.success ?? '#3FB950' }}>Connected</Text>
        <Text variant="caption" style={{ color: colors.textSecondary, marginLeft: 4 }}>
          · {portalStatus.systemType ?? ''}
        </Text>
      </View>
      <View style={styles.statusCardMeta}>
        <Text variant="caption" style={{ color: colors.textSecondary }} numberOfLines={1}>
          {portalStatus.districtUrl ?? ''}
        </Text>
        <Text variant="caption" style={{ color: colors.textMuted ?? colors.textSecondary }}>
          {portalStatus.lastSynced
            ? `Last synced: ${new Date(portalStatus.lastSynced).toLocaleDateString()}`
            : 'Never synced'}
        </Text>
      </View>
      <View style={styles.statusCardActions}>
        <TouchableOpacity
          style={[styles.statusActionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={handleSync}
          disabled={syncing}
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
        >
          {disconnecting
            ? <ActivityIndicator color={colors.textSecondary} size="small" />
            : <Text style={[styles.statusActionText, { color: colors.textSecondary }]}>Disconnect</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  ) : (
    /* Not connected state */
    <View style={[styles.connectBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="link-outline" size={28} color={colors.textSecondary} />
      <Text style={[styles.connectBannerText, { color: colors.text }]}>
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

  {/* ── Existing title and tile grid (unchanged) ── */}
  <Text variant="heading" style={styles.title}>Grade Portal</Text>
  <View style={styles.grid}>
    {/* ... existing tile map code stays exactly as-is ... */}
  </View>
</ScrollView>
```

IMPORTANT: The `<Text variant="heading">` and `<View style={styles.grid}>` with the
tile map MUST remain unchanged. Only add the portal status block above them.

## Step 10 — Add focus listener to refresh status when returning from PortalConnect

After the `loadPortalStatus` callback, add a navigation focus listener so the status
refreshes when the student navigates back from the Connect screen:

```typescript
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    loadPortalStatus()
  })
  return unsubscribe
}, [navigation])
```

## Step 11 — TypeScript check

```bash
cd nextstep-mobile && npx tsc --noEmit 2>&1 | head -60
```

Fix all errors. Common issues:
- `colors.success` may not exist — use the literal `'#3FB950'` if it does not
- `colors.textMuted` may not exist — use `colors.textSecondary` as fallback
- `Text` component's color prop might not accept a string directly — wrap in a style object

## Done

Report:
- New imports added (list them)
- New state variables added (list them)
- Portal status card renders in 3 states: loading, not connected, connected
- Focus listener added for auto-refresh: yes/no
- Existing 6 tiles unchanged: yes/no
- TypeScript errors: 0
