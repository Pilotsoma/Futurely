# CMD 05 — Complete Grade Viewer (All Sub-Screens)

Read these files first:
- `nextstep-mobile/src/navigation/GradePortalNavigator.tsx`
- `nextstep-mobile/src/screens/GradePortalDashboard.tsx`
- `nextstep-mobile/src/components/grades/GradeCard.tsx`
- `nextstep-mobile/src/components/grades/GPASummaryCard.tsx`
- `nextstep-mobile/src/components/ui/BranchHeader.tsx`
- `nextstep-mobile/src/api/studentApi.ts` (created in CMD 04)

## Screen 1 — Rebuild GradeViewerScreen.tsx (Report Card)

Replace `nextstep-mobile/src/screens/GradeViewerScreen.tsx`:

- Fetch from `fetchStudentData()`
- Show `GPASummaryCard` at top with both GPAs
- Show FlatList of courses using `GradeCard`
- Add courseType badge to each card:
  - AP: small pill, #58A6FF bg + dark text
  - HONORS: small pill, #BC8CFF bg + dark text
  - STANDARD: small pill, #30363D bg + #8B949E text
- Grade letter colors: A=#3FB950, B=#00C896, C=#D29922, D=#F0883E, F=#F85149
- Tapping a course opens a Modal (React Native Modal component) showing:
  - Course name (heading)
  - Teacher name
  - Period X
  - Letter grade (large, colored)
  - Percentage
  - Close button
  - "Simulate grade →" button (closes modal, would nav to simulator)
- useFocusEffect to reload
- Skeleton loading, error retry

## Screen 2 — Create TranscriptScreen.tsx

Create `nextstep-mobile/src/screens/TranscriptScreen.tsx`:

- Fetch from `fetchStudentData()`
- Group courses by `semester` field (e.g., "2025-FA")
- Format semester: "2025-FA" → "Fall 2025", "2026-SP" → "Spring 2026"
- SectionList with each semester as a section:
  - Section header: semester name, bold white, #161B22 bg
  - Each course row: course name (flex 1, white 14px) | letter grade (colored 14px) | "1.0 cr" (muted 12px)
- Footer card (below list):
  - "Cumulative GPA" label
  - Unweighted: X.XX | Weighted: X.XX
  - "Total Credits Earned: X" (count of non-F courses × 1.0)
- Skeleton, error retry

## Screen 3 — Create ClassScheduleScreen.tsx

Create `nextstep-mobile/src/screens/ClassScheduleScreen.tsx`:

- Fetch from `fetchStudentData()`
- Sort courses by `period` (1 to 7+)
- FlatList of course rows:
  - Period bubble: 40×40 circle, #00C896 bg, period number white bold 16px, centered
  - Course name: white 15px bold
  - Teacher: secondary 13px
  - Room: "Room TBD" muted 12px
  - Alternating row backgrounds: odd rows transparent, even rows #161B22 with opacity 0.5
- No tap action needed
- Skeleton, error retry

## Screen 4 — Create ContactTeachersScreen.tsx

Create `nextstep-mobile/src/screens/ContactTeachersScreen.tsx`:

- Fetch from `fetchStudentData()`
- Deduplicate teachers (some courses may share a teacher)
- For each unique teacher:
  - Avatar circle 44×44, #00C896 bg, initials white bold 16px (first letter of each name word)
  - Teacher name: white 15px bold
  - Subject: secondary 13px (course name)
  - "IN" badge: 22×22 square rounded 4px, #30363D bg, "IN" #8B949E 10px bold
  - Row right: "Email" button 13px #00C896
  - Tap row OR email button: show Alert with title "Contact Teacher" and message "Email: {first initial}.{lastname}@slhs.edu (example: Ms. Rivera → m.rivera@slhs.edu)"
- Skeleton, error retry

## Screen 5 — Rebuild GradePortalDashboard.tsx

Replace `nextstep-mobile/src/screens/GradePortalDashboard.tsx`:

- Use `useNavigation` to navigate to sub-screens
- ScrollView layout with 2-column grid of tiles (using flexWrap row)
- 6 tiles total, each 48% width with gap:

  Tile 1: "Report Card"
    - Icon: `clipboard-outline` Ionicon, #00C896
    - Description: "Grades & letter grades"
    - Navigates to: `GradeViewer`

  Tile 2: "Transcript"
    - Icon: `document-text-outline`, #58A6FF
    - Description: "Credits & GPA history"
    - Navigates to: `Transcript`

  Tile 3: "Class Schedule"
    - Icon: `time-outline`, #D29922
    - Description: "Your class periods"
    - Navigates to: `ClassSchedule`

  Tile 4: "What-If Calculator"
    - Icon: `calculator-outline`, #3FB950
    - Description: "Simulate grade changes"
    - Navigates to: `Simulator` (existing GpaSimulatorScreen)

  Tile 5: "Contact Teachers"
    - Icon: `mail-outline`, #F0883E
    - Description: "Email your teachers"
    - Navigates to: `ContactTeachers`

  Tile 6: "Progress Report"
    - Icon: `bar-chart-outline`, #BC8CFF
    - Description: "Interim grades"
    - Shows Alert: "Coming in Phase 2!"

  Each tile:
  - #161B22 bg, 12px radius, 1px #30363D border
  - Padding 16
  - Icon in 44×44 circle with 15% opacity tinted bg
  - Title: white 14px bold, mt 10
  - Description: secondary 12px, mt 4

## Update GradePortalNavigator.tsx

Add all new screens to the navigator. The type definition should be:

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

Register all screens. All use `headerShown: false, animation: 'slide_from_right'`.

## Done
Report all files created/modified. Confirm GradePortalNavigator TypeScript compiles cleanly.
