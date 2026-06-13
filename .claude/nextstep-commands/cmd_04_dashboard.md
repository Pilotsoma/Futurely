# CMD 04 — Dashboard Screen + Student API

Read these files first:
- `nextstep-mobile/src/constants/colors.ts`
- `nextstep-mobile/src/components/ui/Card.tsx`
- `nextstep-mobile/src/components/ui/Text.tsx`
- `nextstep-mobile/src/components/ui/Skeleton.tsx`
- `nextstep-mobile/src/components/ui/Screen.tsx`
- `nextstep-mobile/src/api/gradesApi.ts`
- `nextstep-mobile/src/api/assignmentsApi.ts`
- `nextstep-mobile/src/context/AuthContext.tsx`
- `nextstep-mobile/src/constants/api.ts`

## Step 1 — Create studentApi.ts

Create `nextstep-mobile/src/api/studentApi.ts`:

```typescript
import { API_BASE_URL } from '../constants/api'
import { getToken } from '../utils/auth'

export interface StudentProfile {
  id: number
  studentId: string
  gradeLevel: number
  graduationYear: number
  futureDecision: string | null
  satScore: number | null
  actScore: number | null
  counselorName: string | null
  weightedGpa: number
  unweightedGpa: number
}

export interface CourseWithGrade {
  id: number
  name: string
  teacher: string
  period: number
  courseType: string
  creditHours: number
  semester: string
  grade: { letterGrade: string; percentage: number } | null
}

export interface Assignment {
  id: number
  title: string
  subject: string
  dueDate: string
  estimatedMinutes: number
  completed: boolean
  completedAt: string | null
}

export interface StudentStats {
  totalCourses: number
  completedAssignments: number
  pendingAssignments: number
  assignmentsDueToday: number
  assignmentsDueThisWeek: number
}

export interface StudentData {
  id: number
  email: string
  name: string | null
  role: string
  profile: StudentProfile | null
  courses: CourseWithGrade[]
  assignments: Assignment[]
  stats: StudentStats
}

export async function fetchStudentData(): Promise<StudentData> {
  const token = await getToken()
  const res = await fetch(`${API_BASE_URL}/students/me`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!res.ok) throw new Error(`Failed to load student data: ${res.status}`)
  const { data } = (await res.json()) as { data: StudentData }
  return data
}
```

## Step 2 — Create aiApi.ts

Create `nextstep-mobile/src/api/aiApi.ts`:

```typescript
import { API_BASE_URL } from '../constants/api'
import { getToken } from '../utils/auth'

export interface StudyPlanItem {
  id: number
  title: string
  subject: string
  dueDate: string
  estimatedMinutes: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export async function sendChatMessage(message: string): Promise<string> {
  const token = await getToken()
  const res = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  const { data } = (await res.json()) as { data: { reply: string } }
  return data.reply
}

export async function fetchStudyPlan(): Promise<StudyPlanItem[]> {
  const token = await getToken()
  const res = await fetch(`${API_BASE_URL}/ai/study-plan`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  if (!res.ok) throw new Error('Failed to load study plan')
  const { data } = (await res.json()) as { data: { plan: StudyPlanItem[] } }
  return data.plan
}
```

## Step 3 — Rebuild DashboardScreen.tsx

Replace `nextstep-mobile/src/screens/DashboardScreen.tsx` entirely:

The screen must:
- Import `fetchStudentData` from `../api/studentApi`
- Use `useFocusEffect` from `@react-navigation/native` to reload on tab focus
- Show Skeleton loading state while fetching
- Show error state with retry button on failure
- Show all sections below with real data — zero hardcoded values

Section layout (top to bottom inside a ScrollView):

**Header** (no card, just text, paddingTop 24):
- "Good morning," — secondary color, 15px
- student name — white, 26px bold
- today's date formatted as "Monday, June 2" — muted, 13px
- grade level badge: small pill "{n}th Grade", #00C896 bg, dark text 11px bold

**GPA Card** (Card component, left border 3px #00C896, onPress navigates to Grades tab via `useNavigation`):
- Row title "Current GPA" uppercase, 11px, secondary, mb 12
- Two columns side by side:
  - Left col: unweightedGpa (32px bold white), "Unweighted" label (12px secondary)
  - Vertical divider 1px #30363D h:40
  - Right col: weightedGpa (32px bold #00C896), "Weighted" label (12px secondary)
- Tap → navigate to Grades

**Due Today card** (Card component):
- Row: "Due Today" label (bold white 15px) + red count badge (circle, #F85149 bg, white text 11px bold)
- If no assignments due today: centered "🎉 Nothing due today!" secondary text
- Else: list each assignment (filter dueDate = today, !completed):
  - Left colored dot 8px circle (deterministic color from subject name using simple hash)
  - Assignment title 14px white
  - Subject 12px secondary
  - "Xm" estimate 12px muted, right-aligned
- "View all →" TouchableOpacity bottom right, 13px #00C896, navigates to Planner

**Quick Stats** (row of 3 cards, flexDirection row, gap 8):
- Each card: #161B22 bg, 12px radius, 1px #30363D border, flex:1, padding 14, alignItems center
- Card 1: courses count (22px bold white), "Courses" (11px secondary)
- Card 2: assignmentsDueThisWeek (22px bold white), "Due Soon" (11px secondary)
- Card 3: "3" hardcoded (22px bold white), "Day Streak 🔥" (11px secondary)

**Recent Grades** (Card component):
- Row: "Recent Grades" (bold 15px white) + "See all →" right (#00C896 13px, navigates to Grades)
- Show first 3 courses from courses array
- Each row: course name flex:1 white 14px | letter grade colored 15px bold | percentage muted 13px
- Grade colors: A=#3FB950, B=#00C896, C=#D29922, D=#F0883E, F=#F85149

Subject dot color helper — add this function in the file:
```typescript
function subjectColor(subject: string): string {
  const colors = ['#00C896','#58A6FF','#D29922','#F0883E','#3FB950','#F85149','#BC8CFF']
  let hash = 0
  for (const ch of subject) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return colors[hash % colors.length] ?? '#8B949E'
}
```

## Done
Report files created. Do not start the Expo dev server.
