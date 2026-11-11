/**
 * Shared constants for the floating pill tab bar.
 *
 * Kept in a separate file so callers that only need the numeric constant
 * (tests, scroll containers) do not pay the import cost of Screen.tsx's
 * react-native-reanimated dependency.
 */

/**
 * Minimum paddingBottom for a ScrollView's contentContainerStyle so scroll
 * content is not hidden behind the floating tab bar.
 *
 * Derivation: max device safe-area inset (34 on Face-ID iPhone) + tab bar
 * bottom offset (8) + tab bar height (64) + visual breathing room (6) = 112.
 *
 * Apply to any ScrollView / FlatList / SectionList contentContainerStyle that
 * is rendered inside MainNavigator, e.g.:
 *   contentContainerStyle={{ paddingBottom: FLOATING_TAB_CLEARANCE }}
 */
export const FLOATING_TAB_CLEARANCE = 112
