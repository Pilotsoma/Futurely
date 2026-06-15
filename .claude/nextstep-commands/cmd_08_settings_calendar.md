# CMD 08 — Settings Screen + Calendar View

Read these files first:
- `nextstep-mobile/src/navigation/PlanningNavigator.tsx`
- `nextstep-mobile/src/screens/SmartPlannerScreen.tsx`
- `nextstep-mobile/src/navigation/AppNavigator.tsx`
- `nextstep-mobile/src/context/AuthContext.tsx`
- `nextstep-mobile/src/api/studentApi.ts`

## Step 1 — Create SettingsScreen.tsx

Create `nextstep-mobile/src/screens/SettingsScreen.tsx`.

Load student data with `fetchStudentData()`. Show Skeleton while loading.

Layout (ScrollView, #0D1117 bg):

Profile card (#161B22, 12px radius, 16px padding):
- Avatar circle 72x72, #00C896 bg, student initials white 28px bold (first letter of first + last name)
- Student name: white 18px bold, mt 12
- "{n}th Grade · Class of {graduationYear}": secondary 14px
- Row: "Change Name" with "›" right, onPress Alert "Coming soon"

Settings rows (each #161B22 card, separated by section):

Section "Appearance":
- "Color Theme" → "Dark" right, onPress Alert "Coming soon"
- "Color Coding" → "Enabled" right, onPress Alert "Coming soon"

Section "Account":
- "Login Settings" → "›" right, onPress Alert "Coming soon"
- "Manage Accounts" → "›" right, onPress Alert "Coming soon"

Section "Academic Info":
- "SAT Score" → show score or "Not set" right, onPress Alert "Coming soon"
- "ACT Score" → show score or "Not set" right, onPress Alert "Coming soon"
- "Future Plan" → show futureDecision or "Not set" right, onPress Alert "Coming soon"
- "Counselor" → show counselorName or "Unassigned" right (no chevron, read-only)

Section "Support":
- "Contact Support" → onPress Alert "Email support@nextstep.ai"
- "Terms of Service" → "›" right, onPress Alert "Coming soon"
- "Privacy Policy" → "›" right, onPress Alert "Coming soon"
- "Leave A Review" → "›" right, onPress Alert "Thank you!"
- "NextStep.ai" → "›" right, onPress Alert "Visit nextstep.ai"

Log Out button: full width, #F85149 text 16px bold centered, paddingVertical 16, mt 8
onPress: Alert with title "Log Out?" message "Are you sure?" with Cancel and Log Out.
Log Out confirmed: call `logout()` from `useAuth()`.

Footer: "NextStep v1.0.0 · MVP Build" centered muted 12px, paddingBottom 40.

## Step 2 — Add Settings to AppNavigator

In `nextstep-mobile/src/navigation/AppNavigator.tsx`:
- Add `Settings: undefined` to `AppParamList`
- Import and register `SettingsScreen`

## Step 3 — Wire Settings icon in MainAIScreen

In `nextstep-mobile/src/screens/MainAIScreen.tsx`:
- Replace the logout button in the top bar with a settings gear icon (`settings-outline`)
- onPress: `navigation.navigate('Settings')`
- Remove direct logout from this screen (it's in Settings now)

## Step 4 — Create CalendarScreen.tsx

Create `nextstep-mobile/src/screens/CalendarScreen.tsx`.

State:
- `currentMonth`: Date object (start of current month)
- `selectedDate`: Date | null
- `studentData`: from fetchStudentData()

Layout:

Month nav row:
- "‹" button (prev month) | "June 2026" bold white 18px | "›" button (next month)
- Row: "Tardies: 0  |  Excused: 0  |  Unexcused: 0" in muted 12px (hardcoded)

Calendar grid (7 columns):
- Header row: Sun Mon Tue Wed Thu Fri Sat — muted 12px
- Date cells (each ~13% width):
  - Date number: 16px
  - If today: #00C896 circle bg behind number
  - If past month: 40% opacity
  - If has assignments: small 5px dot below in red (#F85149)
  - If has completed: small 5px dot in green (#3FB950)
  - onPress: set selectedDate

Selected date panel (below calendar, shown when selectedDate is set):
- "{Weekday}, {Month} {Day}" header
- List assignments due on that date:
  - Assignment title, subject, estimated minutes
  - Completed: strikethrough + green check
- Empty: "Nothing due on {date}"

Load assignments from fetchStudentData(), index by date (YYYY-MM-DD key).

Add to PlanningNavigator: `Calendar: undefined`, import CalendarScreen.
Add calendar icon button to SmartPlannerScreen header that navigates to Calendar.

## TypeScript check
Run: `cd nextstep-mobile && npx tsc --noEmit` — fix all errors.

## Done
Report all files created/modified.
