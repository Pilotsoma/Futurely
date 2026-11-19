/**
 * Single source of truth for the floating tab bar and AI FAB geometry.
 *
 * Kept in a separate file so callers that only need the numeric constants
 * (tests, scroll containers) do not pay the import cost of Screen.tsx's
 * react-native-reanimated dependency.
 */

/** Height of the floating pill tab bar. */
export const TAB_BAR_HEIGHT = 64

/** Gap between the bottom safe-area inset and the tab bar. */
export const TAB_BAR_LIFT = 8

/** Smallest bottom inset the tab bar assumes (devices / web with no home indicator). */
export const TAB_BAR_MIN_INSET = 12

/** Diameter of the global AI floating action button. */
export const FAB_SIZE = 52

/** Gap between the top of the tab bar and the bottom of the FAB. */
export const FAB_GAP = 12

/**
 * paddingBottom that clears the tab bar only. Use on screens where the AI FAB
 * is hidden (see AI_FAB_HIDDEN_ROUTES).
 *
 * Derivation: max device safe-area inset (34 on Face-ID iPhone) + TAB_BAR_LIFT
 * (8) + TAB_BAR_HEIGHT (64) + visual breathing room (6) = 112.
 */
export const FLOATING_TAB_CLEARANCE = 112

/**
 * Air between the last row of a scroll screen and the top of the AI FAB, at scroll end.
 * Without it the last row ends flush with the button on a Face-ID iPhone.
 */
export const FAB_CONTENT_MARGIN = 20

/**
 * paddingBottom that clears the tab bar AND the AI FAB, with FAB_CONTENT_MARGIN to
 * spare. Use on every other ScrollView / FlatList / SectionList
 * contentContainerStyle inside MainNavigator:
 *   contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_CLEARANCE }}
 *
 * Derivation: FLOATING_TAB_CLEARANCE (112) + FAB_SIZE (52) + FAB_GAP (12)
 * + FAB_CONTENT_MARGIN (20) = 196.
 */
export const SCROLL_BOTTOM_CLEARANCE = FLOATING_TAB_CLEARANCE + FAB_SIZE + FAB_GAP + FAB_CONTENT_MARGIN

/**
 * Tab routes on which the global AI FAB is not rendered: AI Chat itself,
 * Dashboard (has the inline composer) and Settings.
 */
export const AI_FAB_HIDDEN_ROUTES: readonly string[] = ['AIChat', 'Dashboard', 'Settings']
