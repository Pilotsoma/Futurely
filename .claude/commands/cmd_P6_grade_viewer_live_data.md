# CMD P6 — Mobile: Update GradeViewerScreen to Use Live Portal Grades

## Context
The `GradeViewerScreen.tsx` currently always calls `fetchGrades()` which pulls seeded
data from `/api/grades`. This task changes the data-loading logic so it:

1. First checks whether a school portal is connected (`getPortalStatus()`)
2. If connected → loads live grades from `/api/integrations/grades/current`
3. If NOT connected → shows a "Connect your school portal" prompt with a button
4. Keeps the seeded `/api/grades` fallback available only when running in dev mode
   (`__DEV__ === true`) and no portal is connected

The existing UI — course rows, grade badges, GPA header, loading skeleton, error state —
stays exactly the same. Only the data SOURCE changes.

## Step 1 — Read the current GradeViewerScreen completely

Read `nextstep-mobile/src/screens/GradeViewerScreen.tsx` entirely.

Print these specific things from the file:
1. The exact shape of `CourseWithGrade` (or whatever the course data type is called)
2. The exact shape of `GpaData` (or whatever the GPA type is called)
3. The `loadGrades` function body
4. The empty state JSX

These are critical — you must map the live portal data into these exact shapes.

## Step 2 — Read the portalApi types

Read `nextstep-mobile/src/api/portalApi.ts`. Print the `NormalizedCourse` interface.

You need to map:
- `NormalizedCourse.average` → the percentage field used in the screen
- `NormalizedCourse.letterGrade` → the letterGrade field
- `NormalizedCourse.name`, `.teacher`, `.period` → direct map
- `NormalizedCourse.id` → the id field

## Step 3 — Understand the current data shape

The current GradeViewerScreen likely has a type like:
```typescript
interface CourseWithGrade {
  id: number
  name: string
  teacher: string
  period: number
  courseType: string
  grade: {
    letterGrade: string
    percentage: number
  } | null
}
```

Your normalization adapter must convert `NormalizedCourse` into whatever this screen's
exact type actually is. Read the file to get the exact type — do not guess.

## Step 4 — Add new imports

At the top of GradeViewerScreen.tsx, add (do not duplicate existing imports):

```typescript
import { getPortalStatus, getCurrentPortalGrades, type PortalStatus } from '../api/portalApi'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { GradePortalParamList } from '../navigation/GradePortalNavigator'
```

If `useNavigation` is not already imported, add it:
```typescript
import { useNavigation } from '@react-navigation/native'
```

## Step 5 — Add navigation type if not already present

Near the top of the component (after imports, before the component function), add:
```typescript
type GradeViewerNavProp = NativeStackNavigationProp<GradePortalParamList>
```

Inside the component, add or update:
```typescript
const navigation = useNavigation<GradeViewerNavProp>()
```

## Step 6 — Add portal status state

Inside the `GradeViewerScreen` function, after the existing state declarations, add:

```typescript
const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null)
const [dataSource, setDataSource] = useState<'portal' | 'seeded' | 'unknown'>('unknown')
```

## Step 7 — Create the normalization adapter function

Add this function OUTSIDE the component (before the `export default` line), after
reading the exact CourseWithGrade type from Step 3:

```typescript
/**
 * Adapt NormalizedCourse[] from the portal API into the shape
 * GradeViewerScreen uses internally.
 *
 * IMPORTANT: Adjust the returned object shape to match the actual
 * CourseWithGrade type in this file. Read the type before writing this.
 */
function adaptPortalGrades(
  portalCourses: import('../api/portalApi').NormalizedCourse[]
): CourseWithGrade[] {   // ← Replace CourseWithGrade with the actual type name
  return portalCourses.map((course, index) => ({
    id: index,                           // HAC has no numeric IDs
    name: course.name,
    teacher: course.teacher,
    period: parseInt(course.period, 10) || (index + 1),
    courseType: 'STANDARD',              // HAC doesn't expose course type
    creditHours: 1.0,
    semester: 'CURRENT',
    grade: course.average !== null
      ? {
          letterGrade: course.letterGrade ?? 'N/A',
          percentage: course.average,
        }
      : null,
  }))
}
```

Note: The field names in the returned object MUST match the actual CourseWithGrade type
exactly. Read the type from the file — do not guess. If it uses `letterGrade` and
`percentage` as nested under `grade`, use that structure. If it's flat, make it flat.

## Step 8 — Rewrite the loadGrades function

Find the existing `loadGrades` function (or `useCallback` that fetches grades).

Replace its body with this logic. Keep the function signature and the
`setIsLoading`/`setIsRefreshing`/`setError` calls in the same places:

