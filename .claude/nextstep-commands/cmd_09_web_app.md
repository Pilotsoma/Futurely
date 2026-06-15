# CMD 09 — Next.js Web App (Student Dashboard)

The Next.js app is already scaffolded at the project root (app/page.tsx exists).
Read `app/layout.tsx`, `app/globals.css`, and `next.config.ts` first.

The web app connects to the same backend API (http://localhost:3001).
Students can log in and use all the same features as the mobile app, in a browser.

## Step 1 — Install web dependencies

Run at project root:
```
npm install @tanstack/react-query axios js-cookie
npm install --save-dev @types/js-cookie
```

## Step 2 — Setup global styles

Replace `app/globals.css` with NextStep's design system:

```css
:root {
  --bg: #0D1117;
  --surface: #161B22;
  --border: #30363D;
  --primary: #00C896;
  --primary-dark: #00A87E;
  --text: #E6EDF3;
  --text-secondary: #8B949E;
  --text-muted: #484F58;
  --success: #3FB950;
  --warning: #D29922;
  --orange: #F0883E;
  --error: #F85149;
  --info: #58A6FF;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 16px;
  line-height: 1.5;
}
a { color: var(--primary); text-decoration: none; }
```

## Step 3 — Create API client

Create `lib/api.ts` at project root:

```typescript
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ns_token') : null
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
  }
  const { data } = await res.json()
  return data as T
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; name: string; role: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<any>('/students/me'),
  roadmap: () => request<any>('/roadmap'),
  chat: (message: string) =>
    request<{ reply: string }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  studyPlan: () => request<{ plan: any[] }>('/ai/study-plan'),
}
```

## Step 4 — Create login page

Create `app/login/page.tsx`:

Full-page login form styled to match the mobile app:
- Centered card, max-width 400px, #161B22 bg, 16px radius, 2px border #30363D
- "N" logo circle 64x64 #00C896, white bold 34px
- "NextStep" heading #00C896 32px bold
- "Your academic companion" subtitle secondary
- Email input + Password input (styled dark inputs)
- "Log In" button full width #00C896 bg
- Error message display
- On success: save token to localStorage, redirect to /dashboard

## Step 5 — Create layout with sidebar

Create `app/(app)/layout.tsx` for authenticated pages:

Left sidebar (240px fixed):
- NextStep logo top
- Nav links: Dashboard, Grades, Planner, AI Chat, College Help, Settings
- Active link: #00C896 text + left border
- Bottom: logout button

Main content area: flex-1, overflow-y auto

Check auth: if no token in localStorage, redirect to /login.

## Step 6 — Create web pages

Create these pages. Each fetches from the API and displays data. Match the mobile layout but adapt for desktop (more space, side-by-side where mobile stacks).

`app/(app)/dashboard/page.tsx`:
- Same sections as mobile Dashboard: header, GPA card, Due Today, Quick Stats, Recent Grades
- Desktop: GPA card and Due Today side by side at top
- Quick Stats as a 4-column grid

`app/(app)/grades/page.tsx`:
- Grades table: columns for Course, Teacher, Period, Type, Grade, Percentage
- GPA summary row at top
- Sortable by clicking column headers
- Grade badge colored like mobile

`app/(app)/planner/page.tsx`:
- Two-column layout: upcoming assignments left, study plan right
- Assignment list grouped same as mobile (Overdue, Today, Tomorrow, This Week, Later)
- Checkboxes to mark complete (calls PATCH /api/assignments/:id/toggle)

`app/(app)/ai/page.tsx`:
- Full-height chat interface
- Left sidebar in main area: quick chips (Get Advice, Help Study, etc.)
- Right: chat messages (same bubble style as mobile but wider)
- Bottom: text input with send button

`app/(app)/settings/page.tsx`:
- Two-column: left col profile + academic info, right col app settings + support links
- Log out button red

## Step 7 — Create marketing landing page

Replace `app/page.tsx` with a proper landing page:

Sections:
1. Hero: "Your AI-Powered Academic Companion" heading, "NextStep helps high school students track grades, plan assignments, and prepare for college — all in one app." subtext, "Get Started" button → /login
2. Problem: 3 cards showing the problems NextStep solves (fragmented grades, no personalized planner, college prep confusion)
3. Features: 4 feature cards matching the MVP features (Grade Viewer, GPA Simulator, Smart Planner, Roadmap)
4. CTA: "Start your NextStep today" with login button
5. Footer: "NextStep © 2026 · MVP Build"

All styled with the dark theme. No external images needed — use emoji icons or simple CSS shapes.

## Step 8 — Add .env.local

Create `.env.local` at project root:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Step 9 — Verify

Run: `npm run build`
Fix any build errors.
Then run: `npm run dev`
Confirm the app starts at http://localhost:3000.

## Done
Report all files created and confirm the build passes.
