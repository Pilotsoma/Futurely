import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { MagnifyingGlassIcon, SchoolBuildingIcon, TrashIcon } from '../components/icons'
import Text from '../components/ui/Text'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import ScreenHeader from '../components/ui/ScreenHeader'
import { colors } from '../constants/colors'
import {
  searchColleges,
  getSavedColleges,
  addCollege,
  removeCollege,
  type CollegeSearchResult,
  type SavedCollege,
} from '../api/collegesApi'
import type { CollegeHelpParamList } from '../navigation/CollegeHelpNavigator'
import { shadows } from '../constants/shadows'

// ── Types ─────────────────────────────────────────────────────────────────────

type NavProp = NativeStackNavigationProp<CollegeHelpParamList>
type CollegeLabel = 'Likely' | 'Possible' | 'Reach' | 'Far Reach' | null

const DEBOUNCE_MS = 300
const VALID_LABELS = new Set<string>(['Likely', 'Possible', 'Reach', 'Far Reach'])

function toCollegeLabel(raw: string | null): CollegeLabel {
  if (raw !== null && VALID_LABELS.has(raw)) return raw as CollegeLabel
  return null
}

const LABEL_COLORS: Record<NonNullable<CollegeLabel>, string> = {
  Likely: colors.success,
  Possible: colors.primary,
  Reach: colors.warning,
  'Far Reach': colors.error,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LikelihoodChip({ label }: { label: string | null }): React.JSX.Element | null {
  const narrowed = toCollegeLabel(label)
  if (narrowed === null) return null
  const color = LABEL_COLORS[narrowed]
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipText, { color }]}>{narrowed}</Text>
    </View>
  )
}

function admitRateLabel(rate: number | null): string {
  if (rate === null) return 'Admit rate unavailable'
  return `${(rate * 100).toFixed(0)}% admit rate`
}

function LoadingSkeleton(): React.JSX.Element {
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map(i => (
        <View key={i} style={[styles.collegeRow, { marginBottom: 0 }]}>
          <View style={{ flex: 1 }}>
            <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="50%" height={12} style={{ marginBottom: 4 }} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
    </View>
  )
}

interface SearchResultRowProps {
  item: CollegeSearchResult
  isAdding: boolean
  onAdd: () => void
}

function SearchResultRow({ item, isAdding, onAdd }: SearchResultRowProps): React.JSX.Element {
  return (
    <View style={styles.collegeRow}>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{item.name}</Text>
        <Text variant="caption" style={{ marginTop: 2 }}>
          {[item.city, item.state].filter(Boolean).join(', ')}
        </Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
          {admitRateLabel(item.admissionRate)}
        </Text>
        <View style={styles.chipRow}>
          <LikelihoodChip label={item.label} />
        </View>
      </View>
      <TouchableOpacity
        style={[styles.addBtn, isAdding && styles.addBtnDisabled]}
        onPress={onAdd}
        disabled={isAdding}
        accessibilityRole="button"
        accessibilityLabel={`Add ${item.name}`}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isAdding
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Text style={styles.addBtnText}>+ Add</Text>
        }
      </TouchableOpacity>
    </View>
  )
}

interface SavedCollegeRowProps {
  item: SavedCollege
  isRemoving: boolean
  onTap: () => void
  onRemove: () => void
}