```typescript
const loadGrades = useCallback(async (refresh: boolean = false): Promise<void> => {
  if (refresh) {
    setIsRefreshing(true)
  } else {
    setIsLoading(true)
  }
  setError(null)

  try {
    // Step 1: Check portal connection status
    const status = await getPortalStatus()
    setPortalStatus(status)

    if (status.connected) {
      // Step 2a: Portal connected — use live grades
      setDataSource('portal')
      const portalCourses = await getCurrentPortalGrades()
      const adapted = adaptPortalGrades(portalCourses)
      setCourses(adapted)

      // Compute GPA from live data
      const graded = adapted.filter(c => c.grade !== null)
      const pointMap: Record<string, number> = { A: 4.0, B: 3.0, C: 2.0, D: 1.0, F: 0.0 }
      const totalPoints = graded.reduce((sum, c) => {
        const letter = (c.grade?.letterGrade ?? 'F').charAt(0)
        return sum + (pointMap[letter] ?? 0)
      }, 0)
      const unweighted = graded.length > 0
        ? Math.round((totalPoints / graded.length) * 100) / 100
        : null

      // Set GPA — adapt this to match whatever setGpa expects
      setGpa({
        unweighted: unweighted ?? 0,
        weighted: unweighted ?? 0,  // HAC doesn't distinguish weighted; use same value
        courseCount: adapted.length,
      })

    } else if (__DEV__) {
      // Step 2b: Dev mode fallback — use seeded data
      setDataSource('seeded')
      const data = await fetchGrades()  // existing seeded data call
      setGpa(data.gpa)
      setCourses(data.courses)

    } else {
      // Step 2c: Not connected in production — show connect prompt
      setDataSource('seeded')
      setCourses([])
      setGpa(null)
    }

  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : 'Failed to load grades.')
  } finally {
    setIsLoading(false)
    setIsRefreshing(false)
  }
}, [])
```

IMPORTANT: Adapt this to match the actual state setter names in the file. If `setGpa`
takes a different shape, match it. If `setCourses` expects a different type, match it.
If `fetchGrades` is imported from somewhere, keep that import.

## Step 9 — Add "not connected" empty state

Find the existing empty state JSX (the case when courses.length === 0 and not loading).

Replace or augment the empty state to handle the "not connected" case:

```tsx
{/* Empty / not connected state */}
{!isLoading && courses.length === 0 && (
  <View style={styles.emptyState}>
    {dataSource === 'portal' || portalStatus?.connected ? (
      // Connected but no grades returned
      <>
        <Ionicons name="school-outline" size={40} color={colors.textSecondary} />
        <Text variant="h3" style={styles.stateTitle}>No Grades Found</Text>
        <Text variant="body" style={[styles.stateMessage, { color: colors.textSecondary }]}>
          Your school portal is connected but no grades were returned. Grades may not be
          available yet for this term.
        </Text>
      </>
    ) : (
      // Not connected
      <>
        <Ionicons name="link-outline" size={40} color={colors.textSecondary} />
        <Text variant="h3" style={styles.stateTitle}>
          Connect Your School Portal
        </Text>
        <Text variant="body" style={[styles.stateMessage, { color: colors.textSecondary }]}>
          Link your HAC or PowerSchool account to see your real grades here.
        </Text>
        <TouchableOpacity
          style={[styles.retryButton ?? {}, { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }]}
          onPress={() => navigation.navigate('PortalConnect')}
          accessibilityRole="button"
        >
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>
            Connect School Portal
          </Text>
        </TouchableOpacity>
        {__DEV__ && (
          <TouchableOpacity
            style={{ marginTop: 12 }}
            onPress={() => {
              // Dev only: force load seeded data
              setDataSource('seeded')
              fetchGrades().then(d => { setGpa(d.gpa); setCourses(d.courses) })
            }}
          >
            <Text variant="caption" style={{ color: colors.textSecondary }}>
              [DEV] Load demo data
            </Text>
          </TouchableOpacity>
        )}
      </>
    )}
  </View>
)}
```

Adapt the JSX so it uses the actual style names from this file's StyleSheet.
If `styles.retryButton` does not exist, use `styles.emptyState` or an inline style.

## Step 10 — Add a data source indicator in dev mode

In the GPA header area (or just below the loading state), add a small dev-only indicator
so you can tell during testing whether you're seeing portal or seeded data:

```tsx
{__DEV__ && dataSource !== 'unknown' && (
  <Text
    style={{ textAlign: 'center', fontSize: 11, color: colors.textMuted ?? colors.textSecondary, marginBottom: 4 }}
  >
    {dataSource === 'portal' ? '🟢 Live portal data' : '🟡 Demo/seeded data'}
  </Text>
)}
```

## Step 11 — TypeScript check

```bash
cd nextstep-mobile && npx tsc --noEmit 2>&1 | head -80
```

Fix ALL errors. Common issues:
- `GpaData` type may not have `courseCount` field — remove it from the setGpa call
- `CourseWithGrade` may use `grade.percentage` as a string not number — cast accordingly
- `__DEV__` may need `declare const __DEV__: boolean` at the top if TypeScript complains
- `retryButton` style key may not exist — add it or use inline style

## Step 12 — Add focus listener for live refresh

Add a focus effect so the grade data refreshes when the student returns from PortalConnect:

```typescript
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    loadGrades()
  })
  return unsubscribe
}, [navigation, loadGrades])
```

## Done

Report:
- Exact CourseWithGrade type shape found in the file (print it)
- Exact GpaData type shape found in the file (print it)
- adaptPortalGrades function created: yes/no
- loadGrades function updated: yes/no
- "Not connected" empty state added: yes/no
- Dev mode fallback kept: yes/no
- Focus listener added: yes/no
- TypeScript errors before fix (list them)
- TypeScript errors after fix: 0
