# CMD P4 — Mobile: Wire PortalConnect Into Navigation

## Context
The `PortalConnectScreen` was just created but it is not registered in any navigator.
Until it is registered, calling `navigation.navigate('PortalConnect')` will crash the app.

This task adds the screen to `GradePortalNavigator.tsx` and ensures the TypeScript
param list type is updated so all navigate calls are type-safe.

## Step 1 — Read the navigator before editing

Read `nextstep-mobile/src/navigation/GradePortalNavigator.tsx` completely.

Print the entire file so the before-state is visible in the log.

## Step 2 — Identify current GradePortalParamList

The current type definition looks like:
```typescript
export type GradePortalParamList = {
  GradePortalHome: undefined
  GradeViewer: undefined
  Transcript: undefined
  ClassSchedule: undefined
  ContactTeachers: undefined
  Simulator: undefined
}
```

You will add `PortalConnect: undefined` to this type.

## Step 3 — Edit GradePortalNavigator.tsx

Make exactly these changes (do NOT remove or change any existing lines):

### Change 1: Add to the type definition

Find the `GradePortalParamList` type. Add `PortalConnect: undefined` as a new entry:

```typescript
export type GradePortalParamList = {
  GradePortalHome: undefined
  GradeViewer: undefined
  Transcript: undefined
  ClassSchedule: undefined
  ContactTeachers: undefined
  Simulator: undefined
  PortalConnect: undefined    // ← ADD THIS LINE
}
```

### Change 2: Add the import

At the top of the file, after the existing screen imports, add:
```typescript
import PortalConnectScreen from '../screens/PortalConnectScreen'
```

### Change 3: Register the screen in the Stack.Navigator

Inside the `<Stack.Navigator>` block, after the last existing `<Stack.Screen>`, add:
```tsx
<Stack.Screen name="PortalConnect" component={PortalConnectScreen} />
```

The `screenOptions` for this screen should inherit from the navigator's default
`screenOptions={{ headerShown: false, animation: 'slide_from_right' }}` — do NOT add
a separate options prop to the PortalConnect screen unless there is a specific reason.

## Step 4 — Read the result

After editing, read the entire file again and print it so the after-state is visible
and can be verified.

## Step 5 — TypeScript check

```bash
cd nextstep-mobile && npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors related to the navigator.

If there are errors about `PortalConnect` not existing in the param list, you likely
have a cached type. Run:
```bash
cd nextstep-mobile && rm -rf node_modules/.cache && npx tsc --noEmit 2>&1 | head -40
```

## Step 6 — Verify navigate calls will work

Search the project for any `navigate('PortalConnect')` calls that may exist from future
code or that were added prematurely:
```bash
grep -r "PortalConnect" nextstep-mobile/src/ --include="*.tsx" --include="*.ts"
```

Print the results. If any files reference 'PortalConnect' in a navigate call before
the screen existed, they will now work correctly.

## Step 7 — Verify the navigator renders

The navigator file must export a default function that returns a valid JSX element.
Check that the export is still intact:
```bash
grep -n "export default" nextstep-mobile/src/navigation/GradePortalNavigator.tsx
```

Expected: one line with `export default function GradePortalNavigator`

## Done

Report:
- GradePortalParamList before (the type keys listed)
- GradePortalParamList after (the type keys listed, including new PortalConnect)
- Import added: yes/no
- Screen registered: yes/no
- TypeScript errors: 0
- Any existing navigate('PortalConnect') calls found in the codebase (list files)