function SavedCollegeRow({ item, isRemoving, onTap, onRemove }: SavedCollegeRowProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.collegeRow}
      onPress={onTap}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`View insights for ${item.name}`}
    >
      <View style={{ flex: 1 }}>
        <Text variant="h3">{item.name}</Text>
        <Text variant="caption" style={{ marginTop: 2 }}>
          {[item.city, item.state].filter(Boolean).join(', ')}
        </Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
          {admitRateLabel(item.admissionRate)}
        </Text>
        <View style={styles.chipRow}>
          <LikelihoodChip label={item.label} />
        </View>
      </View>
      <TouchableOpacity
        onPress={onRemove}
        disabled={isRemoving}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name}`}
        style={styles.removeBtn}
      >
        {isRemoving
          ? <ActivityIndicator size="small" color={colors.error} />
          : <TrashIcon size={18} color={colors.error} />
        }
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CollegesScreen(): React.JSX.Element {
  const navigation = useNavigation<NavProp>()

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CollegeSearchResult[]>([])
  const [savedColleges, setSavedColleges] = useState<SavedCollege[]>([])
  const [isLoadingSaved, setIsLoadingSaved] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [savedError, setSavedError] = useState<string | null>(null)
  const [addingUnitId, setAddingUnitId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadSaved = useCallback(async (): Promise<void> => {
    setIsLoadingSaved(true)
    setSavedError(null)
    try {
      setSavedColleges(await getSavedColleges())
    } catch (e) {
      setSavedError(e instanceof Error ? e.message : 'Failed to load colleges.')
    } finally {
      setIsLoadingSaved(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { void loadSaved() }, [loadSaved]))

  useEffect(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchResults([])
      setIsSearching(false)
      return
    }
    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      void searchColleges(trimmed)
        .then(results => {
          setSearchResults(results)
          setIsSearching(false)
        })
        .catch(() => {
          setSearchResults([])
          setIsSearching(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleAdd = useCallback(async (item: CollegeSearchResult): Promise<void> => {
    setAddingUnitId(item.unitId)
    try {
      const saved = await addCollege(item.name, item.unitId)
      setSavedColleges(prev => [...prev, saved])
    } catch {
      // leave search results intact so user can retry
    } finally {
      setAddingUnitId(null)
    }
  }, [])

  const handleRemove = useCallback(async (id: number): Promise<void> => {
    setRemovingId(id)
    try {
      await removeCollege(id)
      setSavedColleges(prev => prev.filter(c => c.id !== id))
    } catch {
      // leave list intact so user can retry
    } finally {
      setRemovingId(null)
    }
  }, [])

  const isSearchMode = query.trim().length > 0

  return (
    <View style={styles.container}>
      <ScreenHeader title="Colleges" />

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MagnifyingGlassIcon size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search colleges..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            accessibilityLabel="Search colleges"
          />
        </View>
      </View>

      {isSearchMode ? (
        isSearching ? (
          <LoadingSkeleton />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={item => item.unitId}
            renderItem={({ item }) => (
              <SearchResultRow
                item={item}
                isAdding={addingUnitId === item.unitId}
                onAdd={() => void handleAdd(item)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <SchoolBuildingIcon size={36} color={colors.textMuted} />
                <Text variant="h3" color={colors.textSecondary} style={styles.emptyTitle}>
                  No results
                </Text>
                <Text variant="body" color={colors.textMuted} style={styles.emptyBody}>
                  No colleges found for "{query}"
                </Text>
              </View>
            }
          />
        )
      ) : isLoadingSaved ? (
        <LoadingSkeleton />
      ) : savedError !== null ? (
        <View style={styles.emptyState}>
          <Text variant="h3" color={colors.error} style={styles.emptyTitle}>Unable to Load</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.emptyBody}>{savedError}</Text>
          <Button label="Try Again" onPress={() => void loadSaved()} />
        </View>
      ) : (
        <FlatList
          data={savedColleges}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <SavedCollegeRow
              item={item}
              isRemoving={removingId === item.id}
              onTap={() =>
                navigation.navigate('CollegeInsights', {
                  id: item.id,
                  name: item.name,
                  score: item.score,
                  label: toCollegeLabel(item.label),
                })
              }
              onRemove={() => void handleRemove(item.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <SchoolBuildingIcon size={48} color={colors.textMuted} />
              <Text variant="h3" color={colors.textSecondary} style={styles.emptyTitle}>
                No colleges saved yet
              </Text>
              <Text variant="body" color={colors.textMuted} style={styles.emptyBody}>
                Search above to add your first college
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    ...shadows.raised,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    height: 44,
  },
  skeletonContainer: { paddingHorizontal: 20, paddingTop: 8 },
  collegeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
    minHeight: 44,
  },
  chipRow: { flexDirection: 'row', marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, fontWeight: '600' as const },
  addBtn: {
    minWidth: 56,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { fontSize: 13, fontWeight: '600' as const, color: colors.primary },
  removeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: { textAlign: 'center', marginTop: 16, marginBottom: 8 },
  emptyBody: { textAlign: 'center' },
})
