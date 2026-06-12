# CMD 07 — College Help + Roadmap Screens

Read these files first:
- `nextstep-mobile/src/screens/CollegeHelpScreen.tsx` (existing scaffold)
- `nextstep-mobile/src/navigation/CollegeHelpNavigator.tsx`
- `nextstep-mobile/src/api/studentApi.ts`
- `nextstep-mobile/src/constants/colors.ts`

## Step 1 — Add roadmapApi.ts

Create `nextstep-mobile/src/api/roadmapApi.ts`:

```typescript
import { API_BASE_URL } from '../constants/api'
import { getToken } from '../utils/auth'

export interface RoadmapMilestone {
  grade: number
  label: string
  done: boolean
}

export interface RoadmapData {
  gradeLevel: number
  graduationYear: number | null
  creditsCompleted: number
  creditsRequired: number
  percentComplete: number
  creditsByCategory: Record<string, number>
  milestones: RoadmapMilestone[]
  weightedGpa: number
  unweightedGpa: number
  futureDecision: string | null
}

export async function fetchRoadmap(): Promise<RoadmapData> {
  const token = await getToken()
  const res = await fetch(`${API_BASE_URL}/roadmap`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!res.ok) throw new Error(`Failed to load roadmap: ${res.status}`)
  const { data } = (await res.json()) as { data: RoadmapData }
  return data
}
```

## Step 2 — Update CollegeHelpScreen.tsx

Modify `nextstep-mobile/src/screens/CollegeHelpScreen.tsx` to load real GPA data.

Import `fetchStudentData` from `../api/studentApi` and `useFocusEffect` from `@react-navigation/native`.

Add state: `const [studentData, setStudentData] = useState<StudentData | null>(null)`

Load on focus:
```typescript
useFocusEffect(useCallback(() => {
  fetchStudentData().then(setStudentData).catch(() => null)
}, []))
```

Replace the GPA card placeholders ("—") with real values:
- Left col: `(studentData?.profile?.unweightedGpa ?? 0).toFixed(3)` — use `toFixed(3)` like your Canva shows
- Right col: `(studentData?.profile?.weightedGpa ?? 0).toFixed(3)` in #00C896

Show a Skeleton in place of the GPA numbers while `studentData` is null.

Update the "Road-map" and "Colleges" rows to navigate to real screens (created below) instead of showing "Soon".

The "Colleges" tile should navigate to `CollegesScreen`.
The "Road-map" tile should navigate to `RoadmapScreen`.

## Step 3 — Create RoadmapScreen.tsx

Create `nextstep-mobile/src/screens/RoadmapScreen.tsx`:

Data: fetch from `fetchRoadmap()`.

Layout (ScrollView):

**Credits progress section** (Card):
- Title: "Credits to Graduation"
- Large progress bar: full width, 12px height, #30363D background, #00C896 fill, border-radius 6
  Width of fill: `(creditsCompleted / creditsRequired * 100)%`
- Below bar: "{creditsCompleted} of {creditsRequired} credits earned" secondary text
- "{percentComplete}% complete" right-aligned #00C896

**Credits by category** (Card):
- Title: "Credits by Subject Area"
- List each category with mini bar:
  - Category name (white 14px, flex 1)
  - Mini bar (flex 2, height 6, bg #30363D, fill #00C896)
  - Count X.X right (muted 12px)
- Only show categories with > 0 credits

**Milestones timeline** (Card):
- Title: "High School Timeline"
- Vertical list of 4 milestones, each showing:
  - Grade circle: 36×36, completed = #00C896 bg with checkmark, current = border #00C896, future = #30363D bg
  - "Grade {n}" label bold white 14px
  - Milestone description secondary 13px
  - A vertical line connecting to next milestone (except last)

**Goal section** (Card):
- Title: "Your Plan"
- "Future goal: {futureDecision}" or "Add your future plan in Settings"
- "Expected graduation: {graduationYear}"
- GPA summary: Unweighted {X.XXX} | Weighted {X.XXX}

## Step 4 — Create CollegesScreen.tsx

Create `nextstep-mobile/src/screens/CollegesScreen.tsx`:

This is a placeholder screen that shows a coming-soon state with real student data for context.

Layout:
- Header: "Colleges" title
- Student context card: show their GPA and future decision from `fetchStudentData()`
- College match placeholder: 3 blurred/dimmed college cards showing "Match data coming soon"
  - Each card: college name, location, acceptance rate (hardcoded sample data for 3 universities)
  - Locked overlay with lock icon and "Phase 2 feature" badge
- Encourage message: "Based on your {unweightedGpa} GPA, we'll match you with schools when this feature launches."

Sample college data to hardcode:
```
University of Texas at Austin — Austin, TX — 31% acceptance
Texas A&M University — College Station, TX — 57% acceptance
University of Houston — Houston, TX — 62% acceptance
```

## Step 5 — Update CollegeHelpNavigator.tsx

Add new screens:

```typescript
export type CollegeHelpParamList = {
  CollegeHelpHome: undefined
  WhatIfCalculator: undefined
  Roadmap: undefined
  Colleges: undefined
}
```

Register `RoadmapScreen` as `Roadmap` and `CollegesScreen` as `Colleges`.

## TypeScript check
Run: `cd nextstep-mobile && npx tsc --noEmit`
Fix all errors.

## Done
Report all files created/modified.
